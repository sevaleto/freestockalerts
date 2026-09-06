/**
 * Split-test results: views come from HeadlineVariant.views (the browser
 * beacon), leads and confirmed signups from User.signupVariant ("<slug>:<key>",
 * written once at signup and never rewritten).
 */
import type { PrismaClient } from "@prisma/client";
import { twoProportionZ, type ProportionTest } from "@/lib/ab/stats";
import type { VariantRecord } from "@/lib/lp/view";

export interface LeadCounts {
  leads: number;
  confirmed: number;
}

export interface VariantStats extends LeadCounts {
  key: string;
  views: number;
  /** Leads per view; null without views. */
  conversion: number | null;
  /** Against variant A (null for A itself or when A is missing). */
  vsControl: ProportionTest | null;
}

/** One pass over User for every page: Map<"<slug>:<key>", counts>. */
export async function leadCountsByTag(db: PrismaClient): Promise<Map<string, LeadCounts>> {
  const [all, confirmed] = await Promise.all([
    db.user.groupBy({ by: ["signupVariant"], where: { signupVariant: { not: null } }, _count: { _all: true } }),
    db.user.groupBy({ by: ["signupVariant"], where: { signupVariant: { not: null }, emailVerified: true }, _count: { _all: true } }),
  ]);
  const map = new Map<string, LeadCounts>();
  for (const row of all) if (row.signupVariant) map.set(row.signupVariant, { leads: row._count._all, confirmed: 0 });
  for (const row of confirmed) {
    if (!row.signupVariant) continue;
    const entry = map.get(row.signupVariant) ?? { leads: 0, confirmed: 0 };
    entry.confirmed = row._count._all;
    map.set(row.signupVariant, entry);
  }
  return map;
}

export function variantStats(slug: string, variants: readonly VariantRecord[], counts: Map<string, LeadCounts>): VariantStats[] {
  const control = variants.find((v) => v.key === "A") ?? variants[0];
  const controlCounts = control ? counts.get(`${slug}:${control.key}`) ?? { leads: 0, confirmed: 0 } : null;
  return variants.map((v) => {
    const c = counts.get(`${slug}:${v.key}`) ?? { leads: 0, confirmed: 0 };
    const vsControl = control && controlCounts && v.key !== control.key ? twoProportionZ(controlCounts.leads, control.views, c.leads, v.views) : null;
    return { key: v.key, views: v.views, leads: c.leads, confirmed: c.confirmed, conversion: v.views > 0 ? c.leads / v.views : null, vsControl };
  });
}

export function pageTotals(stats: readonly VariantStats[]) {
  const views = stats.reduce((n, s) => n + s.views, 0);
  const leads = stats.reduce((n, s) => n + s.leads, 0);
  const confirmed = stats.reduce((n, s) => n + s.confirmed, 0);
  return { views, leads, confirmed, conversion: views > 0 ? leads / views : null };
}

export const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
