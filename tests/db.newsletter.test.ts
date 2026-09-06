/** The build orchestrator against the throwaway Postgres with fake Beehiiv, writer and facts. */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { IssueFacts } from "../lib/newsletter/facts";
import type { IssuePrompt } from "../lib/newsletter/article";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = /test/.test(url);

before(() => {
  if (enabled) process.env.DATABASE_URL = url;
});

// 2099-01-06 is a Tuesday far in the future, so real rows never collide.
const DATE = "2099-01-06";
const MORNING = new Date("2099-01-06T12:30:00Z"); // 7:30 AM EST
const EVENING = new Date("2099-01-06T21:35:00Z"); // 4:35 PM EST

const facts = async (kind: "morning" | "closing", dateKey: string): Promise<IssueFacts> => ({
  kind,
  dateKey,
  missing: [],
  economic: [],
  earnings: [],
  grades: [],
  news: [],
  treasury: { today: null, previous: null },
  indexes: [],
  gainers: [],
  losers: [],
  actives: [],
  sectors: [],
});

const item = (n: number, t: string) => `${n}. ${t} Reuters reported the figure at 8:30 a.m. ET, and CNBC added that analysts had expected a smaller number, which is why futures moved about 0.4%.`;
const MORNING_BODY = Array.from({ length: 9 }, (_, i) => item(i + 1, `Item ${i + 1} covers a stock moving 3% pre-market on real news.`)).join("\n\n");
const CLOSING_BODY = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1}: the S&P 500 fell 0.4% and the Nasdaq lost 0.6%, per Reuters. CNBC reported that the 10-year yield rose 8 basis points to 4.78%. Lululemon dropped 20% after cutting its outlook, Bloomberg said, while Adobe gained 5% on its new chief executive.`).join("\n\n");

const raw = (kind: "morning" | "closing", extra = "") => `HEADLINE: ${kind === "morning" ? "Nine things to watch before the bell" : "Yields bite and Lululemon breaks"}${extra}
SUBTITLE: A deck.
SUBJECT: ${kind === "morning" ? "Before the bell" : "After the bell"}
PREVIEW: Preview text.
SOURCE: Reuters | https://www.reuters.com/markets/us/2099-01-06-x/
SOURCE: CNBC | https://www.cnbc.com/2099/01/06/x.html
SOURCE: Bloomberg | https://www.bloomberg.com/news/x
BODY:
${kind === "morning" ? MORNING_BODY : CLOSING_BODY}`;

const kindOf = (p: IssuePrompt): "morning" | "closing" => (/pre-market brief/.test(p.system) ? "morning" : "closing");
const goodWriter = { async write(p: IssuePrompt) { return { raw: raw(kindOf(p)), usage: { inputTokens: 5000, outputTokens: 800, webSearches: 3 }, stopReason: "end_turn" }; } };
const holidays = async () => ["2099-01-01"];

const AD = `<table style="border:1px solid #E5E0D5; background-color:#FAF8F3;"><tr><td><a href="https://sponsor.example.com/x">Sponsor</a></td></tr></table>`;
const tsiAds = async () => ({
  bySlot: new Map([[1 as const, { post: { id: "post_si1", title: "01/05/2099 - #1 - Wyatt (Gold / V3)", status: "confirmed", publish_date: 1 }, title: { dateKey: "2099-01-05", kind: "newsletter" as const, number: 1, advertisers: [{ name: "Wyatt", creative: "Gold / V3" }] }, ads: [{ index: 1, html: AD, linkCount: 1, isHouseAd: false, empty: false }, { index: 2, html: AD, linkCount: 1, isHouseAd: false, empty: false }], contentSource: "email" as const }]]),
  warnings: ["No Smart Investor newsletter #2 found for 2099-01-05"],
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

const deps = (prisma: PrismaClient, bh: ReturnType<typeof beehiiv>, now: Date, over: Record<string, unknown> = {}) => ({ db: prisma, fetchImpl: bh.fetchImpl, writer: goodWriter, facts, tsiAds, holidays, now, ...over });

test("the morning cron builds only the brief, the evening cron only the recap; reruns skip; force rebuilds", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { buildDailyIssues } = await import("../lib/newsletter/build");
  await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
  await prisma.appSetting.deleteMany({ where: { key: "newsletterBuildPaused" } });
  try {
    const bh = beehiiv();
    // 7:30 AM: both slots requested (as the plain route would), only the morning brief is in its window.
    const am = await buildDailyIssues({ dateKey: DATE }, deps(prisma, bh, MORNING));
    assert.deepEqual(am.slots.map((s) => [s.slot, s.kind, s.status, s.adsFound]), [[1, "morning", "drafted", 2], [2, "closing", "skipped", 0]]);
    assert.match(am.slots[1].note ?? "", /Closing recap builds from 16:05 ET/);
    assert.equal(bh.calls.length, 1);
    const created = bh.calls[0].body as { title: string; status: string; content_tags: string[]; blocks: { type: string; html?: string; formattedText?: { text: string; styling?: string[] }[] }[] };
    assert.equal(created.title, "Top 9 things to watch Tuesday, January 6", "the brief's headline is fixed");
    assert.equal(created.status, "draft");
    assert.deepEqual(created.content_tags, ["morning-brief"]);
    assert.equal(created.blocks.filter((b) => b.type === "html" && b.html === AD).length, 2, "both Smart Investor ads copied");
    assert.ok(created.blocks.some((b) => b.type === "paragraph" && b.formattedText?.[0].text === "1. " && b.formattedText[0].styling?.includes("bold")), "numbered items get a bold number");
    assert.ok(am.warnings.some((w) => /#2 found/.test(w)));

    // 4:35 PM: the recap builds; the brief is already drafted.
    const pm = await buildDailyIssues({ dateKey: DATE }, deps(prisma, bh, EVENING));
    assert.deepEqual(pm.slots.map((s) => [s.slot, s.status]), [[1, "skipped"], [2, "drafted"]]);
    assert.equal(bh.calls.length, 2);
    assert.deepEqual((bh.calls[1].body as { content_tags: string[] }).content_tags, ["closing-recap"]);

    const rows = await prisma.newsletterIssue.findMany({ where: { issueDate: DATE }, orderBy: { slot: "asc" } });
    assert.equal(rows[0].eventKey, `morning:${DATE}`);
    assert.equal(rows[0].tsiAdvertisers, "Wyatt (Gold / V3)");
    assert.equal(rows[0].webSearches, 3);
    assert.equal(rows[1].adsFound, 0, "no Smart Investor #2 yesterday: placeholders");
    assert.match(rows[1].articleText ?? "", /S&P 500 fell 0.4%/);

    // A slot another run is writing right now is left alone; a stale pending row is rebuilt.
    await prisma.newsletterIssue.update({ where: { issueDate_slot: { issueDate: DATE, slot: 2 } }, data: { status: "pending", beehiivPostId: null, updatedAt: new Date(EVENING.getTime() - 2 * 60_000) } });
    const overlapping = await buildDailyIssues({ dateKey: DATE, slots: [2] }, deps(prisma, bh, EVENING));
    assert.equal(overlapping.slots[0].status, "pending");
    assert.equal(bh.calls.length, 2);
    await prisma.newsletterIssue.update({ where: { issueDate_slot: { issueDate: DATE, slot: 2 } }, data: { updatedAt: new Date(EVENING.getTime() - 30 * 60_000) } });
    const stale = await buildDailyIssues({ dateKey: DATE, slots: [2] }, deps(prisma, bh, EVENING));
    assert.equal(stale.slots[0].status, "drafted");
    assert.equal(bh.calls.length, 3);

    // Force: rebuild the brief in the evening, outside its window.
    const forced = await buildDailyIssues({ dateKey: DATE, slots: [1], force: true }, deps(prisma, bh, EVENING));
    assert.equal(forced.slots[0].status, "drafted");
    assert.equal(bh.calls.length, 4);
    const slot1 = await prisma.newsletterIssue.findUnique({ where: { issueDate_slot: { issueDate: DATE, slot: 1 } } });
    assert.equal(slot1?.forced, true);
    assert.equal(slot1?.beehiivPostId, "post_fsa_4");
    assert.equal(await prisma.newsletterIssue.count({ where: { issueDate: DATE } }), 2);
  } finally {
    await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
    await prisma.$disconnect();
  }
});

test("weekends and NYSE holidays build nothing unless forced", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { buildDailyIssues } = await import("../lib/newsletter/build");
  await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
  try {
    const bh = beehiiv();
    const sat = await buildDailyIssues({ dateKey: "2099-01-03" }, deps(prisma, bh, new Date("2099-01-03T12:30:00Z")));
    assert.ok(sat.slots.every((s) => s.status === "skipped" && /weekends/.test(s.note ?? "")));
    const holiday = await buildDailyIssues({ dateKey: "2099-01-01" }, deps(prisma, bh, new Date("2099-01-01T12:30:00Z")));
    assert.ok(holiday.slots.every((s) => /NYSE holiday/.test(s.note ?? "")));
    assert.equal(bh.calls.length, 0);
    assert.equal(await prisma.newsletterIssue.count({ where: { issueDate: { startsWith: "2099-" } } }), 0, "nothing recorded for skipped days");
    const forcedSat = await buildDailyIssues({ dateKey: "2099-01-03", slots: [1], force: true }, deps(prisma, bh, new Date("2099-01-03T12:30:00Z")));
    assert.equal(forcedSat.slots[0].status, "drafted");
  } finally {
    await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
    await prisma.$disconnect();
  }
});

test("a failing writer leaves the other issue alone; twice-invalid text becomes needs_review with a [REVIEW] draft", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { buildDailyIssues } = await import("../lib/newsletter/build");
  await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
  try {
    const bh = beehiiv();
    const boom = { async write() { throw new Error("model exploded"); } };
    const r = await buildDailyIssues({ dateKey: DATE, slots: [1] }, deps(prisma, bh, MORNING, { writer: boom }));
    assert.equal(r.slots[0].status, "failed");
    assert.match(r.slots[0].error ?? "", /Morning brief failed after 2 attempt\(s\): model exploded/);
    assert.equal(bh.calls.length, 0);

    // The failed slot is rebuilt on the next plain run, this time with text that never passes validation.
    const banned = { async write(p: IssuePrompt) { return { raw: raw(kindOf(p), " with a secret"), usage: { inputTokens: 1, outputTokens: 1, webSearches: 0 }, stopReason: "end_turn" }; } };
    const r2 = await buildDailyIssues({ dateKey: DATE, slots: [1] }, deps(prisma, bh, MORNING, { writer: banned }));
    assert.equal(r2.slots[0].status, "needs_review");
    assert.match(r2.slots[0].reviewReason ?? "", /banned phrase "secret"/);
    assert.ok(r2.slots[0].beehiivPostId);
    assert.equal((bh.calls[0].body as { title: string }).title, "[REVIEW] Top 9 things to watch Tuesday, January 6");
  } finally {
    await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
    await prisma.$disconnect();
  }
});

test("the pause setting stops a plain run but not a forced one; dry runs write nothing", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const { buildDailyIssues } = await import("../lib/newsletter/build");
  await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
  await prisma.appSetting.upsert({ where: { key: "newsletterBuildPaused" }, create: { key: "newsletterBuildPaused", value: "1" }, update: { value: "1" } });
  try {
    const bh = beehiiv();
    const paused = await buildDailyIssues({ dateKey: DATE }, deps(prisma, bh, MORNING));
    assert.equal(paused.paused, true);
    assert.equal(paused.slots.length, 0);
    const dry = await buildDailyIssues({ dateKey: DATE, force: true }, deps(prisma, bh, MORNING, { dry: true }));
    assert.equal(dry.paused, false);
    assert.equal(bh.calls.length, 0);
    assert.ok(dry.slots.every((s) => s.status === "drafted" && s.body && !s.beehiivPostId));
    assert.equal(await prisma.newsletterIssue.count({ where: { issueDate: DATE } }), 0, "a dry run leaves no rows");
  } finally {
    await prisma.appSetting.deleteMany({ where: { key: "newsletterBuildPaused" } });
    await prisma.newsletterIssue.deleteMany({ where: { issueDate: { startsWith: "2099-" } } });
    await prisma.$disconnect();
  }
});
