/**
 * EDGAR access under SEC fair-access rules: at most 10 requests per second
 * (we stay at 8) and a User-Agent naming the company and a contact address.
 * https://www.sec.gov/os/accessing-edgar-data
 */
import { latestSharesOutstanding, parseFormIndex, type FormIndexEntry } from "./form4";

const USER_AGENT = process.env.SEC_USER_AGENT || "Trading Tips manuel@tradingtips.com";
const MIN_GAP_MS = 125; // 8 requests per second across this process

export class EdgarError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "EdgarError";
    this.status = status;
  }
}

let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function secGet(url: string): Promise<{ status: number; text: string }> {
  await throttle();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate" } });
  return { status: res.status, text: await res.text() };
}

const quarter = (month: number) => Math.floor((month - 1) / 3) + 1;

/**
 * Form 4 rows of the daily index for `dateKey` (YYYY-MM-DD). Null when the
 * index is not published: EDGAR answers 403 or 404 until the evening's file
 * exists, and for weekends and holidays.
 */
export async function fetchForm4Index(dateKey: string): Promise<FormIndexEntry[] | null> {
  const [y, m, d] = dateKey.split("-");
  const url = `https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${quarter(Number(m))}/form.${y}${m}${d}.idx`;
  const r = await secGet(url);
  if (r.status === 403 || r.status === 404) return null;
  if (r.status !== 200) throw new EdgarError(`daily index ${dateKey} failed (${r.status})`, r.status);
  return parseFormIndex(r.text, ["4"]);
}

/** The full submission text (header plus the ownership XML). */
export async function fetchSubmission(fileName: string): Promise<string> {
  const r = await secGet(`https://www.sec.gov/Archives/${fileName}`);
  if (r.status !== 200) throw new EdgarError(`submission ${fileName} failed (${r.status})`, r.status);
  return r.text;
}

const sharesCache = new Map<string, Promise<number | null>>();

/** Latest reported shares outstanding for an issuer CIK, from XBRL (free, no key). */
export function fetchSharesOutstanding(cik: string): Promise<number | null> {
  const padded = cik.replace(/\D/g, "").padStart(10, "0");
  const hit = sharesCache.get(padded);
  if (hit) return hit;
  const p = (async () => {
    const r = await secGet(`https://data.sec.gov/api/xbrl/companyconcept/CIK${padded}/dei/EntityCommonStockSharesOutstanding.json`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new EdgarError(`shares outstanding ${padded} failed (${r.status})`, r.status);
    return latestSharesOutstanding(JSON.parse(r.text));
  })();
  sharesCache.set(padded, p);
  p.catch(() => sharesCache.delete(padded));
  return p;
}
