/**
 * Fair weighted rotation, pure. The ad with the fewest impressions per unit
 * of weight serves next, so a weight-2 ad gets twice the share of a weight-1
 * ad and nothing is starved. Ties go to the one shown least recently.
 */
export interface RotatableAd {
  id: string;
  status: string;
  weight: number;
  impressions: number;
  startAt: Date | null;
  endAt: Date | null;
  lastShownAt: Date | null;
  createdAt: Date;
}

export function isServable(ad: RotatableAd, now: Date): boolean {
  if (ad.status !== "active") return false;
  if (ad.startAt && ad.startAt.getTime() > now.getTime()) return false;
  if (ad.endAt && ad.endAt.getTime() < now.getTime()) return false;
  return true;
}

export function pickNextAd<T extends RotatableAd>(ads: T[], now = new Date()): T | null {
  const servable = ads.filter((a) => isServable(a, now));
  if (servable.length === 0) return null;
  const share = (a: RotatableAd) => a.impressions / Math.max(1, a.weight);
  return servable.reduce((best, a) => {
    const diff = share(a) - share(best);
    if (diff < 0) return a;
    if (diff > 0) return best;
    const aLast = a.lastShownAt?.getTime() ?? 0;
    const bLast = best.lastShownAt?.getTime() ?? 0;
    if (aLast !== bLast) return aLast < bLast ? a : best;
    return a.createdAt.getTime() < best.createdAt.getTime() ? a : best;
  });
}

/** Servable | scheduled | ended | paused, for the admin list. */
export function adState(ad: RotatableAd, now = new Date()): "serving" | "scheduled" | "ended" | "paused" {
  if (ad.status !== "active") return "paused";
  if (ad.startAt && ad.startAt.getTime() > now.getTime()) return "scheduled";
  if (ad.endAt && ad.endAt.getTime() < now.getTime()) return "ended";
  return "serving";
}
