import Link from "next/link";
import {
  BellPlus,
  Sparkles,
  LayoutGrid,
  ShieldCheck,
  Clock3,
  BadgeDollarSign,
} from "lucide-react";

interface MemberBenefitsProps {
  templateName: string;
  ctaLabel: string;
}

const BENEFITS = [
  {
    icon: BellPlus,
    title: "Set up any alert you want",
    body: "Price levels, % moves, RSI, moving-average crosses, 52-week highs and lows, volume spikes, earnings reminders. Twelve alert types on any US stock or ETF, up to 50 alerts of your own.",
  },
  {
    icon: LayoutGrid,
    title: "Every strategy template, one click",
    body: "Nine ready-made alert sets, from momentum breakouts to sector rotation to a Buffett-style value watchlist. Turn any of them on from your dashboard.",
  },
  {
    icon: Sparkles,
    title: "AI context on every alert",
    body: "Each email tells you what happened, why the level matters, and what traders typically watch next. Not just a price ping.",
  },
  {
    icon: Clock3,
    title: "Checked every 5 minutes",
    body: "Alerts are evaluated every five minutes during market hours and land in your inbox within minutes of the trigger.",
  },
  {
    icon: ShieldCheck,
    title: "No alert spam",
    body: "Each alert fires once, then pauses. Daily-move and volume alerts email you at most once a day. You control what's on and off.",
  },
  {
    icon: BadgeDollarSign,
    title: "Free. No asterisk.",
    body: "No credit card, no trial, no paid tier. Every feature and every template is free, and you can unsubscribe in one click.",
  },
];

/** "What else you get" section for ad landing pages. */
export function MemberBenefits({ templateName, ctaLabel }: MemberBenefitsProps) {
  return (
    <section className="border-t border-slate-100 bg-surface py-16">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Included with your free account</p>
          <h2 className="mt-3 text-3xl font-bold text-text-primary md:text-4xl">
            {templateName} is just the start.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Signing up activates these alerts for you. It also gives you a full alerting account you can shape around your own watchlist.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <Link
            href="#signup"
            className="inline-flex h-12 items-center justify-center rounded-md bg-emerald-600 px-8 text-base font-semibold text-white shadow-lg transition-colors hover:bg-emerald-700"
          >
            {ctaLabel}
          </Link>
          <p className="text-xs text-slate-500">No credit card. No paid tiers, ever. Unsubscribe anytime.</p>
        </div>
      </div>
    </section>
  );
}
