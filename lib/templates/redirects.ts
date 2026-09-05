/**
 * Slugs that used to exist and where they went. Pure data so it can be used by
 * server pages (permanent redirects), API routes (resolve before lookup) and
 * the seed (retire the old row, point it at its replacement).
 *
 * Old rows are never deleted: user alerts reference AlertTemplate.id, and a
 * retired template keeps that reference intact.
 */
export const LEGACY_TEMPLATE_SLUGS: Record<string, string> = {
  "earnings-season-alerts": "earnings-calendar-alerts",
  "buffett-style-value-watchlist": "quality-compounders-on-pullback",
  "momentum-breakout-alerts": "quality-breakout-radar",
  "dividend-income-watchlist": "dividend-growth-buy-zones",
  "market-fear-greed-signals": "market-stress-alerts",
  "turnaround-signals": "200-day-comeback-watchlist",
  "oversold-bounce-leaders": "leader-pullback-and-reclaim",
  "sector-rotation-radar": "sector-leadership-radar",
};

export const isLegacyTemplateSlug = (slug: string): boolean =>
  Object.prototype.hasOwnProperty.call(LEGACY_TEMPLATE_SLUGS, slug);

/** Follow the redirect chain (bounded) so a slug always resolves to a current one. */
export function resolveTemplateSlug(slug: string): string {
  let current = slug;
  for (let i = 0; i < 5 && isLegacyTemplateSlug(current); i++) current = LEGACY_TEMPLATE_SLUGS[current];
  return current;
}
