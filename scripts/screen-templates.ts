/**
 * Quarterly refresh helper for the data-screened templates.
 * Prints ranked candidates; it does NOT modify anything.
 *
 *   set -a; source .env.local; set +a
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/screen-templates.ts
 *
 * Then hand-pick 10 per template into lib/mock/templates.ts and run `npm run prisma:seed`.
 */

const KEY = process.env.FMP_API_KEY;
if (!KEY) throw new Error("FMP_API_KEY missing");
const BASE = "https://financialmodelingprep.com/stable";

type Screened = { symbol: string; companyName: string; marketCap: number; sector?: string };
type Quote = { price: number; yearHigh: number; yearLow: number; priceAvg50: number; priceAvg200: number };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}&apikey=${KEY}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function quotes(symbols: string[]) {
  const out = new Map<string, Quote>();
  for (const s of symbols) {
    if (/[.-]/.test(s)) continue;
    try {
      const q = (await get<Quote[]>(`/quote?symbol=${s}`))[0];
      if (q?.price && q.yearHigh && q.yearLow && q.priceAvg50 && q.priceAvg200) out.set(s, q);
    } catch {}
    await new Promise((r) => setTimeout(r, 40));
  }
  return out;
}

const fmt = (n: number) => `$${(n / 1e9).toFixed(1)}B`;

async function main() {
  console.log("\n=== Under-the-Radar Breakouts: mid-caps ($2–20B) near 52-week highs, in uptrends ===");
  const mid = await get<Screened[]>(
    "/company-screener?marketCapMoreThan=2000000000&marketCapLowerThan=20000000000&volumeMoreThan=1500000&isEtf=false&isFund=false&isActivelyTrading=true&country=US&exchange=NASDAQ,NYSE&limit=300"
  );
  const mq = await quotes(mid.map((c) => c.symbol));
  mid
    .filter((c) => mq.has(c.symbol))
    .map((c) => ({ c, q: mq.get(c.symbol)! }))
    .filter(({ q }) => q.price / q.yearHigh >= 0.92 && q.price > q.priceAvg50 && q.price > q.priceAvg200 && q.price / q.yearLow >= 1.4)
    .sort((a, b) => b.q.price / b.q.yearHigh - a.q.price / a.q.yearHigh)
    .slice(0, 30)
    .forEach(({ c, q }) =>
      console.log(`${c.symbol.padEnd(6)} ${c.companyName.slice(0, 32).padEnd(32)} ${(c.sector ?? "").padEnd(22)} ${fmt(c.marketCap).padStart(8)}  ${((q.price / q.yearHigh) * 100).toFixed(1)}% of high`)
    );

  console.log("\n=== Turnaround Signals: large caps ($10B+) 3–25% below their 200-day, off the lows ===");
  const large = await get<Screened[]>(
    "/company-screener?marketCapMoreThan=10000000000&volumeMoreThan=2000000&isEtf=false&isFund=false&isActivelyTrading=true&country=US&exchange=NASDAQ,NYSE&limit=400"
  );
  const lq = await quotes(large.map((c) => c.symbol));
  large
    .filter((c) => lq.has(c.symbol))
    .map((c) => ({ c, q: lq.get(c.symbol)! }))
    .filter(({ q }) => q.price / q.priceAvg200 >= 0.75 && q.price / q.priceAvg200 < 0.97 && q.price / q.yearLow >= 1.08)
    .sort((a, b) => b.q.price / b.q.priceAvg200 - a.q.price / a.q.priceAvg200)
    .slice(0, 40)
    .forEach(({ c, q }) =>
      console.log(`${c.symbol.padEnd(6)} ${c.companyName.slice(0, 32).padEnd(32)} ${(c.sector ?? "").padEnd(22)} ${fmt(c.marketCap).padStart(8)}  ${((q.price / q.priceAvg200) * 100).toFixed(1)}% of 200d`)
    );
}

main().catch((e) => { console.error(e); process.exit(1); });
