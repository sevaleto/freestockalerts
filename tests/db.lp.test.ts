/** Landing page seed against the throwaway Postgres: create-if-missing, homepage variants, legacy signupVariant rewrite, view counter. */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = /test/.test(url);

before(() => {
  if (enabled) process.env.DATABASE_URL = url;
});

const EMAIL = "__test_lp__@example.com";

test("seedLandingPages creates missing pages once and folds hero_headline:<key> into home:<key>", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { seedLandingPages, seedRecords } = await import("../lib/lp/seed");
  const slugs = seedRecords().map((r) => r.slug);
  // Start from a clean slate for the seeded slugs so the test owns them.
  await prisma.landingPage.deleteMany({ where: { slug: { in: slugs } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.user.create({ data: { email: EMAIL, signupVariant: "hero_headline:B", signupSource: "hero" } });
  try {
    const first = await seedLandingPages(prisma);
    assert.deepEqual([...first.created].sort(), [...slugs].sort());
    assert.equal(first.existing.length, 0);
    assert.equal(first.rewrittenUsers, 1);

    const home = await prisma.landingPage.findUnique({ where: { slug: "home" }, include: { variants: true } });
    assert.ok(home && home.kind === "HOME" && home.status === "LIVE");
    assert.deepEqual(home!.variants.map((v) => v.key).sort(), ["A", "B", "C"]);
    const radar = await prisma.landingPage.findUnique({ where: { slug: "radar" }, include: { variants: true } });
    assert.ok(radar && radar.templateSlug === "under-the-radar-breakouts" && radar.variants.length === 1);
    assert.equal((await prisma.user.findUnique({ where: { email: EMAIL } }))?.signupVariant, "home:B");

    // An admin edit survives a re-seed.
    await prisma.headlineVariant.updateMany({ where: { pageId: radar!.id, key: "A" }, data: { headline: "Edited by admin" } });
    const second = await seedLandingPages(prisma);
    assert.equal(second.created.length, 0);
    assert.equal(second.existing.length, slugs.length);
    assert.equal(second.rewrittenUsers, 0);
    const again = await prisma.headlineVariant.findFirst({ where: { pageId: radar!.id, key: "A" } });
    assert.equal(again?.headline, "Edited by admin");

    // The view beacon's write: scoped by page slug + key.
    await prisma.headlineVariant.updateMany({ where: { key: "A", page: { slug: "radar" } }, data: { views: { increment: 1 } } });
    assert.equal((await prisma.headlineVariant.findFirst({ where: { pageId: radar!.id, key: "A" } }))?.views, 1);
    assert.equal((await prisma.headlineVariant.findFirst({ where: { pageId: home!.id, key: "A" } }))?.views, 0);
  } finally {
    await prisma.landingPage.deleteMany({ where: { slug: { in: slugs } } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  }
});
