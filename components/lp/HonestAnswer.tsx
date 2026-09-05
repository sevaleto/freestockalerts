import Image from "next/image";
import { BellRing, Megaphone, ShieldCheck, UserRound } from "lucide-react";

interface HonestAnswerProps {
  /** Label of the page's primary CTA, e.g. "Send me the free watchlist". */
  ctaLabel: string;
  /** Anchor of the signup form on the page. */
  signupHref?: string;
}

const EXCHANGE = [
  { who: "You get", what: "Useful stock alerts at no cost", icon: BellRing },
  { who: "I get", what: "A chance to earn you as a reader", icon: UserRound },
  { who: "Advertisers get", what: "Space in the market letter", icon: Megaphone },
];

/**
 * Objection handling for "why is this free?": the three-party model, stated
 * plainly by the founder. No privacy claim is made here on purpose; the
 * privacy policy describes sharing with partners, so nothing stronger is
 * asserted.
 */
export function HonestAnswer({ ctaLabel, signupHref = "#signup" }: HonestAnswerProps) {
  return (
    <section id="why-free" className="border-t border-lp-border/70 bg-lp-bg py-16 md:py-20" aria-labelledby="why-free-heading">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lp-teal">The honest answer</p>
          <h2 id="why-free-heading" className="mt-4 font-serif text-3xl leading-tight text-lp-navy md:text-[2.75rem] md:leading-[1.15]">
            The alerts are free because the newsletter pays the bills.
          </h2>
        </div>

        <div className="mt-10 overflow-hidden rounded-[20px] border border-lp-border bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.15fr_1fr]">
            {/* Founder explanation */}
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="max-w-[60ch] text-lg leading-relaxed text-lp-navy/85 md:text-[1.3rem] md:leading-[1.65]">
                <p>
                  I&apos;ve been writing about markets for individual investors since 2006. FreeStockAlerts.AI gives you
                  something useful and gives me a chance to earn you as a reader. Advertisers support my market letter,
                  so I don&apos;t need to charge you for the alerts.
                </p>
                <p className="mt-5 font-serif text-2xl text-lp-teal md:text-[1.75rem]">That&apos;s the whole business model.</p>
              </div>

              <div className="mt-8 flex items-center gap-5">
                <Image
                  src="/founder-manny.jpg"
                  alt="Manny, founder of FreeStockAlerts.AI"
                  width={88}
                  height={88}
                  className="h-[88px] w-[88px] shrink-0 rounded-full object-cover ring-4 ring-lp-mint"
                />
                <div>
                  <p className="font-script text-4xl leading-none text-lp-navy" aria-hidden>
                    Manny
                  </p>
                  <p className="mt-1.5 text-sm text-lp-muted">
                    <span className="sr-only">Manny, </span>Founder, FreeStockAlerts.AI
                  </p>
                </div>
              </div>
            </div>

            {/* The exchange */}
            <div className="border-t border-lp-border p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">The simple exchange</h3>
              <ul className="mt-2 divide-y divide-lp-border">
                {EXCHANGE.map(({ who, what, icon: Icon }) => (
                  <li key={who} className="flex items-center gap-5 py-5">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-lp-mint text-lp-teal" aria-hidden>
                      <Icon className="h-7 w-7" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-lp-teal">{who}</p>
                      <p className="mt-1 text-lg leading-snug text-lp-navy">{what}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-lp-teal/20 bg-lp-mint px-6 py-5 sm:px-8">
            <ShieldCheck className="h-8 w-8 shrink-0 text-lp-teal" strokeWidth={1.5} aria-hidden />
            <p className="text-[15px] leading-relaxed text-lp-navy md:text-base">
              No credit card. No trial. No paid tier. The alerts stay free whether you read every edition of the market
              letter or none of them.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href={signupHref}
            className="inline-flex h-14 items-center justify-center rounded-xl bg-lp-teal px-10 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2 focus-visible:ring-offset-lp-bg"
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
