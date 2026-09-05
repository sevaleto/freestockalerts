/**
 * Push the strategy catalog into the AlertTemplate / TemplateItem tables.
 *
 * Idempotent: templates are upserted by slug, items are replaced from the
 * catalog, and retired templates (see lib/templates/redirects.ts) are marked
 * inactive and pointed at their replacement. Nothing is deleted; user alerts
 * reference AlertTemplate.id, and the seed never touches the Alert table.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { STRATEGIES, type StrategyDefinition } from "./catalog";
import { LEGACY_TEMPLATE_SLUGS } from "./redirects";

type Db = PrismaClient | Prisma.TransactionClient;

export interface SeedSummary {
  upserted: string[];
  retired: string[];
  /** Legacy slugs with no row in the database (nothing to retire). */
  absent: string[];
}

const toDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
};

function templateData(s: StrategyDefinition) {
  return {
    name: s.name,
    description: s.description,
    longDescription: s.valueProposition,
    category: s.category,
    iconEmoji: "📊",
    isActive: true,
    isFeatured: s.isFeatured,
    sortOrder: s.sortOrder,
    section: s.section,
    triggerSummary: s.triggerSummary,
    refreshCadence: s.refreshCadence,
    lastRefreshedAt: s.lastRefreshedAt ? toDate(s.lastRefreshedAt) : null,
    version: s.version,
    retiredAt: null,
    replacedBySlug: null,
  };
}

const itemData = (s: StrategyDefinition) =>
  s.items.map((item) => ({
    ticker: item.ticker.toUpperCase(),
    companyName: item.companyName,
    alertType: item.alertType,
    triggerValue: item.triggerValue,
    triggerDirection: item.triggerDirection,
    rationale: item.rationale,
    sortOrder: item.sortOrder,
  }));

/** Upsert one strategy and replace its items. Safe to call from a request (used when a template is missing). */
export async function seedStrategy(db: Db, s: StrategyDefinition) {
  const data = templateData(s);
  return db.alertTemplate.upsert({
    where: { slug: s.slug },
    update: { ...data, items: { deleteMany: {}, create: itemData(s) } },
    create: { slug: s.slug, ...data, items: { create: itemData(s) } },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

/** Mark a legacy template retired without touching its items or anyone's alerts. */
export async function retireLegacyTemplate(db: Db, slug: string, replacedBySlug: string, now = new Date()) {
  const existing = await db.alertTemplate.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!existing) return null;
  return db.alertTemplate.update({
    where: { slug },
    data: {
      isActive: false,
      isFeatured: false,
      retiredAt: existing.retiredAt ?? now,
      replacedBySlug,
    },
  });
}

export async function seedTemplates(db: Db, strategies: StrategyDefinition[] = STRATEGIES, now = new Date()): Promise<SeedSummary> {
  const summary: SeedSummary = { upserted: [], retired: [], absent: [] };
  for (const s of strategies) {
    await seedStrategy(db, s);
    summary.upserted.push(s.slug);
  }
  for (const [legacy, replacement] of Object.entries(LEGACY_TEMPLATE_SLUGS)) {
    const row = await retireLegacyTemplate(db, legacy, replacement, now);
    (row ? summary.retired : summary.absent).push(legacy);
  }
  return summary;
}
