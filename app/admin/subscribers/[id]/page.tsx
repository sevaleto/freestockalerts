import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { NONE } from "@/lib/subscribers/cohort";
import { revenueCentsFor } from "@/lib/subscribers/report";
import { getNewsletterClickValueCents } from "@/lib/settings";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmt = (d: Date | null) => (d ? d.toLocaleString("en-US", { timeZone: "America/New_York" }) : "—");
const CHANNEL: Record<string, string> = { alert: "Alert email", beehiiv_fsa: "FSA newsletter", beehiiv_si: "Smart Investor", unknown: "Unknown" };

export default async function SubscriberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const s = await prisma.subscriber.findUnique({ where: { id }, include: { clicks: { orderBy: { ts: "desc" }, take: 200, include: { ad: { select: { name: true, headline: true } } } } } });
  if (!s) notFound();
  const newsletterValueCents = await getNewsletterClickValueCents(prisma);
  const facts: [string, string][] = [
    ["First seen", fmt(s.firstSeenAt)],
    ["Attribution from", s.attributionSource ?? "—"],
    ["Source / medium / campaign", [s.utmSource ?? NONE, s.utmMedium ?? NONE, s.utmCampaign ?? NONE].join(" / ")],
    ["Term / content", [s.utmTerm ?? "—", s.utmContent ?? "—"].join(" / ")],
    ["Referring site", s.referringSite ?? "—"],
    ["Landing path", s.landingPath ?? "—"],
    ["App account", s.userId ? `yes, since ${fmt(s.appCreatedAt)}` : "no"],
    ["FSA newsletter", s.beehiivFsaId ? `${s.beehiivFsaStatus} since ${fmt(s.beehiivFsaCreatedAt)} · ${Math.max(0, s.beehiivFsaUniqueClicks - s.beehiivFsaUniqueClicksBaseline)} unique clicks since tracking started (${s.beehiivFsaUniqueClicks} lifetime, ${s.beehiivFsaUniqueClicksBaseline} before)` : "not subscribed"],
    ["Smart Investor", s.beehiivSiId ? `${s.beehiivSiStatus} since ${fmt(s.beehiivSiCreatedAt)} · ${Math.max(0, s.beehiivSiUniqueClicks - s.beehiivSiUniqueClicksBaseline)} unique clicks since tracking started (${s.beehiivSiUniqueClicks} lifetime, ${s.beehiivSiUniqueClicksBaseline} before)` : "not subscribed"],
    ["Alert ad clicks", `${s.countedClicks} · ${usd(s.clickValueCents)}`],
    ["Revenue", `${usd(revenueCentsFor(s, newsletterValueCents))} (newsletter clicks at ${usd(newsletterValueCents)} + alert clicks at each ad's value)`],
    ["Tracking since", fmt(s.trackingStartedAt)],
    ["Beehiiv stats as of", fmt(s.beehiivStatsAt)],
  ];
  return (
    <div>
      <Link href="/admin/subscribers" className="text-sm font-medium text-lp-teal hover:underline">
        ← All subscribers
      </Link>
      <h1 className="mt-2 break-all font-serif text-3xl text-lp-navy">{s.email}</h1>
      <dl className="mt-6 grid gap-x-8 gap-y-3 rounded-[20px] border border-lp-border bg-white p-6 shadow-sm sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-lp-muted">{k}</dt>
            <dd className="mt-0.5 text-sm text-lp-navy">{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-8 font-serif text-2xl text-lp-navy">Clicks through our ad links</h2>
      <p className="mt-1 text-sm text-lp-muted">Alert-email clicks are credited here. Newsletter clicks are counted by Beehiiv for every link and shown above; a newsletter snippet click below is logged for the ad but not credited twice.</p>
      {s.clicks.length === 0 ? (
        <p className="mt-2 text-sm text-lp-muted">No ad clicks recorded.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[20px] border border-lp-border bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-lp-border text-xs uppercase tracking-[0.12em] text-lp-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">When</th>
                <th className="px-3 py-3 font-semibold">Ad</th>
                <th className="px-3 py-3 font-semibold">Channel</th>
                <th className="px-3 py-3 font-semibold">Counted</th>
                <th className="px-5 py-3 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-border">
              {s.clicks.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-lp-navy/80">{fmt(c.ts)}</td>
                  <td className="px-3 py-3 text-lp-navy">
                    {c.ad.name}
                    <span className="block text-xs text-lp-muted">{c.ad.headline}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-lp-navy/80">{CHANNEL[c.channel] ?? c.channel}</td>
                  <td className="px-3 py-3 text-xs text-lp-navy/80">{c.counted ? (c.valueCents > 0 ? "yes" : "yes (credited by Beehiiv)") : "no (bot or repeat)"}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-lp-navy">{usd(c.valueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
