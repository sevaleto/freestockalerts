/**
 * Deterministic variant assignment.
 *
 * A visitor's bucket (0..9999, from the `fsa_bucket` cookie) is hashed with
 * the page slug and mapped onto the active variants by weight. The same
 * visitor sees the same variant on every visit to a page as long as the
 * weights do not change, and their assignment on one page says nothing about
 * another page (different salt, different hash).
 *
 * Pure: no cookies, no randomness unless the bucket is missing.
 */

export interface PickableVariant {
  key: string;
  weight: number;
  isActive: boolean;
}

/**
 * 32-bit FNV-1a followed by the murmur3 finalizer. Plain FNV-1a's low bits
 * are weak (its lowest bit is just the parity of the input characters), and
 * `hash % total` reads exactly those bits, so the mix step matters.
 */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export const eligibleVariants = <V extends PickableVariant>(variants: readonly V[]): V[] =>
  variants.filter((v) => v.isActive && Number.isInteger(v.weight) && v.weight > 0);

/**
 * Pick a variant for `bucket` on the page identified by `salt`.
 * Falls back to the first variant when nothing is eligible (so a page with
 * every variant paused still renders) and to a uniform random pick when the
 * bucket is unknown (cookies blocked, bots).
 */
export function pickVariant<V extends PickableVariant>(
  variants: readonly V[],
  bucket: number | null,
  salt: string,
  random: () => number = Math.random
): V | null {
  if (variants.length === 0) return null;
  const pool = eligibleVariants(variants);
  if (pool.length === 0) return variants[0];
  if (pool.length === 1) return pool[0];
  const total = pool.reduce((n, v) => n + v.weight, 0);
  const point = bucket === null ? Math.floor(random() * total) : hash32(`${salt}:${bucket}`) % total;
  let acc = 0;
  for (const v of pool) {
    acc += v.weight;
    if (point < acc) return v;
  }
  return pool[pool.length - 1];
}
