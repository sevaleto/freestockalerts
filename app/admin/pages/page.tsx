import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { requireAdminPage } from "@/lib/auth/admin";
import { getStrategy } from "@/lib/templates/catalog";
import { leadCountsByTag, pageTotals, pct, variantStats } from "@/lib/lp/report";
import { toRecord } from "@/lib/lp/store";
import { HOME_SLUG } from "@/lib/lp/view";
import { PageRowActions } from "@/components/admin/PageRowActions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  LIVE: "bg-lp-mint text-lp-teal",
  DRAFT: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

const publicPath = (slug: string) => (slug === HOME_SLUG ? "/" : `/go/${slug}`);

/** Every landing page with its split-test totals. */
export default async function AdminPagesPage() {
  await requireAdminPage();
  const [rows, counts] = await Promise.all([
    prisma.landingPage.findMany({ include: { variants: true }, orderBy: [{ kind: "asc" }, { createdAt: "asc" }] }),
    leadCountsByTag(prisma),
  ]);
  const pages = rows.map((row) => {
    const record = toRecord(row);
    const stats = variantStats(record.slug, record.variants, counts);
    return { record, stats, totals: pageTotals(stats), active: record.variants.filter((v) => v.isActive && v.weight > 0).length };
  });
  const live = pages.filter((p) => p.record.status === "LIVE");
  const grand = pageTotals(pages.flatMap((p) => p.stats));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Landing pages</p>
          <h1 className="mt-2 font-serif text-4xl text-lp-navy">Pages and headline tests</h1>
          <p className="mt-3 max-w-2xl text-base text-lp-navy/75">
            The homepage hero and every /go ad page. Each page carries one or more headline + subheadline variants; visitors are split by weight and stay on the variant they first saw. Leads are counted when the email form is submitted; confirmed means the address was verified.
          </p>
        </div>
        <Link href="/admin/pages/new" className="inline-flex h-11 items-center rounded-xl bg-lp-teal px-5 text-sm font-semibold text-white shadow-sm hover:bg-lp-teal-dark">
          New landing page
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Live pages", String(live.length)],
          ["Variant views", grand.views.toLocaleString("en-US")],
          ["Leads", grand.leads.toLocaleString("en-US")],
          ["Lead rate", pct(grand.conversion)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] border border-lp-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lp-muted">{label}</p>
            <p className="mt-2 font-serif text-3xl text-lp-navy">{value}</p>
          </div>
        ))}
      </div>

      {pages.length === 0 ? (
        <div className="mt-8 rounded-[20px] border border-dashed border-lp-border bg-white p-10 text-center">
          <p className="text-lg font-semibold text-lp-navy">No pages in the database yet</p>
          <p className="mt-2 text-sm text-lp-navy/70">
            The site is serving the built-in copy. Run <code className="rounded bg-lp-bg px-1.5 py-0.5 text-xs">npm run prisma:seed</code> to load the homepage and the seven ad pages, or create a page here.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[20px] border border-lp-border bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-lp-border text-xs uppercase tracking-[0.12em] text-lp-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Page</th>
                <th className="px-3 py-3 font-semibold">Strategy</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 text-right font-semibold">Variants</th>
                <th className="px-3 py-3 text-right font-semibold">Views</th>
                <th className="px-3 py-3 text-right font-semibold">Leads</th>
                <th className="px-3 py-3 text-right font-semibold">Confirmed</th>
                <th className="px-3 py-3 text-right font-semibold">Lead rate</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-border">
              {pages.map(({ record, totals, active }) => {
                const strategy = record.kind === "GO" ? getStrategy(record.templateSlug) : null;
                const leader = [...record.variants].sort((a, b) => b.views - a.views)[0];
                return (
                  <tr key={record.slug} className="align-top">
                    <td className="px-5 py-4">
                      <Link href={`/admin/pages/${record.id}`} className="font-semibold text-lp-navy hover:text-lp-teal">
                        {record.kind === "HOME" ? "Homepage hero" : record.slug}
                      </Link>
                      <p className="mt-0.5 text-xs text-lp-muted">
                        <a href={publicPath(record.slug)} target="_blank" rel="noreferrer" className="hover:text-lp-teal hover:underline">
                          {publicPath(record.slug)}
                        </a>
                        {leader ? <span className="ml-2 max-w-[320px] truncate align-bottom text-lp-navy/60">{leader.headline.replace(/\n/g, " ")}</span> : null}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-xs text-lp-navy/80">{record.kind === "HOME" ? "—" : strategy?.name ?? record.templateSlug}</td>
                    <td className="px-3 py-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[record.status] ?? ""}`}>{record.status.toLowerCase()}</span>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">
                      {active}/{record.variants.length}
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{totals.views.toLocaleString("en-US")}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{totals.leads.toLocaleString("en-US")}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{totals.confirmed.toLocaleString("en-US")}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-lp-navy">{pct(totals.conversion)}</td>
                    <td className="px-5 py-4 text-right">
                      <PageRowActions id={record.id ?? ""} slug={record.slug} kind={record.kind} status={record.status} />
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
