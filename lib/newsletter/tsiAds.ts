/**
 * The sponsor ads that ran in The Smart Investor (Beehiiv, key "si"), so they
 * can be copied into the FreeStockAlerts draft as-is.
 *
 * Nicole and Marie paste the Hermes-built newsletter into Beehiiv as one HTML
 * block. Both ad slots in that template are a table with the same inline
 * style (`border:1px solid #E5E0D5; background-color:#FAF8F3`): slot #1, the
 * full sponsor block after the intro, and slot #2, the short block after the
 * article. Post titles name the advertiser: "09/05/2026 - #1 - Wyatt (Gold / V3)".
 * Dedicated sends ("... - Dedicated 1 - ...") are whole ads, not newsletters,
 * and are ignored. Everything here except `fetchTsiAdsFor` is pure.
 */
import { listPosts, type BeehiivPost, type BeehiivRequestOptions } from "@/lib/beehiiv/client";
import { publicationByKey } from "@/lib/beehiiv/config";
import type { DateKey } from "./dates";

export interface TsiTitle {
  dateKey: DateKey;
  kind: "newsletter" | "dedicated";
  number: number;
  advertisers: { name: string; creative: string | null }[];
}

const TITLE_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(.*)$/;
const NUM_SLOT_RE = /^#\s*(\d+)\s*-\s*(.*)$/;
const DED_SLOT_RE = /^Dedicated\s*#?\s*(\d+)\s*-\s*(.*)$/i;
const PAREN_RE = /^(.*?)\s*\(([^)]*)\)\s*$/;

/** Port of parse_beehiiv_title in agent-skills/email-ops/beehiiv-sheet-sync. Article-style titles return null. */
export function parseTsiTitle(title: string | null | undefined): TsiTitle | null {
  const m = TITLE_DATE_RE.exec((title ?? "").trim());
  if (!m) return null;
  const [, mm, dd, yyyy, rest] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dateKey = `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${dateKey}T00:00:00Z`))) return null;

  let kind: TsiTitle["kind"];
  let number: number;
  let advPart: string;
  const m2 = NUM_SLOT_RE.exec(rest);
  if (m2) {
    kind = "newsletter";
    number = Number(m2[1]);
    advPart = m2[2];
  } else {
    const m3 = DED_SLOT_RE.exec(rest);
    if (!m3) return null;
    kind = "dedicated";
    number = Number(m3[1]);
    advPart = m3[2];
  }
  const advertisers = advPart
    .split(/\s*&\s*/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const m4 = PAREN_RE.exec(chunk);
      return m4 ? { name: m4[1].trim(), creative: m4[2].trim() } : { name: chunk, creative: null };
    });
  if (!advertisers.length) return null;
  return { dateKey, kind, number, advertisers };
}

export const advertiserLabel = (t: TsiTitle) => t.advertisers.map((a) => (a.creative ? `${a.name} (${a.creative})` : a.name)).join(" & ");

/**
 * Yesterday's newsletter #1 and #2, matched on the date in the title (the day
 * the issue is for), not on `publish_date`. First match per number wins.
 */
export function pickTsiPostsForDate(posts: BeehiivPost[], dateKey: DateKey): Map<1 | 2, BeehiivPost> {
  const out = new Map<1 | 2, BeehiivPost>();
  for (const post of posts) {
    const t = parseTsiTitle(post.title);
    if (!t || t.kind !== "newsletter" || t.dateKey !== dateKey) continue;
    if (t.number !== 1 && t.number !== 2) continue;
    if (!out.has(t.number)) out.set(t.number, post);
  }
  return out;
}

export interface TsiAd {
  /** Position in the source issue: 1 = full block after the intro, 2 = short block after the article. */
  index: number;
  html: string;
  linkCount: number;
  /** Our own snippet from /admin/ads (lib/ads/template.ts), not an advertiser's creative. */
  isHouseAd: boolean;
  /** Only placeholder comments or whitespace inside the wrapper. */
  empty: boolean;
}

const AD_WRAPPER_RE = /<table\b[^>]*>/gi;
const TABLE_TAG_RE = /<table\b[^>]*>|<\/table\s*>/gi;

const isAdWrapper = (startTag: string) => {
  const flat = startTag.replace(/\s+/g, "").toLowerCase();
  return flat.includes("e5e0d5") && flat.includes("faf8f3");
};

