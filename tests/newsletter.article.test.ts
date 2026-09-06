/** News grouping, the two issue prompts, writer output parsing and the validators. Pure. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dropNonStocks, groupCandidates, publisherKind, renderNewsBlock, type Candidate } from "../lib/newsletter/topics";
import { numberedItems, parseWriterOutput, renderIssuePrompt, sentenceCount, stalenessReason, urlDate, validateIssue, writeIssue, type Article } from "../lib/newsletter/article";
import { dateKeyWeekday, easternDateKey, easternMinutes, isDateKey, longDate, pacificDateKey, shiftDateKey, toMMDDYYYY, yesterdayPacific } from "../lib/newsletter/dates";
import { renderFacts, type IssueFacts } from "../lib/newsletter/facts";
import { windowReason } from "../lib/newsletter/build";
import { NEWSLETTER, NYSE_HOLIDAYS_STATIC } from "../lib/newsletter/config";
import { costUsd } from "../lib/newsletter/usage";
import type { FmpMarketNewsItem } from "../lib/api/fmp";

const NOW = new Date("2026-09-08T11:30:00Z"); // Tuesday 7:30 AM EDT

const row = (symbol: string | null, title: string, publishedDate: string, publisher = "Reuters", url = "https://www.reuters.com/x"): FmpMarketNewsItem => ({ symbol, title, publishedDate, publisher, site: new URL(url).hostname, snippet: "", url });

test("date helpers: Pacific and Eastern keys, minutes, shifting, weekday, formatting", () => {
  assert.equal(pacificDateKey(NOW), "2026-09-08");
  assert.equal(easternDateKey(NOW), "2026-09-08");
  assert.equal(easternMinutes(NOW), 7 * 60 + 30, "11:30 UTC is 7:30 EDT");
  assert.equal(easternMinutes(new Date("2026-12-08T11:30:00Z")), 6 * 60 + 30, "11:30 UTC is 6:30 EST");
  assert.equal(easternMinutes(new Date("2026-09-08T20:35:00Z")), 16 * 60 + 35);
  assert.equal(pacificDateKey(new Date("2026-09-08T05:00:00Z")), "2026-09-07", "10 PM Pacific the night before");
  assert.equal(yesterdayPacific(new Date("2026-10-01T11:00:00Z")), "2026-09-30");
  assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(dateKeyWeekday("2026-09-07"), 1, "Monday");
  assert.equal(dateKeyWeekday("2026-09-06"), 0, "Sunday");
  assert.equal(toMMDDYYYY("2026-09-05"), "09/05/2026");
  assert.equal(longDate("2026-09-04"), "Friday, September 4");
  assert.equal(isDateKey("2026-09-05"), true);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("nope"), false);
});

test("windowReason: weekends, holidays, and each kind's Eastern window; force is the caller's business", () => {
  const holidays = new Set(["2026-09-07"]);
  assert.equal(windowReason("morning", NOW, holidays, "2026-09-08"), null, "7:30 ET is inside the morning window");
  assert.match(windowReason("closing", NOW, holidays, "2026-09-08") ?? "", /Closing recap builds from 16:05 ET; it is 07:30 ET/);
  assert.equal(windowReason("closing", new Date("2026-09-08T20:35:00Z"), holidays, "2026-09-08"), null);
  assert.match(windowReason("morning", new Date("2026-09-08T20:35:00Z"), holidays, "2026-09-08") ?? "", /window closed at 09:25 ET/);
  assert.match(windowReason("morning", new Date("2026-12-08T11:30:00Z"), holidays, "2026-12-08") ?? "", /it is 06:30 ET/, "winter: the 11:30 UTC cron is too early, the 12:30 one builds");
  assert.equal(windowReason("morning", new Date("2026-12-08T12:30:00Z"), holidays, "2026-12-08"), null);
  assert.match(windowReason("morning", NOW, holidays, "2026-09-07") ?? "", /NYSE holiday/);
  assert.match(windowReason("morning", NOW, holidays, "2026-09-06") ?? "", /weekends/);
  assert.ok(NYSE_HOLIDAYS_STATIC.includes("2026-09-07"), "Labor Day 2026");
  assert.ok(NYSE_HOLIDAYS_STATIC.includes("2026-11-26"), "Thanksgiving 2026");
  assert.ok(NYSE_HOLIDAYS_STATIC.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && ![0, 6].includes(dateKeyWeekday(d))), "every listed holiday is a weekday");
});

test("groupCandidates keeps tickers with real coverage, drops opinion-only tickers and law-firm wires", () => {
  const rows = [
    row("NVDA", "Nvidia shares jump after earnings", "2026-09-08 09:00:00"),
    row("NVDA", "Nvidia beats estimates", "2026-09-08 08:30:00", "CNBC", "https://www.cnbc.com/a"),
    row("NVDA", "Nvidia beats estimates", "2026-09-08 08:31:00", "CNBC", "https://www.cnbc.com/b"), // duplicate title
    row("LULU", "Lululemon plunges on guidance cut", "2026-09-07 21:00:00", "Bloomberg", "https://www.bloomberg.com/a"),
    row("AAPL", "Apple iPhone event preview", "2026-09-04 12:00:00"), // outside the window
    row("TSLA", "Tesla something", "2026-09-08 09:00:00"), // excluded
    row("MRNA", "If You'd Invested in Moderna 5 Years Ago", "2026-09-08 06:55:00", "The Motley Fool", "https://www.fool.com/investing/2026/09/08/x"),
    row("MRNA", "Moderna Just Doubled", "2026-09-08 08:51:00", "MarketBeat", "https://www.marketbeat.com/articles/x"),
    row("ACME", "Acme Corp. Reports Second Quarter Results", "2026-09-08 08:00:00", "PRNewsWire", "https://www.prnewswire.com/news-releases/acme-x.html"),
    row("SUJA", "ROSEN, LEADING TRIAL ATTORNEYS, Encourages Suja Life Investors", "2026-09-08 09:00:00", "Newsfile Corp", "https://www.newsfilecorp.com/a"),
    row(null, "Market wrap", "2026-09-08 09:00:00"),
    row("BRK.B", "Berkshire buys more", "2026-09-08 09:00:00"),
  ];
  const c = groupCandidates(rows, { now: NOW, lookbackHours: 18, exclude: new Set(["TSLA"]), limit: 10 });
  assert.deepEqual(c.map((x) => x.ticker), ["NVDA", "BRK.B", "ACME", "LULU"]);
  assert.equal(c[0].headlines.length, 2, "duplicate title dropped");
  assert.equal(c[0].newsCount, 2);
  assert.ok(!c.some((x) => x.ticker === "MRNA"), "opinion-only tickers are not candidates");
  assert.ok(!c.some((x) => x.ticker === "SUJA"), "law-firm solicitations are noise");
  assert.equal(publisherKind("Reuters", "https://www.reuters.com/x"), "news");
  assert.equal(publisherKind("Fox Business", "https://www.youtube.com/watch?v=1"), "news");
  assert.equal(publisherKind("GlobeNewsWire", "https://www.globenewswire.com/x"), "primary");
  assert.equal(publisherKind("The Motley Fool", "https://www.fool.com/x"), "opinion");
  assert.match(renderNewsBlock(c).join("\n"), /NVDA \(2 news\/release stories, 2 outlets\)\n  - \[news\] 2026-09-08 09:00 Reuters/);
});

test("dropNonStocks removes ETFs, funds and unknown symbols; a lookup error keeps the candidate", async () => {
  const cand = (ticker: string): Candidate => ({ ticker, headlines: [], publishers: 1, newsCount: 1 });
  const profiles: Record<string, { isEtf: boolean; isFund: boolean; isActivelyTrading: boolean } | null> = { BNO: { isEtf: true, isFund: false, isActivelyTrading: true }, ROIV: { isEtf: false, isFund: false, isActivelyTrading: true }, NBA: null, DEAD: { isEtf: false, isFund: false, isActivelyTrading: false } };
  const lookup = async (t: string) => {
    if (t === "ERR") throw new Error("boom");
    const p = profiles[t];
    return p ? { symbol: t, companyName: t, marketCap: 1, ...p } : null;
  };
  const r = await dropNonStocks(["BNO", "ROIV", "NBA", "DEAD", "ERR"].map(cand), lookup);
  assert.deepEqual(r.kept.map((c) => c.ticker), ["ROIV", "ERR"]);
  assert.deepEqual(r.dropped, ["BNO (ETF or fund)", "NBA (unknown symbol)", "DEAD (not trading)"]);
});

const facts = (kind: "morning" | "closing"): IssueFacts => ({
  kind,
  dateKey: "2026-09-08",
  missing: kind === "closing" ? ["sector performance"] : [],
  economic: [{ date: "2026-09-08 12:30:00", country: "US", event: "CPI (MoM)", impact: "High", previous: 0.2, estimate: 0.3, actual: kind === "closing" ? 0.4 : null, unit: "%" }],
  earnings: kind === "morning" ? [{ symbol: "ORCL", name: "Oracle", price: 240, changePercent: 0, marketCap: 700e9 }] : [],
  grades: [{ symbol: "MSFT", publishedDate: "2026-09-08T10:00:00.000Z", title: "Microsoft price target raised to $530 from $450 at Stifel", publisher: "TheFly", url: "https://thefly.com/x", gradingCompany: "Stifel", action: "hold", newGrade: "Hold", previousGrade: "Hold" }],
  news: [{ ticker: "LULU", publishers: 2, newsCount: 2, headlines: [{ title: "Lululemon plunges", publisher: "Bloomberg", publishedAt: "2026-09-08 08:00:00", url: "https://www.bloomberg.com/a", snippet: "guidance cut", kind: "news" }] }],
  treasury: { today: { date: "2026-09-08", year2: 4.37, year10: 4.78, year30: 5.24, month3: 3.91 }, previous: { date: "2026-09-04", year2: 4.3, year10: 4.7, year30: 5.2, month3: 3.9 } },
  indexes: kind === "closing" ? [{ symbol: "SPY", name: "S&P 500 (SPY)", price: 650.12, changePercent: -0.42, marketCap: 0 }] : [],
  gainers: kind === "closing" ? [{ symbol: "ADBE", name: "Adobe", price: 400, changePercent: 5.1, marketCap: 170e9 }] : [],
  losers: kind === "closing" ? [{ symbol: "LULU", name: "Lululemon", price: 180, changePercent: -20.3, marketCap: 22e9 }] : [],
  actives: [],
  sectors: [],
});

test("renderFacts lays out each kind's sections and names missing feeds", () => {
  const m = renderFacts(facts("morning"));
  assert.match(m, /Date: Tuesday, September 8/);
  assert.match(m, /US economic releases scheduled today/);
  assert.match(m, /CPI \(MoM\) \[High\]: previous 0.2%, estimate 0.3%/);
  assert.match(m, /Companies reporting earnings today \(\$2B\+\):\n- ORCL Oracle \(\$700B\)/);
  assert.match(m, /Stifel: Microsoft price target raised/);
  assert.match(m, /10-year 4.78% \(\+8 bps vs 2026-09-04\)/);
  assert.match(m, /LULU \(2 news\/release stories/);
  assert.doesNotMatch(m, /Index proxies/);
  const c = renderFacts(facts("closing"));
  assert.match(c, /Data feeds that did not load this run: sector performance/);
  assert.match(c, /S&P 500 \(SPY\): -0.42% to \$650.12/);
  assert.match(c, /Biggest losers \(market cap \$2B\+\):\n- LULU Lululemon: -20.30% to \$180.00 \(\$22B\)/);
  assert.match(c, /actual 0.4%/);
});

const ITEM = (n: number, t: string) => `${n}. ${t}`;
const MORNING_BODY = [
  ITEM(1, "Bond yields jumped and stock futures dipped after a strong August jobs report. Non-farm payrolls rose 162,000 against expectations of 53,000, Reuters reported, and the unemployment rate held at 4.1%."),
  ITEM(2, "Lululemon is down more than 20% pre-market after slashing its full-year outlook. Comparable sales fell 10% in constant currency and revenue guidance was cut to $10.35 billion to $10.5 billion, CNBC reported."),
  ITEM(3, "OpenAI introduced a new model overnight, and Reuters reported that its agents breached a German website in the spring. Cybersecurity names such as CrowdStrike and Palo Alto Networks could see attention on the headline."),
  ITEM(4, "Mizuho lowered its Intel price target to $92 from $109 while keeping a neutral rating. The analysts still like the agentic AI server tailwind into 2028 but see multiple compression across the group."),
  ITEM(5, "Adobe named Anil Chakravarthy as its next chief executive, effective in December. He joined the company nearly seven years ago from Informatica, which Salesforce bought last November, per The Wall Street Journal."),
  ITEM(6, "Zscaler shares gave back an early gain and are off about 4% despite a strong quarter and an upbeat outlook. Good results are not always good enough in this tape, as several cybersecurity peers found last week."),
  ITEM(7, "Nikkei reports early production of Apple's foldable iPhone is limited to a few hundred units a day for quality reasons. Apple hosts its product event Wednesday, its first fall launch with John Ternus as CEO."),
  ITEM(8, "Stifel raised its Microsoft price target to $530 from $450 after meetings with management but kept a hold rating. The analysts see momentum in Microsoft 365 Copilot, according to TheFly."),
  ITEM(9, "Wells Fargo raised its Merck target to $170 from $150 and Amgen's to $435 from $400 on higher peak-sales estimates for their cholesterol drugs. Both stocks were little changed in pre-market trading."),
].join("\n\n");

const rawFor = (body: string, extra = "") => `HEADLINE: Ten things to watch before the bell${extra}
SUBTITLE: Jobs data, a Lululemon reset and a new CEO at Adobe.
SUBJECT: Jobs shock, Lululemon reset, Adobe's new CEO
PREVIEW: Nine things to know before the opening bell.
SOURCE: Reuters | https://www.reuters.com/markets/us/2026-09-08-jobs/
SOURCE: CNBC | https://www.cnbc.com/2026/09/08/lululemon-guidance.html
SOURCE: The Wall Street Journal | https://www.wsj.com/business/adobe-ceo
BODY:
${body}`;

const CLOSING_BODY = [
  ITEM(1, "Stocks slipped on Tuesday as a hot jobs report sent bond yields higher. The S&P 500 fell 0.4%, the Nasdaq lost 0.6% and the Dow gave up 0.3%, per Reuters, while the 10-year Treasury yield climbed 8 basis points to 4.78%, its highest close since June."),
  ITEM(2, "Lululemon was the day's biggest large-cap loser, down 20.3% after cutting its full-year outlook. Comparable sales fell 10% and management called its product launches inconsistent, according to Bloomberg. Revenue guidance now sits at $10.35 billion to $10.5 billion."),
  ITEM(3, "Adobe rose 5.1% after naming Anil Chakravarthy as its next chief executive, effective in December. He joined from Informatica nearly seven years ago, and investors liked the continuity, per The Wall Street Journal."),
  ITEM(4, "Intel fell 3% after Mizuho trimmed its price target to $92 from $109 while keeping a neutral rating. The analysts still like the agentic AI server tailwind into 2028 but see multiple compression across the group, CNBC reported."),
  ITEM(5, "On deck for Wednesday: the consumer price index at 8:30 a.m. ET, with economists looking for a 0.3% monthly rise, and Apple's product event in the afternoon, its first fall launch under John Ternus, according to Barron's."),
].join("\n\n");

const closingRaw = rawFor(CLOSING_BODY).replace("Ten things to watch before the bell", "Five stories that mattered");

test("parseWriterOutput reads the delimited format, with and without markdown decoration", () => {
  const p = parseWriterOutput(rawFor(MORNING_BODY));
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.article.headline, "Ten things to watch before the bell");
  assert.equal(p.article.sources.length, 3);
  assert.equal(p.article.sources[2].outlet, "The Wall Street Journal");
  assert.equal(p.article.paragraphs.length, 9);
  const decorated = parseWriterOutput(rawFor(MORNING_BODY).replace("HEADLINE:", "**HEADLINE:**").replace("SOURCE: Reuters |", "- SOURCE: Reuters -"));
  assert.ok(decorated.ok && decorated.article.headline === p.article.headline && decorated.article.sources[0].outlet === "Reuters");
  assert.deepEqual(parseWriterOutput("just prose"), { ok: false, reason: "no BODY section" });
  assert.deepEqual(parseWriterOutput("BODY:\nhello"), { ok: false, reason: "no HEADLINE" });
});

test("numberedItems requires sequential numbers, one per paragraph", () => {
  assert.equal((numberedItems(["1. a", "2. b", "3) c"]) as { items: string[] }).items.length, 3);
  assert.match((numberedItems(["1. a", "3. c"]) as { reason: string }).reason, /out of order/);
  assert.match((numberedItems(["1. a", "Not numbered"]) as { reason: string }).reason, /does not start with its number/);
});

test("validateIssue: the morning brief", () => {
  const good = (parseWriterOutput(rawFor(MORNING_BODY)) as { ok: true; article: Article }).article;
  assert.deepEqual(validateIssue("morning", good, "2026-09-08"), { ok: true });
  const reason = (a: Article) => (validateIssue("morning", a, "2026-09-08") as { ok: false; reason: string }).reason;
  assert.match(reason({ ...good, paragraphs: good.paragraphs.slice(0, 5) }), /only 5 items/);
  assert.match(reason({ ...good, paragraphs: [...good.paragraphs, ITEM(10, "Ten words here about nothing in particular at all today ok twelve."), ITEM(11, "Eleven words here about nothing in particular at all today ok twelve.")] }), /11 items/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p, i) => (i === 3 ? "4. Too short." : p)) }), /under 20 words/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p, i) => (i === 3 ? `4. ${"word ".repeat(130)}` : p)) }), /over 120 words/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p) => p.replace(/^\d+\. /, "")) }), /does not start with its number/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p, i) => (i === 1 ? p.replace("is down more than 20%", "is a guaranteed winner") : p)) }), /banned phrase "guaranteed"/);
  assert.match(reason({ ...good, headline: "Ten things 🚀" }), /emoji/);
  assert.match(reason({ ...good, sources: good.sources.slice(0, 2) }), /only 2 source/);
  assert.match(reason({ ...good, sources: good.sources.map((s, i) => (i === 0 ? { ...s, url: "https://www.reuters.com/markets/us/2026-08-20-jobs/" } : { ...s, url: `https://www.cnbc.com/2026/08/19/x${i}.html` })) }), /every dated source is from 2026-08-20/);
  assert.deepEqual(validateIssue("morning", { ...good, headline: "Coca-Cola® and nine more" }, "2026-09-08"), { ok: true }, "® is not an emoji");
});

test("validateIssue: the closing recap is exactly five numbered items and opens with the market close", () => {
  const good = (parseWriterOutput(closingRaw) as { ok: true; article: Article }).article;
  assert.deepEqual(validateIssue("closing", good, "2026-09-08"), { ok: true });
  const reason = (a: Article) => (validateIssue("closing", a, "2026-09-08") as { ok: false; reason: string }).reason;
  assert.match(reason({ ...good, paragraphs: good.paragraphs.slice(0, 4) }), /only 4 items; exactly 5 needed/);
  assert.match(reason({ ...good, paragraphs: [...good.paragraphs, ITEM(6, "A sixth item with enough words to pass the length rule, mentioning a 2% move in some stock, which the validator still rejects because five is the number.")] }), /6 items; at most 5/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p, i) => (i === 0 ? "1. Stocks slipped on Tuesday after a hot jobs report sent yields higher, and the mood on trading desks was sour all afternoon, per Reuters and CNBC, with the 10-year yield up 8 basis points to 4.78% and volume running above average." : p)) }), /item 1 of the recap must be the market close/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p, i) => (i === 2 ? "3. Adobe rose after naming a new CEO." : p)) }), /under 30 words/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p, i) => (i === 1 ? p + " The stock will soar tomorrow." : p)) }), /banned phrase "will soar"/);
  assert.match(reason({ ...good, subjectLine: "y".repeat(71) }), /subject is 71/);
  assert.match(reason({ ...good, paragraphs: good.paragraphs.map((p) => p.replace(/^\d+\. /, "")) }), /does not start with its number/);
});

test("sentenceCount tolerates decimals, closing quotes, abbreviations and quoted sentences", () => {
  assert.equal(sentenceCount("Revenue was $46.7 billion. That beat estimates."), 2);
  assert.equal(sentenceCount('He called demand "extraordinary." Shares fell 3% after hours.'), 2);
  assert.equal(sentenceCount("One sentence only, with 2.5 in it."), 1);
  assert.equal(sentenceCount("The U.S. Securities and Exchange Commission and Apple Inc. Chief Tim Cook met Mr. Smith. Shares rose."), 2);
  assert.equal(sentenceCount('CEO Jensen Huang said in a statement carried by Fortune, "AI is here. Demand is extraordinary. We are ramping." Shares rose.'), 2);
  assert.equal(urlDate("https://www.cnbc.com/2026/09/08/nvidia-earnings.html"), "2026-09-08");
  assert.equal(urlDate("https://www.cbsnews.com/news/x/"), null);
  assert.equal(stalenessReason({ headline: "", subtitle: "", subjectLine: "", previewText: "", paragraphs: [], sources: [{ outlet: "CBS News", url: "https://www.cbsnews.com/news/x/" }] }, "2026-09-08"), null, "undated sources are not judged");
});

test("prompts carry the facts and retry reason; writeIssue retries once then flags for review", async () => {
  const p = renderIssuePrompt("morning", "FACTS HERE", "2026-09-08", "only 5 items");
  assert.match(p.system, /numbered list of 8 to 10 items/);
  assert.match(p.system, /HEADLINE: <headline>/);
  assert.match(p.user, /Today is Tuesday, September 8/);
  assert.match(p.user, /FACTS HERE/);
  assert.match(p.user, /rejected: only 5 items/);
  assert.match(renderIssuePrompt("closing", "F", "2026-09-08").system, /numbered list of exactly 5 items/);

  let calls = 0;
  const shortWriter = { async write() { calls++; return { raw: rawFor(MORNING_BODY.split("\n\n").slice(0, 5).join("\n\n")), usage: { inputTokens: 10, outputTokens: 5, webSearches: 2 }, stopReason: "end_turn" }; } };
  const r = await writeIssue("morning", "F", "2026-09-08", shortWriter);
  assert.equal(r.status, "needs_review");
  assert.equal(calls, 2);
  assert.match(r.reason ?? "", /only 5 items/);
  assert.equal(r.usage.webSearches, 4, "usage of both attempts is kept");

  const good = { async write() { return { raw: rawFor(MORNING_BODY), usage: { inputTokens: 1, outputTokens: 1, webSearches: 0 }, stopReason: "end_turn" }; } };
  assert.equal((await writeIssue("morning", "F", "2026-09-08", good)).status, "ok");
  const boom = { async write() { throw new Error("model exploded"); } };
  const f = await writeIssue("closing", "F", "2026-09-08", boom);
  assert.equal(f.status, "failed");
  assert.match(f.reason ?? "", /model exploded/);
  assert.equal(costUsd({ inputTokens: 1_000_000, outputTokens: 100_000, webSearches: 5 }), 2 + 1 + 0.05);
  assert.equal(NEWSLETTER.slots.length, 2);
});
