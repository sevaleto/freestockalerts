/**
 * US Treasury par yield curve from Treasury.gov's daily CSV (public domain, no
 * key, same-day). Replaces FMP's treasury-rates feed for the newsletter.
 * https://home.treasury.gov/treasury-daily-interest-rate-xml-feed
 */
const TTL_MS = 30 * 60_000;

export interface TreasuryDay {
  date: string; // YYYY-MM-DD
  month3: number | null;
  year2: number | null;
  year10: number | null;
  year30: number | null;
}

const csvUrl = (year: number) =>
  `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;

const cells = (line: string) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

/** Rows newest first. Columns are located by header name, so added tenors do not shift anything. */
export function parseTreasuryCsv(csv: string): TreasuryDay[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = cells(lines[0]);
  const col = (name: string) => header.indexOf(name);
  const idx = { date: col("Date"), month3: col("3 Mo"), year2: col("2 Yr"), year10: col("10 Yr"), year30: col("30 Yr") };
  if (idx.date < 0) return [];
  const num = (v: string | undefined) => {
    if (v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const out: TreasuryDay[] = [];
  for (const line of lines.slice(1)) {
    const c = cells(line);
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(c[idx.date] ?? "");
    if (!m) continue;
    const at = (i: number) => (i >= 0 ? num(c[i]) : null);
    out.push({ date: `${m[3]}-${m[1]}-${m[2]}`, month3: at(idx.month3), year2: at(idx.year2), year10: at(idx.year10), year30: at(idx.year30) });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const cache = new Map<number, { rows: Promise<TreasuryDay[]>; expiresAt: number }>();
function yearRows(year: number): Promise<TreasuryDay[]> {
  const hit = cache.get(year);
  if (hit && Date.now() <= hit.expiresAt) return hit.rows;
  const rows = (async () => {
    const res = await fetch(csvUrl(year));
    if (!res.ok) throw new Error(`Treasury yield CSV ${year} failed (${res.status})`);
    return parseTreasuryCsv(await res.text());
  })();
  cache.set(year, { rows, expiresAt: Date.now() + TTL_MS });
  rows.catch(() => cache.delete(year));
  return rows;
}

/** Daily yields between two YYYY-MM-DD dates inclusive, newest first. */
export async function fetchTreasuryYields(from: string, to: string): Promise<TreasuryDay[]> {
  const years: number[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.push(y);
  const all = (await Promise.all(years.map(yearRows))).flat();
  return all.filter((d) => d.date >= from && d.date <= to).sort((a, b) => (a.date < b.date ? 1 : -1));
}
