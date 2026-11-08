// Maps Article.primaryArea to the palette colour used for pills, dots and tinted cards.
// Categories come from the database, so anything unknown must fall back instead of breaking.

import type { CSSProperties } from 'react';

/** The five palette colours (same values as the CSS variables in app/globals.css). */
export const PALETTE_HEX = {
  sage: '#CCD5AE',
  beige: '#E9EDC9',
  cornsilk: '#FEFAE0',
  papaya: '#FAEDCD',
  bronze: '#D4A373',
} as const;

type CategoryKey = 'world' | 'environment' | 'business' | 'tech' | 'science' | 'travel' | 'sport' | 'fallback';

const CATEGORY_HEX: Record<CategoryKey, string> = {
  world: PALETTE_HEX.sage,
  environment: PALETTE_HEX.sage,
  business: PALETTE_HEX.papaya,
  tech: PALETTE_HEX.beige,
  science: PALETTE_HEX.beige,
  travel: PALETTE_HEX.bronze,
  sport: PALETTE_HEX.bronze,
  fallback: PALETTE_HEX.beige,
};

// Stored names (lib/types.ts AREAS) and a few spellings of them -> colour key.
// Music and Positive News are deliberately not listed: they use the fallback.
const ALIASES: Record<string, CategoryKey> = {
  'world news': 'world',
  world: 'world',
  environment: 'environment',
  business: 'business',
  technology: 'tech',
  tech: 'tech',
  science: 'science',
  travel: 'travel',
  sport: 'sport',
  sports: 'sport',
};

// Long stored names -> the short form shown in tags and count chips.
const SHORT_LABELS: Record<string, string> = {
  'world news': 'World',
  technology: 'Tech',
};

function keyFor(area: string | null | undefined): CategoryKey {
  if (!area) return 'fallback';
  return ALIASES[area.trim().toLowerCase()] ?? 'fallback';
}

/** CSS custom property name for the category, e.g. `--cat-world`. Unknown categories get `--cat-fallback`. */
export function categoryColorVar(area: string | null | undefined): string {
  return `--cat-${keyFor(area)}`;
}

/** `var(--cat-world)` etc., for use in a CSS value. */
export function categoryColor(area: string | null | undefined): string {
  return `var(${categoryColorVar(area)})`;
}

/** Hex value of the category colour, for places that can't use CSS variables (SVG data URIs). */
export function categoryHex(area: string | null | undefined): string {
  return CATEGORY_HEX[keyFor(area)];
}

/** Inline style that sets `--cat`, which the `.cat-fill`, `.cat-tint` and `.cat-dot` classes read. */
export function categoryStyle(area: string | null | undefined): CSSProperties {
  return { ['--cat' as string]: categoryColor(area) } as CSSProperties;
}

/** Short display form of a category: "World News" -> "World", "Technology" -> "Tech", others unchanged. */
export function categoryShortLabel(area: string | null | undefined): string {
  if (!area) return '';
  const trimmed = area.trim();
  return SHORT_LABELS[trimmed.toLowerCase()] ?? trimmed;
}
