import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { topics: { has: q } },
      { entities: { has: q } },
      { source: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  if (category && category !== 'all') {
    where.primaryArea = category;
  }

  // Get articles with their clusters
  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        source: true,
        cluster: true,
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.article.count({ where }),
  ]);

  // Group by cluster for frontend
  const clustersMap = new Map<string, any>();
  articles.forEach((article) => {
    if (article.clusterId && !clustersMap.has(article.clusterId)) {
      clustersMap.set(article.clusterId, {
        ...article.cluster,
        articles: [article],
      });
    } else if (article.clusterId) {
      clustersMap.get(article.clusterId)!.articles.push(article);
    } else {
      // Article without cluster (shouldn't happen in production)
      const clusterId = `single-${article.id}`;
      clustersMap.set(clusterId, {
        id: clusterId,
        representativeArticleId: article.id,
        totalSourceCount: 1,
        independentSourceCount: article.source.editorialIndependence === 'independent' ? 1 : 0,
        uniqueWireOriginCount: article.syndicatedFrom ? 1 : 0,
        hasIndependentVoice: article.source.editorialIndependence === 'independent',
        corroborationScore: 0.3, // Default low score for single source
        earliestPublishedAt: article.publishedAt,
        latestPublishedAt: article.publishedAt,
        areas: article.areas,
        primaryArea: article.primaryArea,
        sourcesAttributed: [article.sourceId],
        combinedSummary: article.summary,
        articles: [article],
      });
    }
  });

  const clusters = Array.from(clustersMap.values());

  return NextResponse.json({
    clusters,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}