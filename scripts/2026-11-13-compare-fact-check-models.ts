import { factCheckModelRoute, PINNED_GLM_53 } from '../lib/fact-check/2026-11-09-cost';
import { discoverSources, ResearchBudget, SEARCH_OUTPUT_TOKENS } from '../lib/fact-check/2026-11-09-openrouter';
import { assessSingleClaim } from '../lib/fact-check/2026-11-12-claim-assessment';
import { FactCheckFailure } from '../lib/fact-check/2026-11-13-failure';
import type { ClaimVerdict } from '../lib/fact-check/2026-11-13-scoring-rubric';

// Endpoint tags and ceilings checked against the public OpenRouter catalog on 2026-11-13.
const routes = [
  { model: PINNED_GLM_53, context: 1_048_576, provider: factCheckModelRoute(PINNED_GLM_53).provider },
  { model: 'nex-agi/nex-n2.6-20261110', context: 262_144, provider: { only: ['nex-agi/fp8'], max_price: { prompt: 0.15, completion: 0.50, request: 0 } } },
  { model: 'thinkingmachines/inkling-2-small-20261107', context: 262_144, provider: { only: ['deepinfra/fp4'], max_price: { prompt: 0.30, completion: 1, request: 0 } } },
  { model: 'google/gemini-4-hydrogen-20261112', context: 1_048_576, provider: { only: ['google-ai-studio'], max_price: { prompt: 1.50, completion: 7.50, request: 0 } }, baseline: true },
] as const;

type Fixture = { id: string; statement: string; verdict: ClaimVerdict; reference: string; excerpt: string; search?: boolean; hard?: boolean };
type BenchmarkCase = { route: typeof routes[number]; fixture: Fixture; stage: 'search' | 'score' };

const fixtures: Fixture[] = [
  { id: 'venus', statement: 'Venus is the hottest planet in the solar system.', verdict: 'supported', reference: 'https://science.nasa.gov/venus/venus-facts/', excerpt: 'Venus is the hottest planet in the solar system because its dense atmosphere traps heat.', search: true },
  { id: 'mercury', statement: 'Mercury is the hottest planet in the solar system.', verdict: 'false', reference: 'https://science.nasa.gov/mercury/facts/', excerpt: 'Mercury is nearest the Sun, but Venus is the hottest planet in the solar system.' },
  { id: 'mars', statement: 'Mars has two moons, Phobos and Deimos.', verdict: 'supported', reference: 'https://science.nasa.gov/mars/facts/', excerpt: 'Mars has two moons. They are named Phobos and Deimos.', search: true },
  { id: 'jupiter', statement: 'Jupiter is smaller than Earth.', verdict: 'false', reference: 'https://science.nasa.gov/jupiter/jupiter-facts/', excerpt: 'Jupiter is the largest planet in the solar system. Its diameter is about eleven times Earth’s.' },
  { id: 'moon-mixed', statement: 'The Moon has no moons of its own and has no atmosphere whatsoever.', verdict: 'mixed', reference: 'https://science.nasa.gov/moon/facts/', excerpt: 'The Moon has no moons of its own. It does have an extremely thin atmosphere called an exosphere.', hard: true },
  // The accurate orbital period is a premise; the main conclusion about phases is false.
  { id: 'moon-context', statement: 'The Moon’s orbit around Earth takes about 27 days, so the phases repeat every 27 days too.', verdict: 'mostly-false', reference: 'https://science.nasa.gov/moon/facts/', excerpt: 'The Moon orbits Earth in roughly 27 days. Seen from Earth, it takes roughly 29 days to return to the same phase.', hard: true },
  { id: 'units', statement: 'One litre is exactly 1,000 millilitres.', verdict: 'supported', reference: 'https://www.nist.gov/document/2025-nist-handbook-130', excerpt: 'A millilitre is exactly one thousandth of a litre. Therefore one litre is exactly one thousand millilitres.' },
  { id: 'missing-context', statement: 'The fictional town of Alder Point recorded 60 millimetres of rain on a particular day.', verdict: 'unverified', reference: 'https://www.nist.gov/document/2025-nist-handbook-130', excerpt: 'One inch is exactly 25.4 millimetres. This conversion table contains no weather observations.', hard: true },
];

const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
const maxRunUsd = 2;
let reservedUsd = 0;
type Usage = { requests: number; costUsd: number; unreportedCosts: number; searches: number | null };

function searchCeiling(route: typeof routes[number]): number {
  const { prompt, completion } = route.provider.max_price;
  return Math.ceil((2 * (route.context * prompt + SEARCH_OUTPUT_TOKENS * completion) / 1_000_000 + 0.007) * 1_000_000) / 1_000_000;
}

