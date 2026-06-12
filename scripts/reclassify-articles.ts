// scripts/reclassify-articles.ts
// One-off script to re-enrich existing articles against the new 8-category
// taxonomy: World News, Music, Sport, Business, Technology, Environment,
// Positive News, Travel.
//
// Usage:
//   npx tsx scripts/reclassify-articles.ts               (dry run, 50 articles)
//   npx tsx scripts/reclassify-articles.ts --sample 10   (dry run, 10 articles)
//   npx tsx scripts/reclassify-articles.ts --apply        (write changes, 50 articles)
//   npx tsx scripts/reclassify-articles.ts --sample 10 --apply  (write, 10)
//   npx tsx scripts/reclassify-articles.ts --all          (all articles)
//
// Requires DATABASE_URL and ANTHROPIC_API_KEY in .env.

import { prisma } from '@/lib/db';
import { AREAS } from '@/lib/types';
import Anthropic from '@anthropic-ai/sdk';
import { ENRICH_PROMPT } from '@/lib/ai/prompts';

const CONFIDENCE_THRESHOLD = 0.65;
const DEFAULT_BATCH_SIZE = 50;
const DRY_RUN = !process.argv.includes('--apply');
const SAMPLE_INDEX = process.argv.indexOf('--sample');
const SAMPLE = SAMPLE_INDEX !== -1 ? parseInt(process.argv[SAMPLE_INDEX + 1], 10) || 10 : null;
const ALL = process.argv.includes('--all');
const LIMIT = ALL ? undefined : (SAMPLE ?? DEFAULT_BATCH_SIZE);

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
  console.log(`Canonical taxonomy: ${AREAS.join(', ')}`);
  console.log(`Limit: ${LIMIT ?? 'all'}\n`);

  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: 'desc' },
    take: LIMIT,
    include: { source: true },
  });

  console.log(`Found ${articles.length} articles to reclassify\n`);

  let updated = 0;
  let lowConf = 0;
  let topicChanged = 0;
  let areaChanged = 0;

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

      const oldTopics = article.topics ? article.topics.split(',') : [];
      const newTopics = enrichment.topics;
      const hasTopicChange =
        oldTopics.length !== newTopics.length ||
        !oldTopics.every((t) => newTopics.includes(t));

      const hasAreaChange =
        article.primaryArea !== primaryArea ||
        article.lowConfidenceTag !== lowConfidenceTag;

      if (hasAreaChange || hasTopicChange) {
        if (hasAreaChange) areaChanged++;
        if (hasTopicChange) topicChanged++;
        if (lowConfidenceTag) lowConf++;

        console.log(`  ✏️  ${article.title.slice(0, 70)}...`);
        if (hasAreaChange) {
          console.log(`     Area: ${article.primaryArea} → ${primaryArea}${lowConfidenceTag ? ' (low confidence)' : ''}`);
        }
        if (hasTopicChange) {
          console.log(`     Topics: [${oldTopics.join(', ')}] → [${newTopics.join(', ')}]`);
        }

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
    `\nDone. ${updated} articles would be${DRY_RUN ? ' (dry run)' : ''} updated (${areaChanged} area changes, ${topicChanged} topic changes), ${lowConf} low-confidence.`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
