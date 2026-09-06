/** The build orchestrator against the throwaway Postgres with fake Beehiiv, picker, writer and news. */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { FmpMarketNewsItem } from "../lib/api/fmp";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = /test/.test(url);

before(() => {
  if (enabled) process.env.DATABASE_URL = url;
});

const DATE = "2099-01-05"; // a Monday far in the future, so real rows never collide
const news: FmpMarketNewsItem[] = [
  { symbol: "NVDA", title: "Nvidia beats", publisher: "Reuters", site: "reuters.com", publishedDate: "2099-01-05 09:00:00", snippet: "", url: "https://www.reuters.com/a" },
  { symbol: "NVDA", title: "Nvidia guidance", publisher: "CNBC", site: "cnbc.com", publishedDate: "2099-01-05 08:00:00", snippet: "", url: "https://www.cnbc.com/a" },
  { symbol: "LULU", title: "Lululemon falls", publisher: "Bloomberg", site: "bloomberg.com", publishedDate: "2099-01-04 20:00:00", snippet: "", url: "https://www.bloomberg.com/a" },
  { symbol: "AMD", title: "AMD deal", publisher: "Reuters", site: "reuters.com", publishedDate: "2099-01-05 07:00:00", snippet: "", url: "https://www.reuters.com/b" },
];
const NOW = new Date("2099-01-05T11:00:00Z");

const paragraph = (ticker: string, i: number) =>
  `${ticker} was the name every desk was talking about on Monday morning, and Reuters led its coverage with the numbers behind the move number ${i + 1}. ` +
  `CNBC followed with a look at what management said on the call, quoting two analysts who had been skeptical going in. ` +
  `Both outlets flagged the same open question for the next quarter, which is where the story for ${ticker} goes from here.`;
const raw = (ticker: string, extra = "") => `HEADLINE: ${ticker} did a thing${extra}
SUBTITLE: A deck.
SUBJECT: ${ticker} did a thing
PREVIEW: Preview text.
SOURCE: Reuters | https://www.reuters.com/${ticker}
SOURCE: CNBC | https://www.cnbc.com/${ticker}
BODY:
${Array.from({ length: 7 }, (_, i) => paragraph(ticker, i)).join("\n\n")}`;

/** Slot 1 → NVDA, slot 2 → LULU, whichever slots are requested. */
const fakePicker = { async pick(input: { slots: number[] }) { const t: Record<number, string> = { 1: "NVDA", 2: "LULU" }; return { picks: input.slots.map((slot) => ({ slot, ticker: t[slot], companyName: t[slot], eventSummary: `${t[slot]} event on ${DATE}`, eventSlug: "event", whyNow: "", seedUrls: [] })), usage: { inputTokens: 1000, outputTokens: 100, webSearches: 0 }, raw: "" }; } };
const goodWriter = { async write(pick: { ticker: string }) { return { raw: raw(pick.ticker), usage: { inputTokens: 5000, outputTokens: 800, webSearches: 3 }, stopReason: "end_turn" }; } };

const AD = `<table style="border:1px solid #E5E0D5; background-color:#FAF8F3;"><tr><td><a href="https://sponsor.example.com/x">Sponsor</a></td></tr></table>`;
const tsiAds = async () => ({
  bySlot: new Map([[1 as const, { post: { id: "post_si1", title: "01/04/2099 - #1 - Wyatt (Gold / V3)", status: "confirmed", publish_date: 1 }, title: { dateKey: "2099-01-04", kind: "newsletter" as const, number: 1, advertisers: [{ name: "Wyatt", creative: "Gold / V3" }] }, ads: [{ index: 1, html: AD, linkCount: 1, isHouseAd: false, empty: false }, { index: 2, html: AD, linkCount: 1, isHouseAd: false, empty: false }], contentSource: "email" as const }]]),
  warnings: ["No Smart Investor newsletter #2 found for 2099-01-04"],
});

