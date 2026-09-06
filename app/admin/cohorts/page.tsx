import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { cohortMonths, cohortReport } from "@/lib/subscribers/report";
import { CohortCostInput } from "@/components/admin/CohortCostInput";
import { NewsletterValueInput } from "@/components/admin/NewsletterValueInput";
import { getNewsletterClickValueCents } from "@/lib/settings";
import { BEEHIIV_PUBLICATIONS } from "@/lib/beehiiv/config";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SOURCES: [string, string][] = [["", "All sources"], ["app", "App signups"], ...BEEHIIV_PUBLICATIONS.map((p): [string, string] => [p.source, `${p.name} newsletter`])];

/**
 * Revenue per acquisition cohort. A cohort is a UTM source + medium + campaign;
 * the month filter uses the subscriber's first signup. Cost is entered by
 * hand per cohort and month; return = revenue ÷ cost.
 */
export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ month?: string; source?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : null;
  const source = SOURCES.some(([v]) => v && v === sp.source) ? sp.source! : null;
  const newsletterValueCents = await getNewsletterClickValueCents(prisma);
  const [rows, months] = await Promise.all([cohortReport(prisma, { month, source, newsletterValueCents }), cohortMonths(prisma)]);
  const total = rows.reduce(
    (acc, r) => ({ subscribers: acc.subscribers + r.subscribers, alert: acc.alert + r.alertClicks, newsletter: acc.newsletter + r.newsletterClicks, revenue: acc.revenue + r.revenueCents, cost: acc.cost + (r.costCents ?? 0) }),
    { subscribers: 0, alert: 0, newsletter: 0, revenue: 0, cost: 0 },
  );

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Cohorts</p>
      <h1 className="mt-2 font-serif text-4xl text-lp-navy">Revenue by acquisition cohort</h1>
      <p className="mt-3 max-w-2xl text-base text-lp-navy/75">
        Subscribers grouped by the UTM source, medium and campaign that brought them. Only website signups are tracked. Revenue is every unique newsletter link click Beehiiv reports for them since tracking started, in either newsletter, priced at the value below, plus alert-email ad clicks at each ad&apos;s value. Enter what each cohort cost and the return shows next to it.
      </p>
      <div className="mt-4 rounded-[16px] border border-lp-border bg-white px-4 py-3">
        <NewsletterValueInput valueCents={newsletterValueCents} />
        <p className="mt-1 text-xs text-lp-muted">Applied to every unique click Beehiiv counts for a tracked subscriber in either newsletter. Change it and the whole report re-prices.</p>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-center gap-3">
        <select name="month" defaultValue={month ?? ""} className="h-11 rounded-xl border border-lp-border bg-white px-3 text-sm text-lp-navy shadow-sm">
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={source ?? ""} className="h-11 rounded-xl border border-lp-border bg-white px-3 text-sm text-lp-navy shadow-sm">
          {SOURCES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-xl bg-lp-teal px-5 text-sm font-semibold text-white hover:bg-lp-teal-dark">
          Apply
        </button>
        <span className="text-xs text-lp-muted">{month ? `Cohort month ${month}; cost is per month.` : "All time; cost is the sum of every month entered."}</span>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Subscribers", total.subscribers.toLocaleString("en-US")],
          ["Newsletter clicks", total.newsletter.toLocaleString("en-US")],
          ["Alert ad clicks", total.alert.toLocaleString("en-US")],
          ["Revenue", usd(total.revenue)],
          ["Cost entered", usd(total.cost)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-lp-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lp-muted">{label}</p>
            <p className="mt-2 font-serif text-3xl text-lp-navy">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-[20px] border border-lp-border bg-white shadow-sm">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-lp-border text-xs uppercase tracking-[0.12em] text-lp-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Source</th>
              <th className="px-3 py-3 font-semibold">Medium</th>
              <th className="px-3 py-3 font-semibold">Campaign</th>
              <th className="px-3 py-3 text-right font-semibold">Subs</th>
              <th className="px-3 py-3 text-right font-semibold">Clickers</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">NL clicks</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Alert clicks</th>
              <th className="px-3 py-3 text-right font-semibold">Revenue</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Rev/sub</th>
              <th className="px-3 py-3 text-right font-semibold">Cost</th>
              <th className="px-5 py-3 text-right font-semibold">Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lp-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-8 text-center text-sm text-lp-muted">
                  No subscribers yet. Run the sync first.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.cohortKey}>
                  <td className="px-5 py-3 font-medium text-lp-navy">{r.source}</td>
                  <td className="px-3 py-3 text-lp-navy/80">{r.medium}</td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-lp-navy/80" title={r.campaign}>
                    <Link href={`/admin/subscribers?q=${encodeURIComponent(r.campaign === "(none)" ? "" : r.campaign)}`} className="hover:text-lp-teal">
                      {r.campaign}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{r.subscribers.toLocaleString("en-US")}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{r.clickers.toLocaleString("en-US")}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{r.newsletterClicks.toLocaleString("en-US")}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{r.alertClicks.toLocaleString("en-US")}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{usd(r.revenueCents)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{r.subscribers ? usd(Math.round(r.revenueCents / r.subscribers)) : "—"}</td>
                  <td className="px-3 py-3 text-right">
                    {month ? <CohortCostInput cohortKey={r.cohortKey} month={month} costCents={r.costCents} /> : <span className="tabular-nums text-lp-navy">{r.costCents === null ? "—" : usd(r.costCents)}</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-lp-navy">{r.costCents ? `${(r.revenueCents / r.costCents).toFixed(2)}×` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!month ? <p className="mt-3 text-xs text-lp-muted">Pick a month to enter costs.</p> : null}
    </div>
  );
}
