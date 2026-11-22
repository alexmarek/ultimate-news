// lib/batches.ts

/** Splits items into consecutive batches of at most `size`; every item appears in exactly one batch. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`batch size must be a positive integer, got ${size}`);
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}
