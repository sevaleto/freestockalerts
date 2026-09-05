import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Info, RefreshCw, Zap } from "lucide-react";
import { AlertProofList } from "@/components/lp/AlertProofList";
import { PhoneEmailPreview } from "@/components/lp/PhoneEmailPreview";
import { ActivateButton } from "@/components/templates/ActivateButton";
import { SectionChip } from "@/components/templates/SectionChip";
import { getStrategy, isRefreshOverdue, refreshAgeDays, SECTIONS, type StrategyDefinition, type TemplateItem } from "@/lib/templates/catalog";
import { strategyIcon } from "@/lib/templates/icons";
import { alertCountLabel, formatRefreshDate } from "@/lib/templates/format";
import { SignalList } from "@/components/templates/SignalList";
import { formatDataTimestamp } from "@/lib/strategies/present";
import type { RecentSignalsView } from "@/lib/strategies/signals";

interface StrategyDetailProps {
  strategy: StrategyDefinition;
  items: TemplateItem[];
  lastRefreshedAt: string;
  /** Present for signal strategies. */
  signals?: RecentSignalsView | null;
}

const DISCLAIMER =
  "Educational information only. FreeStockAlerts.AI is not an investment adviser and nothing on this page is a recommendation to buy or sell any security. Alerts describe price events; they do not predict what happens next. Past performance does not guarantee future results.";

function Section({ id, title, children, className = "" }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`rounded-[20px] border border-lp-border bg-white p-6 shadow-sm sm:p-7 ${className}`}>
      <h2 id={id} className="font-serif text-2xl text-lp-navy">
        {title}
      </h2>
      <div className="mt-4 text-[15px] leading-relaxed text-lp-navy/85">{children}</div>
    </section>
  );
}

