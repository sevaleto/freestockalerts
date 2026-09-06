import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { PAGE_SIZE, searchSubscribers, subscriberTotals } from "@/lib/subscribers/report";
import { NONE } from "@/lib/subscribers/cohort";
import { newsletterClicksFor, revenueCentsFor } from "@/lib/subscribers/report";
import { getNewsletterClickValueCents } from "@/lib/settings";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "—");
const SOURCE_LABEL: Record<string, string> = { app: "App", beehiiv_fsa: "FSA newsletter", beehiiv_si: "Smart Investor" };

/** Every subscriber across the app and both newsletters, with their credited ad clicks. */
export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; clickers?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const clickersOnly = sp.clickers === "1";
  const [{ total, rows, pages }, totals, lastRuns, newsletterValueCents] = await Promise.all([
    searchSubscribers(prisma, { q, page, clickersOnly }),
    subscriberTotals(prisma),
    prisma.subscriberSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 3, distinct: ["source"] }),
    getNewsletterClickValueCents(prisma),
  ]);
  const newsletterClicks = totals.newsletterClicks;
  const link = (p: number) => `/admin/subscribers?${new URLSearchParams({ ...(q ? { q } : {}), ...(clickersOnly ? { clickers: "1" } : {}), page: String(p) })}`;

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Subscribers</p>
      <h1 className="mt-2 font-serif text-4xl text-lp-navy">Every subscriber, every click</h1>
      <p className="mt-3 max-w-2xl text-base text-lp-navy/75">
        Everyone who signed up on the FreeStockAlerts website, matched by email to the FreeStockAlerts and Smart Investor newsletters on Beehiiv. Newsletter clicks are unique link clicks Beehiiv reports for them since tracking started; alert clicks are ad clicks in the app&apos;s own emails.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Subscribers", totals.subscribers.toLocaleString("en-US")],
          ["Newsletter clicks", newsletterClicks.toLocaleString("en-US")],
          ["Alert ad clicks", totals.alertClicks.toLocaleString("en-US")],
          ["Revenue", usd(totals.alertValueCents + newsletterClicks * newsletterValueCents)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-lp-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lp-muted">{label}</p>
            <p className="mt-2 font-serif text-3xl text-lp-navy">{value}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-lp-muted">
        Last sync:{" "}
        {lastRuns.length
          ? lastRuns.map((r) => `${SOURCE_LABEL[r.source] ?? r.source} ${r.startedAt.toLocaleString("en-US", { timeZone: "America/New_York" })}${r.error ? " (error)" : r.completed ? "" : " (in progress)"}`).join(" · ")
          : "never. Run npm run sync:subscribers or wait for the hourly cron."}

      </p>

      <form method="get" className="mt-6 flex flex-wrap items-center gap-3">
        <input name="q" defaultValue={q} placeholder="Search email, campaign or source" className="h-11 w-full max-w-md rounded-xl border border-lp-border bg-white px-3 text-base text-lp-navy shadow-sm focus:border-lp-teal focus:outline-none focus:ring-2 focus:ring-lp-teal/30" />
        <label className="flex items-center gap-2 text-sm text-lp-navy">
          <input type="checkbox" name="clickers" value="1" defaultChecked={clickersOnly} className="h-4 w-4" /> Clickers only
        </label>
        <button type="submit" className="h-11 rounded-xl bg-lp-teal px-5 text-sm font-semibold text-white hover:bg-lp-teal-dark">
          Search
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-[20px] border border-lp-border bg-white shadow-sm">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-lp-border text-xs uppercase tracking-[0.12em] text-lp-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-3 py-3 font-semibold">Lists</th>
              <th className="px-3 py-3 font-semibold">First seen</th>
              <th className="px-3 py-3 font-semibold">Source / medium / campaign</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">NL clicks</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Alert clicks</th>
              <th className="px-5 py-3 text-right font-semibold">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lp-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-lp-muted">
                  No subscribers match.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-5 py-3">
                    <Link href={`/admin/subscribers/${s.id}`} className="font-medium text-lp-navy hover:text-lp-teal">
                      {s.email}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs text-lp-navy/80">
                    {[s.userId ? "App" : null, s.beehiivFsaId ? `FSA${s.beehiivFsaStatus && s.beehiivFsaStatus !== "active" ? ` (${s.beehiivFsaStatus})` : ""}` : null, s.beehiivSiId ? `SI${s.beehiivSiStatus && s.beehiivSiStatus !== "active" ? ` (${s.beehiivSiStatus})` : ""}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-lp-navy/80">{fmt(s.firstSeenAt)}</td>
                  <td className="px-3 py-3 text-xs text-lp-navy/80">
                    {[s.utmSource ?? NONE, s.utmMedium ?? NONE, s.utmCampaign ?? NONE].join(" / ")}
                    {s.referringSite ? <span className="block max-w-[280px] truncate text-lp-muted">{s.referringSite}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{newsletterClicksFor(s)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-lp-navy">{s.countedClicks}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-lp-navy">{usd(revenueCentsFor(s, newsletterValueCents))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-lp-navy/80">
        <span>
          {total.toLocaleString("en-US")} matching · page {page} of {pages} · {PAGE_SIZE} per page
        </span>
        <span className="flex gap-3">
          {page > 1 ? (
            <Link href={link(page - 1)} className="font-medium text-lp-teal hover:underline">
              ← Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={link(page + 1)} className="font-medium text-lp-teal hover:underline">
              Next →
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  );
}
