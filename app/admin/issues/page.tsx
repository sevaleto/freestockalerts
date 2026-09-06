import { prisma } from "@/lib/prisma/client";
import { requireAdminPage } from "@/lib/auth/admin";
import { getSetting } from "@/lib/settings";
import { NEWSLETTER_PAUSED_KEY } from "@/lib/newsletter/config";
import { pacificDateKey, toMMDDYYYY } from "@/lib/newsletter/dates";
import { IssueRowActions, IssuesToolbar } from "@/components/admin/IssueRowActions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  drafted: "bg-lp-mint text-lp-teal",
  needs_review: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  pending: "bg-blue-50 text-blue-700",
  skipped: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<string, string> = { drafted: "Draft ready", needs_review: "Needs review", failed: "Failed", pending: "Building", skipped: "Skipped" };

const usd = (n: number) => `$${n.toFixed(3)}`;

/** Every AI-drafted issue slot: what was picked, where the ads came from, and the Beehiiv link. */
export default async function AdminIssuesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const filter = sp.status && Object.hasOwn(STATUS_STYLE, sp.status) ? sp.status : null;
  const [rows, paused] = await Promise.all([
    prisma.newsletterIssue.findMany({ where: filter ? { status: filter } : undefined, orderBy: [{ issueDate: "desc" }, { slot: "asc" }], take: 120 }),
    getSetting(NEWSLETTER_PAUSED_KEY),
  ]);
  const today = pacificDateKey(new Date());
  const month = today.slice(0, 7);
  const monthCost = rows.filter((r) => r.issueDate.startsWith(month)).reduce((n, r) => n + r.costUsd, 0);
  const counts = { drafted: 0, needs_review: 0, failed: 0 };
  for (const r of rows) if (r.status in counts) counts[r.status as keyof typeof counts]++;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Daily issues</p>
          <h1 className="mt-2 font-serif text-4xl text-lp-navy">Newsletter drafts</h1>
          <p className="mt-3 max-w-2xl text-base text-lp-navy/75">
            Every day at 4 AM Pacific the app writes two articles about stocks in the news, copies the ads that ran in yesterday&apos;s Smart Investor issues, and creates two drafts in Beehiiv. Nothing is sent until you click Send there.
          </p>
        </div>
        <IssuesToolbar today={today} paused={paused === "1"} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Drafts ready", String(counts.drafted)],
          ["Need review", String(counts.needs_review)],
          ["Failed", String(counts.failed)],
          [`Cost in ${month}`, usd(monthCost)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-lp-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lp-muted">{label}</p>
            <p className="mt-2 font-serif text-3xl text-lp-navy">{value}</p>
          </div>
        ))}
      </div>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Status">
        {[
          ["", "All"],
          ["drafted", "Draft ready"],
          ["needs_review", "Needs review"],
          ["failed", "Failed"],
        ].map(([key, label]) => (
          <a key={key} href={key ? `/admin/issues?status=${key}` : "/admin/issues"} className={`rounded-full border px-3 py-1 text-xs font-semibold ${(filter ?? "") === key ? "border-lp-teal bg-lp-mint text-lp-teal" : "border-lp-border bg-white text-lp-navy"}`}>
            {label}
          </a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-[20px] border border-dashed border-lp-border bg-white p-10 text-center text-sm text-lp-muted">No issues yet. Use &ldquo;Build today&rdquo; or wait for the 4 AM run.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[20px] border border-lp-border bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-lp-border text-xs uppercase tracking-[0.12em] text-lp-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Issue</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Article</th>
                <th className="px-3 py-3 font-semibold">Ads from</th>
                <th className="px-3 py-3 text-right font-semibold">Ads</th>
                <th className="px-3 py-3 text-right font-semibold">Cost</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-border">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-4 text-lp-navy">
                    <span className="font-semibold">{toMMDDYYYY(r.issueDate)}</span>
                    <span className="text-lp-muted"> · #{r.slot}</span>
                    {r.forced ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">rebuilt</span> : null}
                  </td>
                  <td className="px-3 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </td>
                  <td className="max-w-[420px] px-3 py-4">
                    <p className="font-semibold text-lp-navy">
                      {r.ticker ? <span className="text-lp-teal">{r.ticker} </span> : null}
                      {r.headline ?? <span className="text-lp-muted">{r.error ? "no article" : "…"}</span>}
                    </p>
                    {r.eventSummary ? <p className="mt-0.5 text-xs text-lp-muted">{r.eventSummary}</p> : null}
                    {r.reviewReason ? <p className="mt-1 text-xs text-amber-700">Review: {r.reviewReason}</p> : null}
                    {r.error ? <p className="mt-1 text-xs text-red-700">{r.error}</p> : null}
                  </td>
                  <td className="max-w-[260px] px-3 py-4 text-xs text-lp-navy/80">
                    {r.tsiPostTitle ? (
                      <>
                        <p className="truncate" title={r.tsiPostTitle}>
                          {r.tsiPostTitle}
                        </p>
                        {r.tsiAdvertisers ? <p className="mt-0.5 text-lp-muted">{r.tsiAdvertisers}</p> : null}
                      </>
                    ) : (
                      <span className="text-lp-muted">no Smart Investor issue matched</span>
                    )}
                  </td>
                  <td className={`px-3 py-4 text-right tabular-nums ${r.adsFound < 2 ? "text-amber-700" : "text-lp-navy"}`}>{r.adsFound}/2</td>
                  <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{usd(r.costUsd)}</td>
                  <td className="px-5 py-4 text-right">
                    <IssueRowActions issueDate={r.issueDate} slot={r.slot} beehiivPostUrl={r.beehiivPostUrl} status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
