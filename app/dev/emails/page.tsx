import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { render } from "@react-email/render";
import { AlertEmail } from "@/lib/email/alertEmail";
import { SignalEmail } from "@/lib/email/signalEmail";
import { MagicLinkEmail, magicLinkSubject } from "@/lib/email/magicLinkEmail";
import { maxScoreFor, signalAiContext, signalRows, signalSource, signalSubject, type SignalLike } from "@/lib/strategies/present";
import { ANALYST_SLUG, INSIDER_SLUG } from "@/lib/strategies/config";

/**
 * Local preview of every email the app sends, rendered with sample data.
 * Edit a template under lib/email/, refresh, and see the result. Not
 * available in production.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email previews", robots: { index: false, follow: false } };

const APP_URL = "https://www.freestockalerts.ai";

const insiderSignal: SignalLike = {
  strategySlug: INSIDER_SLUG,
  symbol: "AGCO",
  companyName: "AGCO Corporation",
  price: 133.4,
  score: 5,
  confirmation: "breakout",
  explanation:
    "Bob De Lange, Director, purchased approximately 1,000 shares worth $100,710, one of 2 insiders buying in the last 30 days. The stock is now above its 50-day average and is breaking above its post-purchase high on stronger-than-normal volume.",
  dataAsOf: new Date("2026-09-05T21:40:00Z"),
  createdAt: new Date("2026-09-05T21:40:00Z"),
  payload: {
    companyName: "AGCO Corporation",
    purchases: [
      { insider: "Bob De Lange", title: "Director", isSenior: false, date: "2026-08-14", shares: 1000, price: 100.71, value: 100710, sharesOwnedAfter: 6300, relativeToHoldings: 0.19, filingUrl: "https://www.sec.gov/Archives/edgar/data/880266/000088026626000082/0000880266-26-000082-index.htm", accession: "0000880266-26-000082", dedupKey: "a" },
      { insider: "Eric Hansotia", title: "Chairman, President and CEO", isSenior: true, date: "2026-08-20", shares: 2500, price: 104.2, value: 260500, sharesOwnedAfter: 210000, relativeToHoldings: 0.012, filingUrl: "https://www.sec.gov/Archives/edgar/data/880266/000088026626000083/0000880266-26-000083-index.htm", accession: "0000880266-26-000083", dedupKey: "b" },
    ],
    distinctInsiders: 2,
    totalValue: 361210,
    earliestPurchase: "2026-08-14",
    latestPurchase: "2026-08-20",
    postPurchaseHigh: 131.9,
    sma50: 111.75,
    volume: 2_100_000,
    avgVolume: 1_240_000,
    volumeRatio: 1.7,
    marketCap: 9.9e9,
    scoreBreakdown: { breakout: 2, multipleInsiders: 2, largePurchase: 1 },
    dataAsOf: "2026-09-05T21:40:00Z",
    source: "SEC Form 4 filings via Financial Modeling Prep",
    aiContext: {
      text: "",
      paragraphs: [
        "Two AGCO insiders bought stock on the open market in the last month, including chairman and CEO Eric Hansotia's purchase of 2,500 shares worth $260,500 on August 20, and the shares have now cleared the highest close since those purchases at $133.40, up 3.1% on the day on volume about 1.7 times average. The stock is above its 50-day average ($111.75).",
        "The Insider Purchase Confirmation strategy waits for the price to clear the post-purchase high before alerting, on the view that a purchase the market is responding to is a different thing from one it is ignoring. Analysts lean Buy on AGCO, with 12 of 18 ratings positive and an average target of $140, about 5% above the current price. The next scheduled report is October 29, 54 days away. Insiders are often early, and a stock can drift for months after a purchase, so the thing to watch is whether the breakout holds over the next several sessions rather than fading the same week.",
      ],
      source: "claude",
      model: "claude-haiku-4-5",
      generatedAt: "2026-09-05T21:40:00Z",
    },
  },
};

const analystSignal: SignalLike = {
  strategySlug: ANALYST_SLUG,
  symbol: "NFLX",
  companyName: "Netflix, Inc.",
  price: 84.1,
  score: 6,
  confirmation: "breakout",
  explanation:
    "NFLX received 3 positive analyst actions from independent firms during the past 6 days, including at least one outright upgrade. Shares are now above their 50-day average and breaking a 20-day high on elevated volume.",
  dataAsOf: new Date("2026-09-05T21:40:00Z"),
  createdAt: new Date("2026-09-05T21:40:00Z"),
  payload: {
    companyName: "Netflix, Inc.",
    actions: [
      { firm: "Morgan Stanley", date: "2026-09-04", previousGrade: "Neutral", newGrade: "Overweight", previousTier: "Hold", newTier: "Buy", action: "upgrade", isTrueUpgrade: true, sourceUrl: "https://thefly.com/ajax/news_get.php?id=4421729", dedupKey: "a" },
      { firm: "Jefferies", date: "2026-09-02", previousGrade: "Hold", newGrade: "Buy", previousTier: "Hold", newTier: "Buy", action: "upgrade", isTrueUpgrade: true, sourceUrl: null, dedupKey: "b" },
      { firm: "Rosenblatt", date: "2026-08-30", previousGrade: null, newGrade: "Buy", previousTier: null, newTier: "Buy", action: "initiate", isTrueUpgrade: false, sourceUrl: null, dedupKey: "c" },
    ],
    firms: ["Morgan Stanley", "Jefferies", "Rosenblatt"],
    firmCount: 3,
    hasTrueUpgrade: true,
    majorDowngrades: [],
    minorDowngrades: [],
    spanDays: 6,
    windowDays: 14,
    recentHigh: 81.6,
    brokeRecentHigh: true,
    sma50: 78.2,
    volume: 12_400_000,
    avgVolume: 7_900_000,
    volumeRatio: 1.6,
    marketCap: 3.6e11,
    scoreBreakdown: { base: 1, threeOrMoreFirms: 1, tightWindow: 1, trueUpgrade: 1, breakout: 1, volume: 1 },
    dataAsOf: "2026-09-05T21:40:00Z",
    source: "Analyst rating changes via Financial Modeling Prep",
    aiContext: {
      text: "",
      paragraphs: [
        "Three firms turned more positive on Netflix inside six days: Morgan Stanley moved to Overweight from Neutral on September 4, Jefferies to Buy from Hold on September 2, and Rosenblatt started coverage at Buy on August 30. The stock has responded, breaking its 20-day high at $84.10, up 2.4% on the day on volume about 1.6 times average, and it sits above its 50-day average ($78.20).",
        "The Analyst Upgrade Clusters strategy looks for independent firms reaching the same conclusion within days, since that can reflect new information they are all responding to, and uses price and volume to judge whether the market agrees. The next scheduled report is October 16, 41 days away. Analysts often upgrade after a move rather than before it, so a cluster can mark the end of a run as easily as the start; the thing to watch is whether the 20-day high holds through the week.",
      ],
      source: "claude",
      model: "claude-haiku-4-5",
      generatedAt: "2026-09-05T21:40:00Z",
    },
  },
};

function signalEmail(signal: SignalLike, strategyName: string) {
  const subject = signalSubject(signal);
  return {
    subject: `🔔 ${subject}`,
    node: SignalEmail({
      strategyName,
      strategySlug: signal.strategySlug,
      symbol: signal.symbol,
      subject,
      explanation: signal.explanation,
      rows: signalRows(signal),
      score: signal.score,
      maxScore: maxScoreFor(signal.strategySlug),
      sourceLine: signalSource(signal),
      appUrl: APP_URL,
      contextParagraphs: signalAiContext(signal)?.paragraphs ?? [],
    }),
  };
}

export default async function EmailPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const samples = [
    {
      id: "alert-52wk",
      name: "Price / technical alert (52-week high)",
      file: "lib/email/alertEmail.tsx",
      subject: "🔔 NVDA Alert: 52-Week High",
      node: AlertEmail({
        ticker: "NVDA",
        alertType: "52-Week High",
        currentPrice: "$232.15",
        triggerPrice: "hits a new 52-week high",
        dayChange: "+4.12",
        volume: "48,300,000 (1.6x avg)",
        aiSummary: "",
        contextParagraphs: [
          "NVIDIA printed a fresh 52-week high at $232.15, up 4.1% on the day, on volume about 1.6 times its recent average. The stock sits above both its 50-day average ($214.80) and its 200-day average ($178.30) and is now 41% above its 52-week low. The Motley Fool's coverage today points to second-quarter revenue that more than doubled to $96.2 billion, which is the news traders are reacting to.",
          "This alert comes from the Quality Breakout Radar, which watches for new highs from companies that generate cash and are growing, on the view that a breakout with participation is harder to reverse than one on thin volume. The next scheduled report is November 18, 74 days away, and the last one beat the EPS estimate by 6.2%. Analysts lean Buy, with 60 of 79 ratings positive and an average target of $345.21, 48.7% above the current price. The thing to watch is whether the high holds into the close and over the next few sessions; new highs cluster in strong markets and often reverse when the market turns.",
        ],
        appUrl: APP_URL,
        contextLines: ["Above its 50-day average ($214.80) and above its 200-day ($178.30).", "Volume 1.6× its 30-session average (above the 1.5× participation mark)."],
      }),
    },
    {
      id: "alert-sma",
      name: "Price / technical alert (200-day reclaim, sector ETF)",
      file: "lib/email/alertEmail.tsx",
      subject: "🔔 XLE Alert: SMA Cross Above",
      node: AlertEmail({
        ticker: "XLE",
        alertType: "SMA Cross Above",
        currentPrice: "$64.06",
        triggerPrice: "crosses above its 50-day moving average",
        dayChange: "+0.94",
        volume: "26,088,239 (1.2x avg)",
        aiSummary: "",
        contextParagraphs: [
          "The energy sector ETF crossed above its 50-day average ($59.20) at $64.06, up 0.9% on the day, on volume about 1.2 times its recent average. It remains above its 200-day average ($54.83) and has gained 6.1% over the last 21 sessions against 2.9% for SPY, a 3.2-point lead, which reads as improving leadership rather than a bounce within a downtrend.",
          "The Sector Leadership Radar treats a cross above the 50-day average as a simple, widely followed marker of a short-term trend change, and the 200-day position plus the performance against the index are what separate leadership from a short bounce. Sector ETFs cross their 50-day averages often, and in choppy markets most of those crosses reverse within days, so the thing to watch is whether XLE holds above the average for several sessions and keeps its lead on the index.",
        ],
        appUrl: APP_URL,
        contextLines: [
          "Above its 50-day average ($59.20) and above its 200-day ($54.83).",
          "Volume 1.2× its 30-session average.",
          "Last 21 sessions: +6.1% vs SPY +2.9% (+3.2 pts).",
          "Reads as improving leadership: above the 200-day average and ahead of the index over the last month.",
        ],
      }),
    },
    { id: "signal-insider", name: "Insider Purchase Confirmation signal", file: "lib/email/signalEmail.tsx", ...signalEmail(insiderSignal, "Insider Purchase Confirmation") },
    { id: "signal-analyst", name: "Analyst Upgrade Clusters signal", file: "lib/email/signalEmail.tsx", ...signalEmail(analystSignal, "Analyst Upgrade Clusters") },
    {
      id: "magic-new",
      name: "Magic link (new user)",
      file: "lib/email/magicLinkEmail.tsx",
      subject: magicLinkSubject(true),
      node: MagicLinkEmail({ link: `${APP_URL}/api/auth/callback?token_hash=example&type=magiclink`, code: "48213907", isNewUser: true, appUrl: APP_URL }),
    },
    {
      id: "magic-returning",
      name: "Magic link (returning user)",
      file: "lib/email/magicLinkEmail.tsx",
      subject: magicLinkSubject(false),
      node: MagicLinkEmail({ link: `${APP_URL}/api/auth/callback?token_hash=example&type=magiclink`, code: "48213907", isNewUser: false, appUrl: APP_URL }),
    },
  ];

  const rendered = await Promise.all(samples.map(async (s) => ({ ...s, html: await render(s.node) })));

  return (
    <div className="min-h-screen bg-lp-bg">
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Local only</p>
        <h1 className="mt-2 font-serif text-4xl text-lp-navy">Email previews</h1>
        <p className="mt-3 max-w-2xl text-base text-lp-navy/75">
          Every email the app sends, rendered with sample data exactly as Resend would receive it. Edit the template file, refresh this page. Nothing here is sent.
        </p>
        <nav aria-label="Emails" className="mt-6 flex flex-wrap gap-2">
          {rendered.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-lp-border bg-white px-3 py-1 text-xs font-semibold text-lp-navy hover:border-lp-teal/40">
              {s.name}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-12">
          {rendered.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`${s.id}-h`} className="font-serif text-2xl text-lp-navy">
                  {s.name}
                </h2>
                <code className="text-xs text-lp-muted">{s.file}</code>
              </div>
              <p className="mt-1 text-sm text-lp-navy/80">
                <span className="font-semibold">Subject:</span> {s.subject}
              </p>
              <div className="mt-3 overflow-hidden rounded-[20px] border border-lp-border bg-white shadow-sm">
                <iframe title={s.name} srcDoc={s.html} className="h-[820px] w-full bg-white" sandbox="" />
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