/** Index just past the `</table>` that closes the table whose start tag ends at `from`. */
function closingTableEnd(html: string, from: number): number | null {
  TABLE_TAG_RE.lastIndex = from;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = TABLE_TAG_RE.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return null;
}

export const isHouseAd = (html: string) => /\/api\/ads\/click\//i.test(html);

export const isTrackingWrapped = (html: string) => /href=["']https?:\/\/[^"']*(?:link\.mail\.beehiiv\.com|\/ss\/c\/)/i.test(html);

/** Beehiiv strips <style>; classes do nothing; comments are noise. Bare `&` in URLs breaks strict parsers. */
export function sanitizeAdHtml(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\b(href|src)="([^"]*)"/gi, (_, attr: string, value: string) => `${attr}="${value.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;")}"`)
    .trim();
}

const textOf = (html: string) =>
  html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every ad-slot wrapper table in an issue, in document order, sanitized. */
export function extractTsiAds(html: string): TsiAd[] {
  const ads: TsiAd[] = [];
  AD_WRAPPER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AD_WRAPPER_RE.exec(html))) {
    if (!isAdWrapper(m[0])) continue;
    const end = closingTableEnd(html, m.index + m[0].length);
    if (end === null) break;
    const raw = html.slice(m.index, end);
    const clean = sanitizeAdHtml(raw);
    const text = textOf(raw);
    ads.push({
      index: ads.length + 1,
      html: clean,
      linkCount: (clean.match(/<a\b/gi) ?? []).length,
      isHouseAd: isHouseAd(clean),
      empty: text.length === 0 || (/^[\s.]*$/.test(text) && clean.indexOf("<img") === -1),
    });
    AD_WRAPPER_RE.lastIndex = end;
  }
  return ads;
}

export interface TsiSlotAds {
  post: BeehiivPost;
  title: TsiTitle;
  /** Advertiser creatives only: no house snippets, no empty wrappers. Up to two, in source order. */
  ads: TsiAd[];
  contentSource: "email" | "web" | "none";
}

export interface TsiAdsResult {
  bySlot: Map<1 | 2, TsiSlotAds>;
  warnings: string[];
}

/** Pure half of `fetchTsiAdsFor`, so tests can feed posts directly. */
export function collectTsiAds(posts: BeehiivPost[], dateKey: DateKey): TsiAdsResult {
  const warnings: string[] = [];
  const picked = pickTsiPostsForDate(posts, dateKey);
  const bySlot = new Map<1 | 2, TsiSlotAds>();
  for (const n of [1, 2] as const) {
    const post = picked.get(n);
    if (!post) {
      warnings.push(`No Smart Investor newsletter #${n} found for ${dateKey}`);
      continue;
    }
    const title = parseTsiTitle(post.title)!;
    const email = post.content?.free?.email ?? "";
    const web = post.content?.free?.web ?? "";
    let source: TsiSlotAds["contentSource"] = "none";
    let html = "";
    if (email && !isTrackingWrapped(email)) {
      source = "email";
      html = email;
    } else if (web) {
      source = "web";
      html = web;
      if (email) warnings.push(`Smart Investor #${n}: email HTML carries tracking links; used the web version`);
    } else if (email) {
      source = "email";
      html = email;
      warnings.push(`Smart Investor #${n}: links are Beehiiv tracking redirects and no web version was returned`);
    } else {
      warnings.push(`Smart Investor #${n} (${post.id}): no content returned; was expand[]=free_email_content sent?`);
    }
    const all = html ? extractTsiAds(html) : [];
    const house = all.filter((a) => a.isHouseAd).length;
    if (house) warnings.push(`Smart Investor #${n}: skipped ${house} house ad snippet(s)`);
    const ads = all.filter((a) => !a.isHouseAd && !a.empty).slice(0, 2);
    if (html && ads.length < 2) warnings.push(`Smart Investor #${n}: found ${ads.length} of 2 sponsor blocks`);
    bySlot.set(n, { post, title, ads, contentSource: source });
  }
  return { bySlot, warnings };
}

/** Yesterday's two Smart Investor issues with their ads. One API call. */
export async function fetchTsiAdsFor(dateKey: DateKey, opts: BeehiivRequestOptions = {}): Promise<TsiAdsResult> {
  const pub = publicationByKey("si");
  if (!pub) throw new Error("The Smart Investor publication is not configured");
  const page = await listPosts(pub.id, { ...opts, limit: 30, status: "confirmed", expand: ["stats", "free_email_content", "free_web_content"] });
  return collectTsiAds(page.data, dateKey);
}
