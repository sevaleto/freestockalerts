import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { adState, isServable } from "@/lib/ads/rotation";
import { AdRowActions } from "@/components/admin/AdRowActions";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const STATE_STYLE: Record<ReturnType<typeof adState>, string> = {
  serving: "bg-lp-mint text-lp-teal",
  scheduled: "bg-blue-50 text-blue-700",
  ended: "bg-slate-100 text-slate-600",
  paused: "bg-amber-50 text-amber-700",
};

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "—");
const pct = (clicks: number, impressions: number) => (impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—");
const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Every email ad with rotation state and counters. */
export default async function AdminAdsPage() {
  await requireAdminPage();
  const now = new Date();
  const ads = await prisma.emailAd.findMany({ orderBy: { createdAt: "desc" } });
  const revenue = await prisma.emailAdClick.groupBy({ by: ["adId"], where: { counted: true }, _sum: { valueCents: true } });
  const revenueByAd = new Map(revenue.map((r) => [r.adId, r._sum.valueCents ?? 0]));
  const serving = ads.filter((a) => isServable(a, now));
  const totalWeight = serving.reduce((n, a) => n + a.weight, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Email ads</p>
          <h1 className="mt-2 font-serif text-4xl text-lp-navy">Sponsored snippets</h1>
          <p className="mt-3 max-w-2xl text-base text-lp-navy/75">
            One ad goes at the bottom of every alert and signal email. Active ads rotate fairly by weight: the ad with the fewest impressions per unit of weight is sent next.
          </p>
        </div>
        <Link href="/admin/ads/new" className="inline-flex h-11 items-center rounded-xl bg-lp-teal px-5 text-sm font-semibold text-white shadow-sm hover:bg-lp-teal-dark">
          New ad
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Serving now", String(serving.length)],
          ["Total impressions", ads.reduce((n, a) => n + a.impressions, 0).toLocaleString("en-US")],
          ["Total clicks", ads.reduce((n, a) => n + a.clicks, 0).toLocaleString("en-US")],
          ["Click revenue", usd([...revenueByAd.values()].reduce((n, v) => n + v, 0))],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-lp-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lp-muted">{label}</p>
            <p className="mt-2 font-serif text-3xl text-lp-navy">{value}</p>
          </div>
        ))}
      </div>

      {ads.length === 0 ? (
        <div className="mt-8 rounded-[20px] border border-dashed border-lp-border bg-white p-10 text-center">
          <p className="text-lg font-semibold text-lp-navy">No ads yet</p>
          <p className="mt-2 text-sm text-lp-navy/70">Emails go out without a sponsored section until the first active ad exists.</p>
          <Link href="/admin/ads/new" className="mt-5 inline-flex h-11 items-center rounded-xl bg-lp-teal px-5 text-sm font-semibold text-white hover:bg-lp-teal-dark">
            Create the first ad
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[20px] border border-lp-border bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-lp-border text-xs uppercase tracking-[0.12em] text-lp-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Ad</th>
                <th className="px-3 py-3 font-semibold">State</th>
                <th className="px-3 py-3 font-semibold">Schedule</th>
                <th className="px-3 py-3 text-right font-semibold">Weight</th>
                <th className="px-3 py-3 text-right font-semibold">Share</th>
                <th className="px-3 py-3 text-right font-semibold">Impr.</th>
                <th className="px-3 py-3 text-right font-semibold">Clicks</th>
                <th className="px-3 py-3 text-right font-semibold">CTR</th>
                <th className="px-3 py-3 text-right font-semibold">$/click</th>
                <th className="px-3 py-3 text-right font-semibold">Revenue</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-border">
              {ads.map((ad) => {
                const state = adState(ad, now);
                const share = state === "serving" && totalWeight > 0 ? `${Math.round((ad.weight / totalWeight) * 100)}%` : "—";
                return (
                  <tr key={ad.id} className="align-top">
                    <td className="px-5 py-4">
                      <Link href={`/admin/ads/${ad.id}`} className="font-semibold text-lp-navy hover:text-lp-teal">
                        {ad.name}
                      </Link>
                      <p className="mt-0.5 max-w-[360px] truncate text-xs text-lp-muted">
                        {ad.leadIn}: {ad.headline}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATE_STYLE[state]}`}>{state}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-lp-navy/80">
                      {fmtDate(ad.startAt)} → {fmtDate(ad.endAt)}
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{ad.weight}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{share}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{ad.impressions.toLocaleString("en-US")}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{ad.clicks.toLocaleString("en-US")}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{pct(ad.clicks, ad.impressions)}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{usd(ad.valueCents)}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{usd(revenueByAd.get(ad.id) ?? 0)}</td>
                    <td className="px-5 py-4 text-right">
                      <AdRowActions id={ad.id} status={ad.status} name={ad.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
