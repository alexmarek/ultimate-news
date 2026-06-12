// scripts/reclassify-articles.ts
// One-off script to re-enrich existing articles against the new 8-category
// taxonomy: World News, Music, Sport, Business, Technology, Environment,
// Positive News, Travel.
//
// Usage: npx tsx scripts/reclassify-articles.ts
//
// Dry-run mode (default): npx tsx scripts/reclassify-articles.ts --dry
// Apply changes:          npx tsx scripts/reclassify-articles.ts --apply
//
// Requires DATABASE_URL and ANTHROPIC_API_KEY in .env.
// Limits to 50 articles per run to avoid API costs spiraling.

import { prisma } from '@/lib/db';
import { AREAS } from '@/lib/types';
import Anthropic from '@anthropic-ai/sdk';
import { ENRICH_PROMPT } from '@/lib/ai/prompts';

const CONFIDENCE_THRESHOLD = 0.65;
const BATCH_SIZE = 50;
const DRY_RUN = !process.argv.includes('--apply');

interface EnrichOutput {
  summary: string;
  areas: Array<{ area: string; confidence: number }>;
  topics: string[];
  entities: string[];
  titleEn: string | null;
  incomplete: boolean;
}

async function enrichWithClaude(
  sourceName: string,
  sourceLang: string,
  title: string,
  excerpt: string,
  content: string | null,
): Promise<EnrichOutput> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const prompt = ENRICH_PROMPT
    .replace('{sourceName}', sourceName)
    .replace('{sourceLang}', sourceLang)
    .replace('{title}', title)
    .replace('{excerpt}', excerpt)
    .replace('{content}', content || '');

  const msg = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('\n');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  return JSON.parse(jsonMatch[0]) as EnrichOutput;
}

function resolveArea(enrichment: EnrichOutput): {
  primaryArea: string;
  lowConfidenceTag: boolean;
} {
  const topArea = enrichment.areas[0];

  if (
    !topArea ||
    topArea.confidence < CONFIDENCE_THRESHOLD ||
    !AREAS.includes(topArea.area as never)
  ) {
    return { primaryArea: AREAS[0], lowConfidenceTag: true };
  }

  return { primaryArea: topArea.area, lowConfidenceTag: false };
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Confidence threshold: ${CONFIDENCE_THRESHOLD}`);
  console.log(`Canonical taxonomy: ${AREAS.join(', ')}\n`);

  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: 'desc' },
    take: BATCH_SIZE,
    include: { source: true },
  });

  console.log(`Found ${articles.length} articles to reclassify\n`);

  let updated = 0;
  let lowConf = 0;

  for (const article of articles) {
    try {
      const enrichment = await enrichWithClaude(
        article.source.name,
        article.lang,
        article.title,
        article.excerpt,
        article.content,
      );

      const { primaryArea, lowConfidenceTag } = resolveArea(enrichment);

      const changed =
        article.primaryArea !== primaryArea ||
        article.lowConfidenceTag !== lowConfidenceTag;

      if (changed) {
        if (lowConfidenceTag) lowConf++;

        console.log(
          `  ${changed ? '✏️' : '✓'} ${article.title.slice(0, 60)}...`,
        );
        console.log(
          `     Old: ${article.primaryArea} → New: ${primaryArea}${lowConfidenceTag ? ' (low confidence)' : ''}`,
        );

        if (!DRY_RUN) {
          await prisma.article.update({
            where: { id: article.id },
            data: {
              primaryArea,
              lowConfidenceTag,
              areas: enrichment.areas.map((a) => a.area).join(','),
              areaConfidences: JSON.stringify(enrichment.areas),
              summary: enrichment.summary,
              topics: enrichment.topics.join(','),
              entities: enrichment.entities.join(','),
            },
          });
        }

        updated++;
      }
    } catch (err) {
      console.error(
        `  ✗ Failed: ${article.title.slice(0, 60)}...`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `\nDone. ${updated} articles would be${DRY_RUN ? ' (dry run)' : ''} updated, ${lowConf} low-confidence.`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
