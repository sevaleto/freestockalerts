/** Ad serving against the throwaway Postgres: impressions are counted and rotation is fair. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = /test/.test(url);

before(() => {
  if (enabled) process.env.DATABASE_URL = url;
});

const NAME_PREFIX = "__test_ad__";

test("serveEmailAd rotates active ads, counts impressions, and returns null when nothing is active", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { serveEmailAd } = await import("../lib/ads/serve");
  const { prisma: appPrisma } = await import("../lib/prisma/client");
  await prisma.emailAd.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  // Park any real local ads so only the test rows are servable.
  const parked = await prisma.emailAd.findMany({ where: { status: "active" }, select: { id: true } });
  await prisma.emailAd.updateMany({ where: { id: { in: parked.map((p) => p.id) } }, data: { status: "paused" } });
  try {
    assert.equal(await serveEmailAd(), null, "no active ads → no snippet");

    const common = { leadIn: "Special Report", headline: "H", headlineColor: "#1a2b5c", body: "B", ctaText: "Go", ctaUrl: "https://example.com/x" };
    const a = await prisma.emailAd.create({ data: { ...common, name: `${NAME_PREFIX}a`, weight: 1 } });
    const b = await prisma.emailAd.create({ data: { ...common, name: `${NAME_PREFIX}b`, weight: 2 } });
    await prisma.emailAd.create({ data: { ...common, name: `${NAME_PREFIX}paused`, status: "paused" } });

    const served: string[] = [];
    for (let i = 0; i < 6; i++) {
      const s = await serveEmailAd({ now: new Date(Date.UTC(2026, 8, 5, 21, 40, i)) });
      assert.ok(s);
      if (!s) return;
      assert.match(s.html, new RegExp(`/api/ads/click/${s.id}`));
      served.push(s.id);
    }
    assert.equal(served.filter((id) => id === a.id).length, 2);
    assert.equal(served.filter((id) => id === b.id).length, 4);
    const rows = await prisma.emailAd.findMany({ where: { name: { startsWith: NAME_PREFIX } } });
    assert.deepEqual(
      Object.fromEntries(rows.map((r) => [r.name.slice(NAME_PREFIX.length), r.impressions])),
      { a: 2, b: 4, paused: 0 },
    );
    assert.ok(rows.find((r) => r.id === a.id)?.lastShownAt);
  } finally {
    await prisma.emailAd.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.emailAd.updateMany({ where: { id: { in: parked.map((p) => p.id) } }, data: { status: "active" } });
    await appPrisma.$disconnect();
    await prisma.$disconnect();
  }
});

after(() => {});
