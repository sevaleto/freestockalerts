/**
 * Assign a visitor to an A/B test variant.
 * Uses cookies so the same visitor always sees the same variant.
 */

import { ABTest } from "./variants";

const COOKIE_PREFIX = "ab_";

export function getVariantFromCookie(testId: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_PREFIX}${testId}=`));
  return match ? match.split("=")[1] : null;
}

export function assignVariant(test: ABTest): string {
  // Check existing assignment
  const existing = getVariantFromCookie(test.id);
  if (existing && test.variants.includes(existing)) return existing;

  // Weighted random assignment
  const rand = Math.random();
  let cumulative = 0;
  let chosen = test.variants[0];
  for (let i = 0; i < test.variants.length; i++) {
    cumulative += test.weights[i];
    if (rand < cumulative) {
      chosen = test.variants[i];
      break;
    }
  }

  // Store in cookie (1 year expiry)
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_PREFIX}${test.id}=${chosen}; path=/; expires=${expires}; SameSite=Lax`;

  return chosen;
}
