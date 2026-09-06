import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { newsletterIssues } from "@/lib/subscribers/report";
import { BEEHIIV_PUBLICATIONS } from "@/lib/beehiiv/config";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "—");
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
const host = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.host}${x.pathname === "/" ? "" : x.pathname}`.slice(0, 80);
  } catch {
    return u.slice(0, 80);
  }
};

/**
 * Sent issues from Beehiiv with per-link clicks, so it is visible which ad in
 * an issue earned the clicks. "Verified" is Beehiiv's human-verified subset;
 * link scanners inflate the raw counts.
 */
export default async function NewslettersPage({ searchParams }: { searchParams: Promise<{ pub?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const pub = BEEHIIV_PUBLICATIONS.some((p) => p.key === sp.pub) ? sp.pub! : null;
  const issues = await newsletterIssues(prisma, { publication: pub, take: 40 });

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Newsletters</p>
      <h1 className="mt-2 font-serif text-4xl text-lp-navy">Issues and the links that earned the clicks</h1>
      <p className="mt-3 max-w-2xl text-base text-lp-navy/75">
        The latest sent issues as Beehiiv reports them, with clicks per link across all readers of that newsletter (not only tracked subscribers), so it is visible which ad in an issue earned the clicks. Verified clicks are Beehiiv&apos;s human-only subset, useful to see how much link scanners inflate a number.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Publication">
        {[{ key: "", name: "Both" }, ...BEEHIIV_PUBLICATIONS.map((p) => ({ key: p.key, name: p.name }))].map((p) => (
          <Link key={p.key} href={p.key ? `/admin/newsletters?pub=${p.key}` : "/admin/newsletters"} className={`rounded-full border px-3 py-1 text-xs font-semibold ${(pub ?? "") === p.key ? "border-lp-teal bg-lp-mint text-lp-teal" : "border-lp-border bg-white text-lp-navy"}`}>
            {p.name}
          </Link>
        ))}
      </nav>

      {issues.length === 0 ? (
        <p className="mt-8 rounded-[20px] border border-dashed border-lp-border bg-white p-10 text-center text-sm text-lp-muted">No issues synced yet. Run the subscriber sync.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {issues.map((issue) => {
            const name = BEEHIIV_PUBLICATIONS.find((p) => p.key === issue.publication)?.name ?? issue.publication;
            return (
              <details key={issue.id} className="group rounded-[20px] border border-lp-border bg-white shadow-sm">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-sm">
                  <span className="min-w-[220px] flex-1">
                    <span className="block font-semibold text-lp-navy">{issue.title}</span>
                    <span className="text-xs text-lp-muted">
                      {name} · {fmt(issue.publishDate)}
                      {issue.webUrl ? (
                        <>
                          {" · "}
                          <a href={issue.webUrl} target="_blank" rel="noopener noreferrer" className="text-lp-teal hover:underline">
                            web version
                          </a>
                        </>
                      ) : null}
                    </span>
                  </span>
                  {[
                    ["Delivered", issue.delivered.toLocaleString("en-US")],
                    ["Opens", pct(issue.uniqueOpens, issue.delivered)],
                    ["Unique clicks", issue.uniqueClicks.toLocaleString("en-US")],
                    ["Verified", issue.uniqueVerifiedClicks.toLocaleString("en-US")],
                    ["CTR", pct(issue.uniqueClicks, issue.delivered)],
                  ].map(([k, v]) => (
                    <span key={k} className="text-right">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-lp-muted">{k}</span>
                      <span className="tabular-nums text-lp-navy">{v}</span>
                    </span>
                  ))}
                </summary>
                <div className="border-t border-lp-border px-5 py-3">
                  {issue.links.length === 0 ? (
                    <p className="text-xs text-lp-muted">No link stats for this issue.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-[0.12em] text-lp-muted">
                        <tr>
                          <th className="py-1 pr-3 font-semibold">Link</th>
                          <th className="py-1 pr-3 text-right font-semibold">Unique</th>
                          <th className="py-1 pr-3 text-right font-semibold">Verified</th>
                          <th className="py-1 pr-3 text-right font-semibold">Total</th>
                          <th className="py-1 text-right font-semibold">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-lp-border/60">
                        {issue.links.map((l) => (
                          <tr key={l.id}>
                            <td className="max-w-[520px] truncate py-1.5 pr-3 text-lp-navy" title={l.url}>
                              {host(l.baseUrl)}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums text-lp-navy">{l.emailUniqueClicks.toLocaleString("en-US")}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums text-lp-navy">{l.uniqueVerifiedClicks.toLocaleString("en-US")}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums text-lp-navy/70">{l.emailClicks.toLocaleString("en-US")}</td>
                            <td className="py-1.5 text-right tabular-nums text-lp-navy/70">{pct(l.emailUniqueClicks, issue.uniqueClicks)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
