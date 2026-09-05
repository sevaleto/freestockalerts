/**
 * Integration tests against a throwaway Postgres (never production):
 *   createdb freestockalerts_test
 *   DATABASE_URL=postgresql://localhost:5432/freestockalerts_test DIRECT_URL=$DATABASE_URL npx prisma db push
 *   npm run test:db
 * Skipped when TEST_DATABASE_URL is unset or does not contain "test".
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { seedTemplates, seedStrategy } from "../lib/templates/seed";
import { STRATEGIES, getStrategy } from "../lib/templates/catalog";
import { activateTemplateForUser, TemplateNotFoundError, AlertLimitError } from "../lib/templates/activate";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = /test/.test(url);
const prisma = enabled ? new PrismaClient({ datasourceUrl: url }) : (null as unknown as PrismaClient);

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "seed-test@example.com" };

before(async () => {
  if (!enabled) return;
  await prisma.$executeRawUnsafe('TRUNCATE "AlertHistory", "Alert", "TemplateSubscription", "TemplateItem", "AlertTemplate", "UserPreferences", "User" CASCADE');
  await prisma.user.create({ data: USER });
  // A pre-redesign template with a user's live alerts attached to it.
  const legacy = await prisma.alertTemplate.create({
    data: {
      slug: "turnaround-signals",
      name: "Turnaround Signals",
      description: "old",
      category: "MOMENTUM",
      isActive: true,
      isFeatured: true,
      items: { create: [{ ticker: "BA", alertType: "SMA_CROSS_ABOVE", triggerValue: 200, triggerDirection: "ABOVE", sortOrder: 1 }] },
    },
  });
  await prisma.alert.create({
    data: { userId: USER.id, ticker: "BA", alertType: "SMA_CROSS_ABOVE", triggerValue: 200, triggerDirection: "ABOVE", templateId: legacy.id },
  });
  await prisma.templateSubscription.create({ data: { userId: USER.id, templateId: legacy.id } });
});

after(async () => {
  if (enabled) await prisma.$disconnect();
});

test("seed is idempotent and retires legacy templates without touching their alerts", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const first = await seedTemplates(prisma, STRATEGIES, new Date("2026-09-05T00:00:00Z"));
  assert.equal(first.upserted.length, STRATEGIES.length);
  assert.deepEqual(first.retired, ["turnaround-signals"]);

  const second = await seedTemplates(prisma, STRATEGIES, new Date("2026-09-06T00:00:00Z"));
  assert.deepEqual(second.upserted, first.upserted);
  assert.deepEqual(second.retired, ["turnaround-signals"]);

  const templates = await prisma.alertTemplate.findMany({ include: { items: true } });
  assert.equal(templates.length, STRATEGIES.length + 1, "current + 1 retired");
  const active = templates.filter((t) => t.isActive);
  assert.equal(active.length, STRATEGIES.length);
  for (const t of active) {
    const s = getStrategy(t.slug)!;
    assert.equal(t.items.length, s.items.length, t.slug);
    assert.equal(t.section, s.section);
    assert.equal(t.version, s.version);
    assert.equal(t.refreshCadence, s.refreshCadence);
    assert.ok(t.lastRefreshedAt, `${t.slug} lastRefreshedAt`);
    assert.equal(t.triggerSummary, s.triggerSummary);
  }

  const retired = templates.find((t) => t.slug === "turnaround-signals")!;
  assert.equal(retired.isActive, false);
  assert.equal(retired.replacedBySlug, "200-day-comeback-watchlist");
  assert.equal(retired.retiredAt?.toISOString(), "2026-09-05T00:00:00.000Z", "retiredAt is kept from the first run");
  assert.equal(retired.items.length, 1, "retired template keeps its items");

  const legacyAlerts = await prisma.alert.findMany({ where: { userId: USER.id, templateId: retired.id } });
  assert.equal(legacyAlerts.length, 1, "existing user alerts are preserved");
  assert.equal(legacyAlerts[0].isActive, true);
});

test("activation via a legacy slug lands on the replacement and never duplicates", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const first = await activateTemplateForUser(USER.id, "turnaround-signals", prisma);
  assert.equal(first.template.slug, "200-day-comeback-watchlist");
  assert.equal(first.created, 10);
  assert.equal(first.alreadyActive, false);

  const again = await activateTemplateForUser(USER.id, "200-day-comeback-watchlist", prisma);
  assert.equal(again.created, 0);
  assert.equal(again.alreadyActive, true);
  assert.equal(again.alerts.length, 10);

  const count = await prisma.alert.count({ where: { userId: USER.id, templateId: first.template.id } });
  assert.equal(count, 10, "no duplicate alerts after a second activation");
  const subs = await prisma.templateSubscription.findMany({ where: { userId: USER.id, templateId: first.template.id } });
  assert.equal(subs.length, 1);
  assert.equal(subs[0].isActive, true);

  // Alerts carry the catalog's trigger and note.
  const alerts = await prisma.alert.findMany({ where: { userId: USER.id, templateId: first.template.id }, orderBy: { createdAt: "asc" } });
  const s = getStrategy("200-day-comeback-watchlist")!;
  assert.deepEqual(alerts.map((a) => `${a.ticker}|${a.alertType}|${a.triggerValue}`).sort(), s.items.map((i) => `${i.ticker}|${i.alertType}|${i.triggerValue}`).sort());
  assert.ok(alerts.every((a) => a.note && a.note.length > 20));
});

test("a catalog strategy missing from the database is seeded on first activation", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  await prisma.alertTemplate.delete({ where: { slug: "market-stress-alerts" } });
  const result = await activateTemplateForUser(USER.id, "market-stress-alerts", prisma);
  assert.equal(result.created, 10);
  const row = await prisma.alertTemplate.findUnique({ where: { slug: "market-stress-alerts" }, include: { items: true } });
  assert.ok(row?.isActive);
  assert.equal(row!.items.length, 10);
  assert.ok(row!.items.some((i) => i.ticker === "^VIX"));
});

test("unknown slugs throw TemplateNotFoundError; the alert limit is enforced", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  await assert.rejects(activateTemplateForUser(USER.id, "no-such-strategy", prisma), TemplateNotFoundError);
  await prisma.user.update({ where: { id: USER.id }, data: { maxAlerts: 25 } });
  await assert.rejects(activateTemplateForUser(USER.id, "sector-leadership-radar", prisma), AlertLimitError);
  await prisma.user.update({ where: { id: USER.id }, data: { maxAlerts: 50 } });
});

test("re-seeding a strategy with an empty list leaves activation with nothing to create (degrades, does not fail)", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const s = getStrategy("quality-breakout-radar")!;
  await seedStrategy(prisma, { ...s, items: [] });
  const result = await activateTemplateForUser(USER.id, "quality-breakout-radar", prisma);
  assert.equal(result.created, 0);
  assert.equal(result.alerts.length, 0);
  await seedStrategy(prisma, s); // restore
  const restored = await prisma.templateItem.count({ where: { template: { slug: s.slug } } });
  assert.equal(restored, 10);
});
