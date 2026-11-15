export const FACT_CHECK_METHODOLOGY_VERSION = '2';

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

const bands = [
  { verdict: 'false', min: 1, max: 1, label: 'False', meaning: 'The evidence directly refutes the central assertion.' },
  { verdict: 'mostly-false', min: 2, max: 4, label: 'Mostly false', meaning: 'The evidence refutes the main point, though some details are accurate.' },
  { verdict: 'mixed', min: 5, max: 6, label: 'Mixed', meaning: 'The evidence establishes material parts as accurate and other material parts as inaccurate or misleading.' },
  { verdict: 'mostly-supported', min: 7, max: 8, label: 'Mostly true', meaning: 'The main point is supported, with a material caveat or error.' },
  { verdict: 'supported', min: 9, max: 10, label: 'True', meaning: 'The evidence supports the central assertion. Reserve 10 for full support without material caveats.' },
] as const;

export type ClaimVerdict = typeof bands[number]['verdict'] | 'unverified';

function findVerdict(score: number | null): ClaimVerdict | undefined {
  if (score === null) return 'unverified';
  if (Number.isInteger(score)) return bands.find(band => score >= band.min && score <= band.max)?.verdict;
  return undefined;
}

export function verdictForScore(score: number | null): ClaimVerdict {
  const verdict = findVerdict(score);
  if (!verdict) throw new RangeError('Expected a whole-number score from 1 to 10 or null');
  return verdict;
}

export function scoreMatchesVerdict(score: number | null, verdict: string | null): boolean {
  const expected = findVerdict(score);
  return expected !== undefined && expected === verdict;
}

export const SCORING_INSTRUCTIONS = [
  'Return a whole-number score from 1 (false) to 10 (true) using the bands below. The application derives the verdict from this score. The score measures how well the claim holds up against the evidence. Express confidence separately.',
  ...bands.map(({ verdict, min, max, meaning }) => `${min === max ? min : `${min}–${max}`} = ${verdict}. ${meaning}`),
  'Return null for unverified when there is too little evidence to judge or credible evidence conflicts and cannot be resolved. Do not use a middle score as a substitute for uncertainty.',
].join('\n');

export const SCORE_RUBRIC = bands.map(({ min, max, label }) => `${min === max ? min : `${min}–${max}`} ${label}`).join(' · ');