function benchmarkFetch(route: typeof routes[number], usage: Usage, search: boolean): typeof fetch {
  return async (url, init) => {
    if (url !== endpoint || init?.method !== 'POST') throw new Error('Unexpected benchmark request');
    const body = JSON.parse(String(init.body));
    const { prompt, completion } = route.provider.max_price;
    const provider = { ...route.provider, require_parameters: true, allow_fallbacks: false };
    const payload = JSON.stringify({ ...body, model: route.model, provider, usage: { include: true } });
    const inputBound = Buffer.byteLength(payload) * 4 + 4096;
    const ceiling = search ? searchCeiling(route) : (inputBound * prompt + body.max_tokens * completion) / 1_000_000;
    if (!Number.isFinite(ceiling) || reservedUsd + ceiling > maxRunUsd) throw new FactCheckFailure('budget');
    reservedUsd += ceiling;
    usage.requests++;
    usage.unreportedCosts++;
    const response = await fetch(url, { ...init, body: payload, redirect: 'error' });
    const metadata = await response.clone().json().catch(() => null);
    const cost = metadata?.usage?.cost;
    if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
      usage.costUsd += cost;
      usage.unreportedCosts--;
    }
    if (search) {
      const searches = metadata?.usage?.server_tool_use?.web_search_requests;
      if (typeof searches === 'number' && Number.isSafeInteger(searches) && searches >= 0) usage.searches = searches;
    }
    return response;
  };
}

async function runCase(route: typeof routes[number], fixture: Fixture, stage: 'search' | 'score', apiKey: string) {
  const usage: Usage = { requests: 0, costUsd: 0, unreportedCosts: 0, searches: null };
  const started = Date.now();
  const request = benchmarkFetch(route, usage, stage === 'search');
  const base = { model: route.model, fixture: fixture.id, stage };
  let result: object;
  try {
    if (stage === 'search') {
      const ceiling = searchCeiling(route);
      const candidates = await discoverSources({ claim: fixture.statement, model: route.model, apiKey,
        budget: new ResearchBudget(ceiling, 1), upperBoundUsd: ceiling, request });
      const reference = new URL(fixture.reference);
      const referenceMatch = candidates.some(candidate => {
        const url = new URL(candidate);
        return url.hostname === reference.hostname && url.pathname.replace(/\/$/, '') === reference.pathname.replace(/\/$/, '');
      });
      result = { candidateCount: candidates.length, referenceMatch };
    } else {
      const { assessment, sources } = await assessSingleClaim({
        model: route.model, apiKey, request, reserve: async () => {},
        articleUrl: 'https://example.org/synthetic-article', articleTitle: 'Synthetic benchmark article',
        claim: { id: fixture.id, statement: fixture.statement, central: true },
        evidence: [{ id: 'reference', claimId: fixture.id, title: 'Benchmark reference', publisher: null, url: fixture.reference,
          publishedAt: null, retrievedAt: new Date('2026-11-13T00:00:00Z'), content: fixture.excerpt }],
      });
      result = { expected: fixture.verdict, verdict: assessment.verdict, score: assessment.score,
        match: assessment.verdict === fixture.verdict, verifiedCitations: sources.length,
        citationRelationships: sources.map(source => source.relationship) };
    }
  } catch (error) {
    result = { error: error instanceof FactCheckFailure ? error.code : 'request_failed' };
  }
  console.log(JSON.stringify({ ...base, ...result, elapsedMs: Date.now() - started, ...usage }));
}

async function main() {
  const cases = routes.flatMap(route => fixtures.flatMap<BenchmarkCase>(fixture => {
    if ('baseline' in route) return fixture.hard ? [{ route, fixture, stage: 'score' }] : [];
    return [
      { route, fixture, stage: 'score' as const },
      ...(fixture.search ? [{ route, fixture, stage: 'search' as const }] : []),
    ];
  }));
  const [mode = '--plan', filter, ...extra] = process.argv.slice(2);
  if (!['--plan', '--run'].includes(mode) || (filter && !['--glm-regressions', '--glm-moon-context'].includes(filter)) || extra.length) {
    throw new Error('Use --plan or --run, optionally followed by --glm-regressions or --glm-moon-context');
  }
  const fixtureIds = new Set(filter === '--glm-moon-context' ? ['moon-context'] : ['mercury', 'jupiter', 'moon-context']);
  const selected = filter
    ? cases.filter(({ route, fixture, stage }) => route.model === PINNED_GLM_53 && stage === 'score' && fixtureIds.has(fixture.id))
    : cases;
  if (mode === '--plan') {
    console.log(JSON.stringify({ maxRunUsd, requests: selected.length, cases: selected.map(({ route, fixture, stage }) => ({ model: route.model, fixture: fixture.id, stage })) }, null, 2));
    return;
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('Export OPENROUTER_API_KEY in the shell before using --run');
  for (const { route, fixture, stage } of selected) await runCase(route, fixture, stage, apiKey);
  console.log(JSON.stringify({ reservedUsd, maxRunUsd }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Benchmark failed');
  process.exitCode = 1;
});
