// lib/dedup/cluster.ts
// Clustering pipeline — groups articles covering the same story across
// different sources using cosine similarity on Voyage embeddings.
//
// Call recomputeClusters() from a script or after each ingest batch.

import { prisma } from '@/lib/db';
import { cosineSimilarity } from '@/lib/ai/embed';

const SIMILARITY_THRESHOLD = 0.75;
const ACTIVE_WINDOW_DAYS = 3; // Daily ingest — news clusters within 2-3 days

interface ArticleWithEmbedding {
  id: string;
  title: string;
  sourceId: string;
  embedding: string;
  publishedAt: Date;
}

export async function recomputeClusters(): Promise<{
  clustered: number;
  newClusters: number;
  multiSourceClusters: number;
  totalClusters: number;
}> {
  // Load all active articles with embeddings
  const windowDate = new Date();
  windowDate.setDate(windowDate.getDate() - ACTIVE_WINDOW_DAYS);

  const articles = await prisma.article.findMany({
    where: {
      embedding: { not: null },
      publishedAt: { gte: windowDate },
    },
    select: {
      id: true,
      title: true,
      sourceId: true,
      embedding: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: 'asc' },
  });

  if (articles.length === 0) {
    return { clustered: 0, newClusters: 0, multiSourceClusters: 0, totalClusters: 0 };
  }

  // Load all existing clusters with their member article IDs
  const existingClusters = await prisma.cluster.findMany({
    include: { articles: { select: { id: true, sourceId: true, embedding: true } } },
  });

  // Clear all existing cluster assignments (fresh recompute)
  await prisma.article.updateMany({
    where: { clusterId: { not: null } },
    data: { clusterId: null },
  });

  // Load source info
  const sources = await prisma.source.findMany({
    select: { id: true, editorialIndependence: true },
  });
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  // Parse embeddings once
  const vecCache = new Map<string, number[]>();
  function getVec(embedding: string): number[] {
    if (vecCache.has(embedding)) return vecCache.get(embedding)!;
    const vec = JSON.parse(embedding);
    vecCache.set(embedding, vec);
    return vec;
  }

  const newClusters: Array<{
    memberIds: string[];
    members: Array<{ id: string; embedding: number[]; sourceId: string }>;
  }> = [];

  let clustered = 0;

  for (const article of articles) {
    const vec = getVec(article.embedding!);

    // Find best matching cluster — average similarity to all members
    let bestCluster: typeof newClusters[number] | null = null;
    let bestScore = 0;

    for (const cluster of newClusters) {
      let totalSim = 0;
      for (const member of cluster.members) {
        totalSim += cosineSimilarity(vec, member.embedding);
      }
      const avgSim = totalSim / cluster.members.length;
      if (avgSim > bestScore) {
        bestScore = avgSim;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestScore >= SIMILARITY_THRESHOLD) {
      bestCluster.memberIds.push(article.id);
      bestCluster.members.push({ id: article.id, embedding: vec, sourceId: article.sourceId });
      clustered++;
    } else {
      newClusters.push({
        memberIds: [article.id],
        members: [{ id: article.id, embedding: vec, sourceId: article.sourceId }],
      });
    }
  }

  // Write clusters to DB
  let multiSource = 0;
  const sourceSet = new Set<string>();

  for (const cluster of newClusters) {
    // Compute cluster stats
    const distinctSources = new Set(cluster.members.map((m) => m.sourceId));
    const independentCount = [...distinctSources].filter(
      (sid) => sourceMap.get(sid)?.editorialIndependence === 'independent',
    ).length;
    const hasIndependent = independentCount > 0;

    // Corroboration score: average pair-wise similarity
    let corroboration = 0.3; // default for single-source
    if (cluster.members.length > 1) {
      let totalSim = 0;
      let pairs = 0;
      for (let i = 0; i < cluster.members.length; i++) {
        for (let j = i + 1; j < cluster.members.length; j++) {
          totalSim += cosineSimilarity(cluster.members[i].embedding, cluster.members[j].embedding);
          pairs++;
        }
      }
      corroboration = pairs > 0 ? totalSim / pairs : 0.3;
    }

    const publishedDates = cluster.members
      .map((m) => articles.find((a) => a.id === m.id)?.publishedAt)
      .filter(Boolean) as Date[];
    const earliest = new Date(Math.min(...publishedDates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...publishedDates.map((d) => d.getTime())));

    // Representative article: highest-weight source member (pick first for simplicity, using earliest by date)
    const rep = cluster.members[0];

    const created = await prisma.cluster.create({
      data: {
        representativeArticleId: rep.id,
        totalSourceCount: distinctSources.size,
        independentSourceCount: independentCount,
        uniqueWireOriginCount: 0,
        hasIndependentVoice: hasIndependent,
        corroborationScore: corroboration,
        earliestPublishedAt: earliest,
        latestPublishedAt: latest,
        areas: '',
        primaryArea: '',
        sourcesAttributed: JSON.stringify([...distinctSources]),
      },
    });

    // Set clusterId on all member articles
    await prisma.article.updateMany({
      where: { id: { in: cluster.memberIds } },
      data: { clusterId: created.id },
    });

    sourceSet.add(created.id);
    if (distinctSources.size > 1) multiSource++;
  }

  return {
    clustered,
    newClusters: newClusters.length,
    multiSourceClusters: multiSource,
    totalClusters: newClusters.length,
  };
}
