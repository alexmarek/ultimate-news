import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { queryEmbed, cosineSimilarity } from '@/lib/ai/embed';

const TOP_K = 20;
const MIN_QUERY_LENGTH = 3;

interface ScoredArticle {
  article: {
    id: string;
    title: string;
    excerpt: string;
    summary: string | null;
    publishedAt: Date;
    primaryArea: string;
    lang: string;
    canonicalUrl: string;
    source: { id: string; name: string; editorialIndependence: string };
    cluster: { totalSourceCount: number } | null;
  };
  score: number;
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length < MIN_QUERY_LENGTH) {
      const articles = await prisma.article.findMany({
        where: { embedding: { not: null } },
        include: { source: true, cluster: { select: { totalSourceCount: true } } },
        orderBy: { publishedAt: 'desc' },
        take: TOP_K,
      });

      return NextResponse.json({
        results: articles.map((a) => ({
          id: a.id,
          title: a.title,
          excerpt: a.excerpt,
          summary: a.summary,
          publishedAt: a.publishedAt,
          primaryArea: a.primaryArea,
          lang: a.lang,
          canonicalUrl: a.canonicalUrl,
          source: { id: a.source.id, name: a.source.name, editorialIndependence: a.source.editorialIndependence },
          cluster: a.cluster,
          score: null,
        })),
        mode: 'recent',
      });
    }

    const trimmedQuery = query.trim();

    console.log(`[search] query="${trimmedQuery}"`);

    // Embed the query with input_type='query'
    const queryVec = await queryEmbed(trimmedQuery);

    // Load all articles with embeddings
    const articles = await prisma.article.findMany({
      where: { embedding: { not: null } },
      include: { source: true, cluster: { select: { totalSourceCount: true } } },
    });

    console.log(`[search] candidate articles with embeddings: ${articles.length}`);

    if (articles.length === 0) {
      // No embeddings stored — fall back to recent articles
      const recent = await prisma.article.findMany({
        include: { source: true, cluster: { select: { totalSourceCount: true } } },
        orderBy: { publishedAt: 'desc' },
        take: TOP_K,
      });
      console.log(`[search] no embeddings stored, returning ${recent.length} recent articles`);
      return NextResponse.json({
        results: recent.map((a) => ({
          id: a.id,
          title: a.title,
          excerpt: a.excerpt,
          summary: a.summary,
          publishedAt: a.publishedAt,
          primaryArea: a.primaryArea,
          lang: a.lang,
          canonicalUrl: a.canonicalUrl,
          source: { id: a.source.id, name: a.source.name, editorialIndependence: a.source.editorialIndependence },
          cluster: a.cluster,
          score: null,
        })),
        mode: 'no-embeddings',
      });
    }

    // Compute cosine similarity for each
    const scored: ScoredArticle[] = [];
    for (const article of articles) {
      if (!article.embedding) continue;
      let embedding: number[];
      try {
        embedding = JSON.parse(article.embedding);
      } catch {
        continue;
      }

      if (!Array.isArray(embedding) || embedding.length === 0) continue;

      const score = cosineSimilarity(queryVec, embedding);
      scored.push({
        article: {
          id: article.id,
          title: article.title,
          excerpt: article.excerpt,
          summary: article.summary,
          publishedAt: article.publishedAt,
          primaryArea: article.primaryArea,
          lang: article.lang,
          canonicalUrl: article.canonicalUrl,
          source: { id: article.source.id, name: article.source.name, editorialIndependence: article.source.editorialIndependence },
          cluster: article.cluster,
        },
        score,
      });
    }

    console.log(`[search] scored: ${scored.length}, max similarity: ${scored.length > 0 ? Math.max(...scored.map(s => s.score)).toFixed(4) : 'N/A'}`);

    // Sort by score descending, take top K
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, TOP_K);

    console.log(`[search] returning ${top.length} results`);

    return NextResponse.json({
      results: top.map(({ article, score }) => ({
        ...article,
        score: Math.round(score * 100) / 100,
      })),
      mode: 'semantic',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Voyage API key missing or API down — fallback to recent
    try {
      const articles = await prisma.article.findMany({
        include: { source: true, cluster: { select: { totalSourceCount: true } } },
        orderBy: { publishedAt: 'desc' },
        take: TOP_K,
      });

      return NextResponse.json({
        results: articles.map((a) => ({
          id: a.id,
          title: a.title,
          excerpt: a.excerpt,
          summary: a.summary,
          publishedAt: a.publishedAt,
          primaryArea: a.primaryArea,
          lang: a.lang,
          canonicalUrl: a.canonicalUrl,
          source: { id: a.source.id, name: a.source.name, editorialIndependence: a.source.editorialIndependence },
          cluster: a.cluster,
          score: null,
        })),
        mode: 'fallback',
        error: message,
      });
    } catch {
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}
