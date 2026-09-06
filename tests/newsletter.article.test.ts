/** Topic candidates, pick checks, writer output parsing and the compliance validator. Pure. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPicks, extractJson, groupCandidates, normalizeSlots, PickSchema, renderPickerPrompt, type PickInput, type TopicPick } from "../lib/newsletter/topics";
import { parseWriterOutput, renderWriterPrompt, sentenceCount, validateArticle, type Article } from "../lib/newsletter/article";
import { dateKeyWeekday, isDateKey, pacificDateKey, shiftDateKey, toMMDDYYYY, yesterdayPacific } from "../lib/newsletter/dates";
import { NEWSLETTER } from "../lib/newsletter/config";
import { costUsd } from "../lib/newsletter/usage";
import type { FmpMarketNewsItem } from "../lib/api/fmp";

const NOW = new Date("2026-09-08T11:00:00Z"); // Tuesday 4 AM PDT

const row = (symbol: string | null, title: string, publishedDate: string, publisher = "Reuters", url = "https://www.reuters.com/x"): FmpMarketNewsItem => ({ symbol, title, publishedDate, publisher, site: new URL(url).hostname, snippet: "", url });

test("Pacific date keys: 11:00 UTC is the same calendar day in summer and winter, yesterday shifts across months", () => {
  assert.equal(pacificDateKey(new Date("2026-09-08T11:00:00Z")), "2026-09-08");
  assert.equal(pacificDateKey(new Date("2026-12-08T11:00:00Z")), "2026-12-08");
  assert.equal(pacificDateKey(new Date("2026-09-08T05:00:00Z")), "2026-09-07", "10 PM Pacific the night before");
  assert.equal(yesterdayPacific(new Date("2026-10-01T11:00:00Z")), "2026-09-30");
  assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(dateKeyWeekday("2026-09-07"), 1, "Monday");
  assert.equal(dateKeyWeekday("2026-09-06"), 0, "Sunday");
  assert.equal(toMMDDYYYY("2026-09-05"), "09/05/2026");
  assert.equal(isDateKey("2026-09-05"), true);
  assert.equal(isDateKey("2026-13-05"), false);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("nope"), false);
});

test("groupCandidates windows by time, drops cooldown tickers and wire noise, requires coverage, ranks by breadth", () => {
  const rows = [
    row("NVDA", "Nvidia shares jump after earnings", "2026-09-08 09:00:00"),
    row("NVDA", "Nvidia beats estimates", "2026-09-08 08:30:00", "CNBC", "https://www.cnbc.com/a"),
    row("NVDA", "Nvidia beats estimates", "2026-09-08 08:31:00", "CNBC", "https://www.cnbc.com/b"), // duplicate title
    row("LULU", "Lululemon plunges on guidance cut", "2026-09-07 21:00:00", "Bloomberg", "https://www.bloomberg.com/a"),
    row("AAPL", "Apple iPhone event preview", "2026-09-04 12:00:00"), // outside 72h window
    row("TSLA", "Tesla something", "2026-09-08 09:00:00"), // on cooldown
    row("XYZW", "Small cap moves", "2026-09-08 09:00:00", "Blog", "https://blog.example.com/a"), // one non-major story
    row("SUJA", "ROSEN, LEADING TRIAL ATTORNEYS, Encourages Suja Life Investors", "2026-09-08 09:00:00", "Newsfile Corp", "https://www.newsfilecorp.com/a"),
    row("SUJA", "Class action deadline alert", "2026-09-08 09:10:00", "GlobeNewswire", "https://www.globenewswire.com/a"),
    row(null, "Market wrap", "2026-09-08 09:00:00"),
    row("BRK.B", "Berkshire buys more", "2026-09-08 09:00:00"),
    row("nvda", "lowercase symbol still counts", "2026-09-08 07:00:00", "Barron's", "https://www.barrons.com/a"),
  ];
  const c = groupCandidates(rows, { now: NOW, lookbackHours: 72, exclude: new Set(["TSLA"]), limit: 10 });
  assert.deepEqual(
    c.map((x) => x.ticker),
    ["NVDA", "BRK.B", "LULU"],
    "breadth first, then recency"
  );
  assert.equal(c[0].headlines.length, 3, "duplicate title dropped, lowercase symbol merged");
  assert.equal(c[0].publishers, 3);
  assert.equal(c[0].headlines[0].title, "Nvidia shares jump after earnings", "newest first");
  assert.equal(groupCandidates(rows, { now: NOW, lookbackHours: 30, exclude: new Set(), limit: 1 }).length, 1);
});

const input: PickInput = {
  dateKey: "2026-09-08",
  slots: [1, 2],
  exclusions: { recentTickers: ["TSLA"], recentEvents: [{ dateKey: "2026-09-04", ticker: "AAPL", summary: "Apple event" }] },
  candidates: [
    { ticker: "NVDA", publishers: 3, headlines: [{ title: "Nvidia beats", publisher: "Reuters", publishedAt: "2026-09-08 09:00:00", url: "https://r.com/a", snippet: "s" }] },
    { ticker: "LULU", publishers: 2, headlines: [] },
    { ticker: "AMD", publishers: 2, headlines: [] },
  ],
};
const pick = (slot: number, ticker: string, over: Partial<TopicPick> = {}): TopicPick => ({ slot, ticker, companyName: ticker, eventSummary: `${ticker} did a thing on 2026-09-08`, eventSlug: "did-a-thing", whyNow: "", seedUrls: [], ...over });

test("checkPicks enforces slots, distinct tickers, candidate membership, cooldown and slug shape", () => {
  assert.deepEqual(checkPicks([pick(1, "NVDA"), pick(2, "LULU")], input), { ok: true });
  assert.match((checkPicks([pick(1, "NVDA")], input) as { reason: string }).reason, /no pick for slot 2/);
  assert.match((checkPicks([pick(1, "NVDA"), pick(2, "NVDA")], input) as { reason: string }).reason, /two slots/);
  assert.match((checkPicks([pick(1, "NVDA"), pick(2, "MSFT")], input) as { reason: string }).reason, /not in the candidate list/);
  assert.match((checkPicks([pick(1, "NVDA"), pick(2, "TSLA")], { ...input, candidates: [...input.candidates, { ticker: "TSLA", publishers: 1, headlines: [] }] }) as { reason: string }).reason, /cooldown/);
  assert.match((checkPicks([pick(1, "NVDA"), pick(3, "LULU")], input) as { reason: string }).reason, /not requested/);
  assert.match((checkPicks([pick(1, "NVDA"), pick(2, "LULU", { eventSlug: "Bad Slug" })], input) as { reason: string }).reason, /kebab-case/);
});

test("normalizeSlots renumbers a lone pick to the requested slot but leaves correct or ambiguous answers alone", () => {
  assert.deepEqual(normalizeSlots([pick(1, "LULU")], [2]).map((p) => p.slot), [2], "rebuilding slot 2 only: the model said slot 1");
  assert.deepEqual(normalizeSlots([pick(1, "NVDA"), pick(2, "LULU")], [1, 2]).map((p) => p.slot), [1, 2]);
  assert.deepEqual(normalizeSlots([pick(1, "NVDA"), pick(1, "LULU")], [1, 2]).map((p) => [p.slot, p.ticker]), [[1, "NVDA"], [2, "LULU"]], "duplicate numbers get assigned in order");
  assert.deepEqual(normalizeSlots([pick(1, "NVDA")], [1, 2]).map((p) => p.slot), [1], "a missing pick is left for checkPicks to reject");
  assert.match(renderPickerPrompt({ ...input, slots: [2] }), /one pick, "slot": 2/);
});

test("extractJson tolerates fences and prose; PickSchema fills defaults", () => {
  const parsed = PickSchema.parse(extractJson('Here you go:\n```json\n{"picks":[{"slot":1,"ticker":"nvda","companyName":"Nvidia","eventSummary":"Nvidia beat estimates on Sep 8","eventSlug":"q2-beat"}]}\n```'));
  assert.equal(parsed.picks[0].seedUrls.length, 0);
  assert.equal(parsed.picks[0].whyNow, "");
  assert.throws(() => extractJson("no json here"));
  const prompt = renderPickerPrompt(input, "slot 2 missing");
  assert.match(prompt, /Tickers on cooldown \(do not pick\): TSLA/);
  assert.match(prompt, /2026-09-04 AAPL: Apple event/);
  assert.match(prompt, /NVDA \(1 stories, 3 outlets\)/);
  assert.match(prompt, /previous answer was rejected: slot 2 missing/);
});

const GOOD_BODY = `Nvidia (NVDA) reported second-quarter results after the close on Wednesday, and the numbers cleared the bar the Street had set. Revenue came in at $46.7 billion, up 56% from a year earlier, according to Reuters.

Data-center sales were the engine again. CNBC reported that the segment brought in $41.1 billion, a little below what some analysts had penciled in.

The stock slipped about 3% in after-hours trading, Reuters noted. Investors seem to have wanted an even bigger beat.

Guidance was the other talking point. Management told analysts to expect roughly $54 billion in revenue for the current quarter, CNBC said, which is above the consensus that was in place before the call.

There was one notable absence. The outlook does not include any data-center revenue from China, where export rules remain in flux, Reuters reported.

Chief executive Jensen Huang spent much of the call on the company's next chip platform. He said demand for the new systems is, in his words, extraordinary, per CNBC's account of the call.

What comes next is a set of dates. Nvidia's annual developer conference is in the spring, and the next quarterly report is expected in late November. Both outlets flagged China policy as the swing factor to watch between now and then.

For readers keeping score, this was the tenth straight quarter of triple-digit or high double-digit growth, according to Reuters. Whether the pace holds is the question the market could keep asking.

Gross margin was the number analysts kept circling. CNBC put it at 72.4%, a touch below last quarter, and management attributed the slip to the cost of ramping the new platform.

The buyback got a mention too. The board approved another $60 billion in repurchases, Reuters reported, on top of what was left from the prior authorization.

Competitors were not far from the conversation. Both outlets noted that rivals have been chasing the same data-center budgets, though neither reported any sign of lost orders so far.

One last detail from the release: cash and equivalents stood at $56.8 billion at quarter end, per Reuters, which gives the company room for the spending plans it described.`;

const GOOD_RAW = `HEADLINE: Nvidia Clears the Bar Again, and the Stock Shrugs
SUBTITLE: Another record quarter, a bigger forecast, and a wobble after hours.
SUBJECT: Nvidia beat again. Here's what the outlets said.
PREVIEW: Record revenue, higher guidance, and a China-shaped hole in the outlook.
SOURCE: Reuters | https://www.reuters.com/technology/nvidia-q2
SOURCE: CNBC | https://www.cnbc.com/2026/09/08/nvidia-earnings.html
BODY:
${GOOD_BODY}`;

const nvda = pick(1, "NVDA", { companyName: "Nvidia Corporation" });

test("parseWriterOutput reads the delimited format, with and without markdown decoration", () => {
  const p = parseWriterOutput(GOOD_RAW);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.article.headline, "Nvidia Clears the Bar Again, and the Stock Shrugs");
  assert.equal(p.article.sources.length, 2);
  assert.equal(p.article.sources[1].outlet, "CNBC");
  assert.equal(p.article.paragraphs.length, 12);
  const decorated = parseWriterOutput(GOOD_RAW.replace("HEADLINE:", "**HEADLINE:**").replace("SOURCE: Reuters |", "- SOURCE: Reuters -"));
  assert.ok(decorated.ok && decorated.article.headline === p.article.headline && decorated.article.sources[0].outlet === "Reuters");
  assert.deepEqual(parseWriterOutput("just prose"), { ok: false, reason: "no BODY section" });
  assert.deepEqual(parseWriterOutput("BODY:\nhello"), { ok: false, reason: "no HEADLINE" });
});

test("validateArticle accepts the good article and rejects each rule", () => {
  const good = (parseWriterOutput(GOOD_RAW) as { ok: true; article: Article }).article;
  assert.deepEqual(validateArticle(good, nvda), { ok: true });
  const reason = (a: Article, p: TopicPick = nvda) => (validateArticle(a, p) as { ok: false; reason: string }).reason;

  assert.match(reason({ ...good, paragraphs: good.paragraphs.slice(0, 2) }), /under 300/);
  assert.match(reason({ ...good, paragraphs: [...good.paragraphs, ...good.paragraphs] }), /over 550/);
  assert.match(reason({ ...good, paragraphs: [good.paragraphs.slice(0, 4).join(" "), ...good.paragraphs.slice(4)] }), /more than 3 sentences/);
  assert.match(reason({ ...good, paragraphs: ["- a bullet point about Nvidia", ...good.paragraphs] }), /bullets/);
  assert.match(reason({ ...good, paragraphs: ["Some **bold** text about Nvidia.", ...good.paragraphs] }), /markdown emphasis/);
  assert.match(reason({ ...good, headline: "x".repeat(91) }), /headline is 91/);
  assert.match(reason({ ...good, subjectLine: "y".repeat(71) }), /subject is 71/);
  assert.match(reason({ ...good, previewText: "z".repeat(121) }), /preview is 121/);
  assert.match(reason({ ...good, headline: "Nvidia soars 🚀" }), /emoji/);
  assert.match(reason({ ...good, headline: "Nvidia beats!" }), /exclamation/);
  assert.match(reason({ ...good, headline: "NVIDIA BEATS AGAIN" }), /all caps/);
  assert.match(reason({ ...good, paragraphs: ["This is a risk-free way into Nvidia.", ...good.paragraphs] }), /banned phrase "risk-free"/);
  assert.match(reason({ ...good, paragraphs: ["You should buy Nvidia today, Reuters aside.", ...good.paragraphs] }), /banned phrase/);
  assert.match(reason({ ...good, paragraphs: ["The stock will soar, Reuters said.", ...good.paragraphs] }), /banned phrase "will soar"/);
  assert.match(reason({ ...good, sources: good.sources.slice(0, 1) }), /only 1 source/);
  assert.match(reason({ ...good, sources: [{ outlet: "Reuters", url: "https://r" }, { outlet: "Bloomberg", url: "https://b" }] }), /only 1 of the sources are named/);
  assert.match(reason(good, pick(1, "MSFT", { companyName: "Microsoft" })), /never names Microsoft or MSFT/);
  assert.deepEqual(validateArticle({ ...good, headline: "Coca-Cola® Clears the Bar" }, nvda), { ok: true }, "® is not an emoji");
  assert.deepEqual(validateArticle({ ...good, paragraphs: good.paragraphs.map((p) => p.replace(/CNBC/g, "the Journal")), sources: [good.sources[0], { outlet: "The Wall Street Journal", url: "https://www.wsj.com/x" }] }, nvda), { ok: true }, "outlet shorthand counts");
  assert.match(reason({ ...good, paragraphs: [`Hello {{first_name}}. ${good.paragraphs[0]}`, ...good.paragraphs.slice(1)] }), /merge tag/);
});

test("sentenceCount tolerates decimals, closing quotes and abbreviations", () => {
  assert.equal(sentenceCount("Revenue was $46.7 billion. That beat estimates."), 2);
  assert.equal(sentenceCount("The U.S. Securities and Exchange Commission and Apple Inc. Chief Tim Cook met Mr. Smith. Shares rose."), 2);
  assert.equal(sentenceCount('He called demand "extraordinary." Shares fell 3% after hours.'), 2);
  assert.equal(sentenceCount("One sentence only, with 2.5 in it."), 1);
  assert.equal(sentenceCount('CEO Jensen Huang said in a statement carried by Fortune, "AI is here. Demand is extraordinary. We are ramping." Shares rose.'), 2, "sentences inside a quotation count as one");
});

test("writer prompt carries the pick, seeds and retry reason; cost uses list prices", () => {
  const { system, user } = renderWriterPrompt(pick(1, "LULU", { companyName: "Lululemon", seedUrls: ["https://www.bloomberg.com/a"], whyNow: "biggest drop in a year" }), "2026-09-08", "body is 200 words");
  assert.match(system, /HEADLINE: <headline>/);
  assert.match(system, new RegExp(NEWSLETTER.targetWords));
  assert.match(user, /Lululemon \(LULU\)/);
  assert.match(user, /- https:\/\/www\.bloomberg\.com\/a/);
  assert.match(user, /rejected: body is 200 words/);
  assert.equal(costUsd({ inputTokens: 1_000_000, outputTokens: 100_000, webSearches: 5 }), 2 + 1 + 0.05);
});