const beehiiv = () => {
  const calls: { url: string; body: unknown }[] = [];
  let n = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ data: { id: `post_fsa_${++n}`, preview_url: "https://app.beehiiv.com/p" } }), { status: 201 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};

test("buildDailyIssues drafts both slots, records rows, skips on rerun, and rebuilds on force", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { buildDailyIssues } = await import("../lib/newsletter/build");
  const { loadExclusions } = await import("../lib/newsletter/topics");
  await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
  await prisma.appSetting.deleteMany({ where: { key: "newsletterBuildPaused" } });
  try {
    const bh = beehiiv();
    const r = await buildDailyIssues({ dateKey: DATE }, { db: prisma, fetchImpl: bh.fetchImpl, picker: fakePicker, writer: goodWriter, news: async () => news, tsiAds, now: NOW });
    assert.deepEqual(r.slots.map((s) => [s.slot, s.status, s.ticker, s.adsFound]), [[1, "drafted", "NVDA", 2], [2, "drafted", "LULU", 0]]);
    assert.equal(bh.calls.length, 2, "one create per slot");
    assert.match(bh.calls[0].url, /\/publications\/pub_[^/]+\/posts$/);
    const created = bh.calls.map((c) => c.body as { title: string; status: string; blocks: { type: string; html?: string }[] });
    assert.ok(created.some((c) => c.title === "NVDA did a thing" && c.blocks.filter((b) => b.type === "html" && b.html === AD).length === 2));
    assert.ok(created.every((c) => c.status === "draft"));
    assert.ok(r.warnings.some((w) => /#2 found/.test(w)));
    assert.ok(r.totalCostUsd > 0);

    const rows = await prisma.newsletterIssue.findMany({ where: { issueDate: DATE }, orderBy: { slot: "asc" } });
    assert.match(rows[0].beehiivPostId ?? "", /^post_fsa_[12]$/, "slots build in parallel, so either id");
    assert.notEqual(rows[0].beehiivPostId, rows[1].beehiivPostId);
    assert.equal(rows[0].tsiAdvertisers, "Wyatt (Gold / V3)");
    assert.equal(rows[0].webSearches, 3);
    assert.equal(rows[1].adsFound, 0);
    assert.equal(rows[1].tsiPostId, null);
    assert.match(rows[0].articleText ?? "", /NVDA was the name every desk/);

    // Second run: nothing to do.
    const again = await buildDailyIssues({ dateKey: DATE }, { db: prisma, fetchImpl: bh.fetchImpl, picker: fakePicker, writer: goodWriter, news: async () => news, tsiAds, now: NOW });
    assert.ok(again.slots.every((s) => s.skipped));
    assert.equal(bh.calls.length, 2);

    // The next day, both tickers are on cooldown and both events are listed.
    const ex = await loadExclusions(prisma, "2099-01-06");
    assert.deepEqual(ex.recentTickers.sort(), ["LULU", "NVDA"]);
    assert.equal(ex.recentEvents.length, 2);
    // Ignoring today's slot 1 drops its ticker from the cooldown list.
    assert.deepEqual((await loadExclusions(prisma, DATE, [{ issueDate: DATE, slot: 1 }])).recentTickers, ["LULU"]);

    // Force rebuild of slot 2 only: a new draft, row overwritten and marked forced, slot 1 untouched.
    const forced = await buildDailyIssues({ dateKey: DATE, slots: [2], force: true }, { db: prisma, fetchImpl: bh.fetchImpl, picker: { async pick(i) { const p = await fakePicker.pick(i); return { ...p, picks: p.picks.map((x) => ({ ...x, ticker: "AMD", companyName: "AMD" })) }; } }, writer: goodWriter, news: async () => news, tsiAds, now: NOW });
    assert.equal(forced.slots[0].status, "drafted");
    assert.equal(forced.slots[0].ticker, "AMD");
    assert.equal(bh.calls.length, 3);
    const slot2 = await prisma.newsletterIssue.findUnique({ where: { issueDate_slot: { issueDate: DATE, slot: 2 } } });
    assert.equal(slot2?.ticker, "AMD");
    assert.equal(slot2?.forced, true);
    assert.equal(slot2?.beehiivPostId, "post_fsa_3");
    assert.equal((await prisma.newsletterIssue.count({ where: { issueDate: DATE } })), 2);
  } finally {
    await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
    await prisma.$disconnect();
  }
});

test("a failing writer on one slot leaves the other drafted; twice-invalid text becomes needs_review with a [REVIEW] draft", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { buildDailyIssues } = await import("../lib/newsletter/build");
  await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
  try {
    const bh = beehiiv();
    const writer = { async write(pick: { ticker: string }) { if (pick.ticker === "LULU") throw new Error("model exploded"); return goodWriter.write(pick); } };
    const r = await buildDailyIssues({ dateKey: DATE }, { db: prisma, fetchImpl: bh.fetchImpl, picker: fakePicker, writer, news: async () => news, tsiAds, now: NOW });
    assert.equal(r.slots[0].status, "drafted");
    assert.equal(r.slots[1].status, "failed");
    assert.match(r.slots[1].error ?? "", /model exploded/);
    assert.equal(bh.calls.length, 1);
    const failed = await prisma.newsletterIssue.findUnique({ where: { issueDate_slot: { issueDate: DATE, slot: 2 } } });
    assert.equal(failed?.status, "failed");
    assert.match(failed?.error ?? "", /2 attempt/);

    // A failed slot is rebuilt on the next plain run (no force needed), this time with text that never passes validation.
    const banned = { async write(pick: { ticker: string }) { return { raw: raw(pick.ticker, " with a secret"), usage: { inputTokens: 1, outputTokens: 1, webSearches: 0 }, stopReason: "end_turn" }; } };
    const r2 = await buildDailyIssues({ dateKey: DATE }, { db: prisma, fetchImpl: bh.fetchImpl, picker: fakePicker, writer: banned, news: async () => news, tsiAds, now: NOW });
    const s2 = r2.slots.find((s) => s.slot === 2)!;
    assert.equal(s2.status, "needs_review");
    assert.match(s2.reviewReason ?? "", /banned phrase "secret"/);
    assert.ok(s2.beehiivPostId);
    assert.equal((bh.calls[bh.calls.length - 1].body as { title: string }).title, "[REVIEW] LULU did a thing with a secret");
    assert.equal(r2.slots.find((s) => s.slot === 1)?.skipped, true);
  } finally {
    await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
    await prisma.$disconnect();
  }
});