function RuleList({ items, tone = "check" }: { items: string[]; tone?: "check" | "warn" | "dot" }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          {tone === "check" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lp-green" aria-hidden />
          ) : tone === "warn" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          ) : (
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lp-teal" aria-hidden />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Shared strategy page body. Everything a reader needs to judge the setup is
 * above the fold: category, name, value proposition, trigger, alert count,
 * cadence, last refresh, and the activation button.
 */
export function StrategyDetail({ strategy, items, lastRefreshedAt, signals = null }: StrategyDetailProps) {
  const Icon = strategyIcon(strategy.icon);
  const isSignal = strategy.kind === "signal";
  const lastScanAt = signals?.lastScan?.finishedAt ?? signals?.lastScan?.startedAt ?? null;
  // For signal strategies "last refreshed" is the last completed scan.
  const effectiveRefreshedAt = isSignal ? (lastScanAt ? new Date(lastScanAt).toISOString() : "") : lastRefreshedAt;
  const refreshed = isSignal ? (lastScanAt ? formatDataTimestamp(lastScanAt) : "") : formatRefreshDate(lastRefreshedAt);
  const view = { ...strategy, lastRefreshedAt: effectiveRefreshedAt };
  const overdue = isRefreshOverdue(view);
  const age = refreshAgeDays(view);
  const empty = !isSignal && items.length === 0;
  const related = strategy.related.map(getStrategy).filter((s): s is StrategyDefinition => !!s);
  const sectionLabel = SECTIONS[strategy.section].label;

  const facts: Array<{ label: string; value: React.ReactNode; icon: typeof Zap }> = [
    { label: "Trigger", value: strategy.triggerSummary, icon: Zap },
    { label: "Alerts", value: isSignal ? "Event-driven: one email per confirmed signal" : alertCountLabel(items.length), icon: Bell },
    { label: isSignal ? "Scan cadence" : "Refresh cadence", value: strategy.refreshCadence, icon: RefreshCw },
    {
      label: isSignal ? "Last scan" : "Last refreshed",
      value: refreshed ? (
        <>
          {refreshed}
          {!isSignal && age !== null ? <span className="text-lp-muted"> ({age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`})</span> : null}
        </>
      ) : isSignal ? (
        "No scan completed yet"
      ) : (
        "Not yet built"
      ),
      icon: Info,
    },
  ];

  return (
    <>
      {/* Above the fold */}
      <section aria-labelledby="strategy-title" className="rounded-[20px] border border-lp-border bg-white p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <SectionChip section={strategy.section} />
              <span className="flex items-center gap-2 text-sm font-semibold text-lp-navy">
                <Icon className="h-4 w-4 text-lp-teal" aria-hidden />
                {strategy.name}
              </span>
            </div>
            <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.16em] text-lp-blue">{strategy.landing.eyebrow}</p>
            <h1 id="strategy-title" className="mt-3 font-serif text-[2.25rem] leading-[1.05] text-lp-navy md:text-[3rem]">
              {strategy.landing.headline}
            </h1>
            <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-lp-navy/80">{strategy.landing.description}</p>
            <p className="mt-3 max-w-[38rem] text-[15px] leading-relaxed text-lp-navy/70">{strategy.valueProposition}</p>

            <dl className="mt-7 grid gap-3 sm:grid-cols-2">
              {facts.map(({ label, value, icon: FactIcon }) => (
                <div key={label} className="rounded-xl border border-lp-border/70 bg-lp-bg px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-lp-muted">
                    <FactIcon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium leading-snug text-lp-navy">{value}</dd>
                </div>
              ))}
            </dl>

            {overdue ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-lp-navy" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span>
                  {isSignal
                    ? lastScanAt
                      ? `The last completed scan was ${refreshed}, longer ago than expected. Subscriptions still work; alerts resume with the next scan.`
                      : "The daily scan has not completed yet on this deployment. You can activate now; alerts start with the first confirmed signal."
                    : empty
                      ? "This list has not been built from market data yet, so there are no alerts to activate. Check back after the next refresh."
                      : `This list is past its ${strategy.refreshCadence.toLowerCase()} refresh. The alerts still work; the constituents reflect the data as of ${refreshed}.`}
                </span>
              </p>
            ) : null}

            <div className="mt-7">
              <ActivateButton slug={strategy.slug} templateName={strategy.name} label={strategy.landing.cta} disabled={empty} />
              <p className="mt-3 text-xs text-lp-muted">Free. No credit card. Each alert fires once, then pauses until you re-arm it.</p>
            </div>
          </div>

          <div className="min-w-0 lg:justify-self-end">
            <PhoneEmailPreview alert={strategy.sampleAlert} />
          </div>
        </div>
      </section>

      {/* Method */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section id="watches" title="What this strategy watches">
          <p>{strategy.watches}</p>
          <p className="mt-4 text-sm text-lp-muted">
            <span className="font-semibold text-lp-navy">Universe:</span> {strategy.universe}
          </p>
        </Section>
        <Section id="qualify" title="How companies qualify">
          <RuleList items={strategy.qualificationRules} />
        </Section>
        <Section id="trigger" title="What triggers the alert">
          <RuleList items={strategy.triggerRules} tone="dot" />
        </Section>
        <Section id="disqualify" title="What keeps a company off the list">
          <RuleList items={strategy.disqualifiers} tone="warn" />
        </Section>
      </div>

      {/* Current list */}
      <section aria-labelledby="alerts" className="mt-8">
        {isSignal ? (
          <>
            <h2 id="alerts" className="font-serif text-2xl text-lp-navy">
              Recent confirmed signals
            </h2>
            <p className="mt-1 text-sm text-lp-muted">
              There is no fixed list. These are the most recent alerts the scan produced; activating the strategy sends you the next ones.
              {signals?.lastScan ? ` The last scan checked ${signals.lastScan.candidates} candidates and ${signals.lastScan.qualified} qualified.` : ""}
            </p>
            <SignalList signals={signals?.signals ?? []} lastScanAt={lastScanAt} strategyName={strategy.name} className="mt-4" />
          </>
        ) : null}
        <div className={`flex flex-wrap items-end justify-between gap-3 ${isSignal ? "hidden" : ""}`}>
          <div>
            <h2 id={isSignal ? "alerts-list" : "alerts"} className="font-serif text-2xl text-lp-navy">
              Current alert list
            </h2>
            <p className="mt-1 text-sm text-lp-muted">
              {refreshed ? `As of ${refreshed}. ` : ""}
              Refreshed {strategy.refreshCadence.charAt(0).toLowerCase() + strategy.refreshCadence.slice(1)}.
              {strategy.screened ? ` Screened from ${strategy.screened.universeSize.toLocaleString()} companies; ${strategy.screened.qualifiedCount} passed every rule.` : ""}
            </p>
          </div>
        </div>
        {isSignal ? null : empty ? (
          <p className="mt-4 rounded-[20px] border border-lp-border bg-white p-6 text-sm text-lp-muted">
            No constituents right now. This list is generated from market data by the refresh script, and the current run produced no names or has not been run.
          </p>
        ) : (
          <AlertProofList items={items} title={`${alertCountLabel(items.length)} in this strategy`} columns={2} className="mt-4" />
        )}
      </section>

      {/* Judgment */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section id="why" title="Why investors watch this setup">
          <p>{strategy.whyInvestorsWatch}</p>
        </Section>
        <Section id="fails" title="When this signal can fail">
          <RuleList items={strategy.whenItFails} tone="warn" />
        </Section>
        <Section id="method" title="How the list is built" className="lg:col-span-2">
          <p>{strategy.methodology}</p>
          {strategy.dataLimitations.length > 0 ? (
            <div className="mt-4 rounded-xl border border-lp-border/70 bg-lp-bg p-4">
              <p className="text-sm font-semibold text-lp-navy">Data limits, stated plainly</p>
              <ul className="mt-2 space-y-1.5 text-sm text-lp-navy/80">
                {strategy.dataLimitations.map((l) => (
                  <li key={l} className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lp-blue" aria-hidden />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      </div>

      {/* Risk + CTA */}
      <section aria-labelledby="risk" className="mt-8 rounded-[20px] border border-lp-teal/20 bg-lp-mint p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <h2 id="risk" className="font-serif text-2xl text-lp-navy">
              Risk, in one paragraph
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-lp-navy/85">{strategy.riskSummary}</p>
          </div>
          <div className="lg:justify-self-end">
            <ActivateButton slug={strategy.slug} templateName={strategy.name} label={strategy.landing.cta} disabled={empty} />
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 ? (
        <section aria-labelledby="related" className="mt-8">
          <h2 id="related" className="font-serif text-2xl text-lp-navy">
            Related strategies
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {related.map((r) => {
              const RIcon = strategyIcon(r.icon);
              return (
                <li key={r.slug}>
                  <Link
                    href={`/templates/${r.slug}`}
                    className="group flex h-full flex-col rounded-[20px] border border-lp-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-lp-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2"
                  >
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-lp-muted">
                      <RIcon className="h-3.5 w-3.5 text-lp-teal" aria-hidden />
                      {SECTIONS[r.section].label}
                    </span>
                    <span className="mt-2 text-base font-semibold text-lp-navy group-hover:text-lp-teal">{r.name}</span>
                    <span className="mt-1 text-sm text-lp-navy/70">{r.triggerSummary}</span>
                    <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-semibold text-lp-teal">
                      Preview strategy <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-xs leading-relaxed text-lp-muted">
        {DISCLAIMER}{" "}
        <Link href="/disclaimer" className="underline underline-offset-2 hover:text-lp-navy">
          Full disclaimer
        </Link>
        . Part of the <Link href="/templates" className="underline underline-offset-2 hover:text-lp-navy">{sectionLabel}</Link> section.
      </p>
    </>
  );
}
