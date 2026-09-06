/**
 * Which tickers are in the news. Headlines are grouped by ticker inside a
 * window, wire noise and opinion-only tickers are dropped, ETFs and unknown
 * symbols are filtered, and the result is shown to the writer as context.
 */
import { fetchFmpProfileLite, type FmpMarketNewsItem, type FmpProfileLite } from "@/lib/api/fmp";

export type PublisherKind = "news" | "primary" | "opinion";

export interface CandidateHeadline {
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
  snippet: string;
  kind: PublisherKind;
}

export interface Candidate {
  ticker: string;
  headlines: CandidateHeadline[];
  /** Distinct publishers covering the ticker in the window. */
  publishers: number;
  /** Headlines from news outlets and company releases; opinion pieces do not count. */
  newsCount: number;
}

const TICKER_RE = /^[A-Z]{1,5}(?:\.[A-Z])?$/;

/**
 * News outlets report events; company releases are the events; everything
 * else in the feed (Motley Fool, Seeking Alpha, 24/7 Wall St, MarketBeat…)
 * is opinion or evergreen content that is published daily about anything and
 * says nothing about whether something happened. Only the first two make a
 * ticker a candidate.
 */
const NEWS_RE = /reuters|bloomberg|cnbc|wall street journal|wsj|barron|marketwatch|financial times|\bft\b|associated press|apnews|\bap news|business insider|fox business|cnn|nytimes|new york times|investor'?s business daily|investors\.com|axios|techcrunch|the verge|yahoo finance|the information|semafor|politico|washington post|los angeles times|the guardian|bbc|nikkei|caixin|south china morning post|thefly/i;
const PRIMARY_RE = /prnewswire|pr newswire|globenewswire|business ?wire|accesswire|newsfile|sec\.gov|ir\.|investor relations/i;

export function publisherKind(publisher: string, url: string): PublisherKind {
  const p = `${publisher} ${(() => { try { return new URL(url).hostname; } catch { return ""; } })()}`;
  if (NEWS_RE.test(p)) return "news";
  if (PRIMARY_RE.test(p)) return "primary";
  return "opinion";
}

/** Law-firm solicitations dressed up as news; the wires themselves carry real company releases. */
const NOISE_PUBLISHER_RE = /law firm|law group|\brosen\b|pomerantz|levi & korsinsky|bragar|schall|glancy|faruqi|kessler|robbins|kahn swick|hagens berman|block & leviton|class action/i;
const NOISE_TITLE_RE = /class action|securities (?:fraud )?(?:investigation|claims|lawsuit)|deadline alert|shareholder alert|investor alert|lawsuit reminder|encourages .{0,60}investors|investors? (?:with|who) (?:lost|suffered)|trial attorneys|investor rights|lead plaintiff|law firm/i;

const fmpDate = (s: string) => new Date(`${s.replace(" ", "T")}Z`).getTime();

/**
 * Group headlines by ticker inside the lookback window, drop law-firm wire
 * noise, keep only tickers with at least one news-outlet or company-release
 * headline, and order by how much real coverage they have.
 */
export function groupCandidates(rows: FmpMarketNewsItem[], opts: { now: Date; lookbackHours: number; exclude: Set<string>; limit: number }): Candidate[] {
  const cutoff = opts.now.getTime() - opts.lookbackHours * 3_600_000;
  const byTicker = new Map<string, CandidateHeadline[]>();
  for (const r of rows) {
    const t = r.symbol?.toUpperCase() ?? "";
    if (!TICKER_RE.test(t) || opts.exclude.has(t)) continue;
    if (!r.title || !r.publishedDate) continue;
    const ts = fmpDate(r.publishedDate);
    if (!Number.isFinite(ts) || ts < cutoff || ts > opts.now.getTime() + 3_600_000) continue;
    if (NOISE_PUBLISHER_RE.test(r.publisher) || NOISE_PUBLISHER_RE.test(r.site) || NOISE_PUBLISHER_RE.test(r.title) || NOISE_TITLE_RE.test(r.title)) continue;
    const list = byTicker.get(t) ?? [];
    if (list.some((h) => h.title.toLowerCase() === r.title.toLowerCase())) continue;
    const publisher = r.publisher || r.site;
    list.push({ title: r.title, publisher, publishedAt: r.publishedDate, url: r.url, snippet: r.snippet, kind: publisherKind(publisher, r.url) });
    byTicker.set(t, list);
  }
  const candidates: Candidate[] = [];
  for (const [ticker, headlines] of byTicker) {
    const newsCount = headlines.filter((h) => h.kind !== "opinion").length;
    if (newsCount === 0) continue;
    const publishers = new Set(headlines.map((h) => h.publisher.toLowerCase())).size;
    // News first in the list the model sees; opinion pieces only as context.
    headlines.sort((a, b) => (a.kind === "opinion" ? 1 : 0) - (b.kind === "opinion" ? 1 : 0) || fmpDate(b.publishedAt) - fmpDate(a.publishedAt));
    candidates.push({ ticker, headlines: headlines.slice(0, 5), publishers, newsCount });
  }
  candidates.sort((a, b) => b.newsCount - a.newsCount || b.publishers - a.publishers || fmpDate(b.headlines[0].publishedAt) - fmpDate(a.headlines[0].publishedAt));
  return candidates.slice(0, opts.limit);
}

/**
 * Drop ETFs, funds and symbols FMP does not know (the feed files OPEC stories
 * under oil ETFs and sports stories under whatever matches). One cached
 * profile call per candidate; a lookup failure keeps the candidate.
 */
export async function dropNonStocks(candidates: Candidate[], lookup: (t: string) => Promise<FmpProfileLite | null> = fetchFmpProfileLite): Promise<{ kept: Candidate[]; dropped: string[] }> {
  const results = await Promise.all(
    candidates.map(async (c) => {
      try {
        const p = await lookup(c.ticker);
        if (!p) return { c, drop: "unknown symbol" };
        if (p.isEtf || p.isFund) return { c, drop: "ETF or fund" };
        if (!p.isActivelyTrading) return { c, drop: "not trading" };
        return { c, drop: null };
      } catch {
        return { c, drop: null };
      }
    })
  );
  return { kept: results.filter((r) => !r.drop).map((r) => r.c), dropped: results.filter((r) => r.drop).map((r) => `${r.c.ticker} (${r.drop})`) };
}

/** The news block of a prompt: tickers with their headlines, tagged by publisher kind. */
export function renderNewsBlock(candidates: Candidate[]): string[] {
  const lines: string[] = [];
  for (const c of candidates) {
    lines.push(`${c.ticker} (${c.newsCount} news/release stories, ${c.publishers} outlets)`);
    for (const h of c.headlines) lines.push(`  - [${h.kind === "primary" ? "release" : h.kind}] ${h.publishedAt.slice(0, 16)} ${h.publisher}: "${h.title}"${h.snippet ? ` — ${h.snippet.slice(0, 160)}` : ""}${h.url ? ` ${h.url}` : ""}`);
  }
  return lines;
}
