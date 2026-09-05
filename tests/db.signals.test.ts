/** Signal idempotency and delivery dedupe against the throwaway Postgres (see db.templates.test.ts). */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createSignalIfNew, type SignalDraft } from "../lib/strategies/scan";
import { INSIDER_SLUG } from "../lib/strategies/config";
import { seedTemplates } from "../lib/templates/seed";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = /test/.test(url);
const prisma = enabled ? new PrismaClient({ datasourceUrl: url }) : (null as unknown as PrismaClient);
const NOW = new Date("2026-09-05T21:40:00Z");
const USER = { id: "22222222-2222-4222-8222-222222222222", email: "signal-test@example.com" };

const draft = (over: Partial<SignalDraft> = {}): SignalDraft => ({
  strategySlug: INSIDER_SLUG,
  symbol: "XYZ",
  companyName: "Example Co.",
  signalKey: "insider:XYZ:0001193125-26-384028|XYZ|0001|2026-08-25|P|10000|25",
  score: 4,
  price: 30,
  confirmation: "breakout",
  explanation: "Jane Doe, CEO, purchased approximately 10,000 shares worth $250,000.",
  payload: { purchases: [], distinctInsiders: 1, totalValue: 250000, source: "test" },
  dataAsOf: NOW,
  ...over,
});

/** Only this test's rows are touched, so a local scan's real signals survive a test run. */
const cleanup = async () => {
  await prisma.strategySignal.deleteMany({ where: { symbol: "XYZ" } });
  await prisma.user.deleteMany({ where: { email: USER.email } });
};

before(async () => {
  if (!enabled) return;
  await cleanup();
  await prisma.user.create({ data: USER });
  await seedTemplates(prisma);
});

after(async () => {
  if (!enabled) return;
  await cleanup();
  await prisma.$disconnect();
});

test("the same event creates one signal; a re-run creates nothing", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const first = await createSignalIfNew(prisma, draft(), 14, NOW);
  assert.ok(first.row);
  const again = await createSignalIfNew(prisma, draft(), 14, NOW);
  assert.equal(again.skipped, "already signaled (same event)");
  assert.equal(await prisma.strategySignal.count({ where: { symbol: "XYZ" } }), 1);
});

test("a new event for the same symbol inside the cooldown is skipped, after it is created", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const later = new Date(NOW.getTime() + 3 * 86_400_000);
  const inside = await createSignalIfNew(prisma, draft({ signalKey: "insider:XYZ:other-filing" }), 14, later);
  assert.match(inside.skipped ?? "", /cooldown/);
  const afterCooldown = new Date(NOW.getTime() + 20 * 86_400_000);
  const out = await createSignalIfNew(prisma, draft({ signalKey: "insider:XYZ:other-filing" }), 14, afterCooldown);
  assert.ok(out.row);
});

test("delivery rows are unique per signal and user, so overlapping runs cannot email twice", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const signal = await prisma.strategySignal.findFirstOrThrow({ where: { symbol: "XYZ" }, orderBy: { createdAt: "asc" } });
  await prisma.signalDelivery.create({ data: { signalId: signal.id, userId: USER.id, emailSent: true } });
  await assert.rejects(prisma.signalDelivery.create({ data: { signalId: signal.id, userId: USER.id, emailSent: true } }), (e: { code?: string }) => e.code === "P2002");
});

test("the signal templates exist and can be subscribed to (activation creates no per-user alerts)", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const t = await prisma.alertTemplate.findUnique({ where: { slug: INSIDER_SLUG }, include: { items: true } });
  assert.ok(t?.isActive);
  assert.equal(t!.items.length, 0);
  assert.equal(t!.section, "IDEA_DISCOVERY");
});