test("the pause setting stops a plain run but not a forced one; dry runs write nothing to Beehiiv", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { buildDailyIssues } = await import("../lib/newsletter/build");
  await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
  await prisma.appSetting.upsert({ where: { key: "newsletterBuildPaused" }, create: { key: "newsletterBuildPaused", value: "1" }, update: { value: "1" } });
  try {
    const bh = beehiiv();
    const paused = await buildDailyIssues({ dateKey: DATE }, { db: prisma, fetchImpl: bh.fetchImpl, picker: fakePicker, writer: goodWriter, news: async () => news, tsiAds, now: NOW });
    assert.equal(paused.paused, true);
    assert.equal(paused.slots.length, 0);
    const dry = await buildDailyIssues({ dateKey: DATE, force: true }, { db: prisma, fetchImpl: bh.fetchImpl, picker: fakePicker, writer: goodWriter, news: async () => news, tsiAds, now: NOW, dry: true });
    assert.equal(dry.paused, false);
    assert.equal(bh.calls.length, 0);
    assert.ok(dry.slots.every((s) => s.status === "drafted" && s.body && !s.beehiivPostId));
    assert.equal(await prisma.newsletterIssue.count({ where: { issueDate: DATE } }), 0, "a dry run leaves no rows, so the real run is not skipped");
  } finally {
    await prisma.appSetting.deleteMany({ where: { key: "newsletterBuildPaused" } });
    await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
    await prisma.$disconnect();
  }
});
