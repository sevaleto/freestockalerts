import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { Footer } from "@/components/shared/Footer";
import { AdvertiserInquiryForm } from "@/components/forms/AdvertiserInquiryForm";

/**
 * The advertiser-facing pitch, ending in an inquiry form. Modeled on
 * research.tradingtips.com/advertise, and the same three rules govern the copy:
 *
 * 1. NO AUDIENCE FIGURES. No list size, open rate or subscriber count appears
 *    here, because we do not have substantiated ones to publish. Every claim
 *    is qualitative and defensible as written.
 * 2. NO RATES. Pricing is deliberately absent; sales quotes against the ask.
 * 3. NO NAMED STAFF IN THE PROSE. "A dedicated manager", never who. Inbound
 *    routing is an env var (ADVERTISER_INQUIRY_TO) so it can change without a
 *    deploy. The form's success card publishes the sales address on purpose.
 *
 * The financial-content rules in CLAUDE.md apply here too: "advertisers get
 * results" is a performance claim and cannot be guaranteed.
 */

export const metadata: Metadata = {
  title: "Advertise with FreeStockAlerts.AI",
  description:
    "Reach self-directed investors who signed up for stock alerts. Dedicated email sends, newsletter sponsorships, and lead generation across the Trading Tips family of publications.",
  alternates: { canonical: "/advertise" },
  openGraph: {
    title: "Advertise with FreeStockAlerts.AI",
    description: "Put your offer in front of self-directed investors who came here to invest.",
    url: "/advertise",
    images: ["/og-image.png"],
  },
};

const REASONS = [
  {
    name: "Two decades in this niche",
    body: "FreeStockAlerts.AI is a Wealthpire property, the publisher behind Trading Tips, which has written to investors since 2006. We know which offers this audience responds to and, just as usefully, which ones it doesn't, so we will tell you before a campaign runs, not after.",
  },
  {
    name: "Creative help included",
    body: "Direct-response copy for financial offers is our own core skill. If your creative isn't landing, we'll rework it with you rather than let the placement run flat.",
  },
  {
    name: "One person on your account",
    body: "A dedicated manager handles your campaign end to end: scoping, scheduling, creative and reporting. You are not filing tickets into a queue.",
  },
];

const STEPS = [
  { step: "Tell us what you're promoting", body: "The form below. A sentence or two about the offer is plenty." },
  { step: "We send rates and a media kit", body: "Priced against the formats you actually want, usually within one business day." },
  { step: "Creative and scheduling", body: "You supply the creative or we build it with you, then we agree on dates." },
  { step: "Launch and report", body: "Your campaign runs and you get the numbers behind it." },
];

export default function AdvertisePage() {
  return (
    <div className="min-h-screen bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-6 sm:py-8">
        <Logo size="lg" />
        <Link href="/" className="shrink-0 text-sm text-text-secondary hover:text-text-primary">
          ← Back to home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6">
        {/* Hero */}
        <section className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Advertise with us</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-lp-navy md:text-5xl">Put your offer in front of people who came here to invest.</h1>
          <p className="mt-6 text-lg leading-relaxed text-lp-navy/80">
            FreeStockAlerts.AI readers signed up to get stock alerts with plain-English context, and they open our email because they want the next one. That is a different proposition from renting impressions on a general-interest site.
          </p>
          <a
            href="#inquire"
            className="mt-8 inline-flex h-12 items-center rounded-xl bg-lp-teal px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2"
          >
            Request rates &amp; media kit
            <span aria-hidden="true" className="ml-2">
              →
            </span>
          </a>
        </section>

        {/* Who you reach: qualitative by design. See the file header. */}
        <section aria-labelledby="audience" className="mt-16 sm:mt-20">
          <h2 id="audience" className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">
            Who you reach
          </h2>
          <div className="mt-5 max-w-2xl text-base leading-relaxed text-lp-navy/85">
            <p>
              Our audience is self-directed retail investors in the United States. They came to us through a stock-alert or investing offer, not a general newsletter roundup, so the intent is already there before your ad appears.
            </p>
            <p className="mt-5">
              They follow the market, set their own alerts on the stocks they hold or watch, and read the research we send by choice. In practice that means offers in trading education, brokerage and platform services, newsletters and research, alternative assets and precious metals, and retirement and income products tend to fit here.
            </p>
          </div>
        </section>

        {/* Why us */}
        <section aria-labelledby="why" className="mt-16 rounded-[20px] bg-lp-navy p-8 text-white sm:mt-20 sm:p-12">
          <h2 id="why" className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-mint">
            Why advertise with us
          </h2>
          <div className="mt-8 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {REASONS.map((reason) => (
              <div key={reason.name}>
                <h3 className="text-lg font-semibold tracking-tight text-white">{reason.name}</h3>
                <p className="mt-2 text-base leading-relaxed text-white/80">{reason.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="mt-16 sm:mt-20">
          <h2 id="how" className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">
            How it works
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((item, index) => (
              <li key={item.step} className="rounded-[20px] border border-lp-border bg-white p-6 shadow-sm">
                <span aria-hidden="true" className="font-mono text-sm font-semibold text-lp-teal">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-base font-semibold tracking-tight text-lp-navy">{item.step}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-lp-navy/75">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Inquiry form */}
        <section id="inquire" aria-labelledby="inquire-heading" className="mt-16 scroll-mt-24 sm:mt-20">
          <h2 id="inquire-heading" className="font-serif text-3xl text-lp-navy md:text-4xl">
            Tell us what you&rsquo;re promoting
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-lp-navy/80">
            A dedicated manager will come back to you personally, usually within one business day, with rates and a media kit for the formats you&rsquo;re interested in.
          </p>
          <div className="mt-10 rounded-[20px] border border-lp-border bg-white p-6 shadow-sm sm:p-8">
            <AdvertiserInquiryForm />
          </div>
        </section>

        {/* Compliance: the page's only advertiser-specific legal note. The site footer covers general investment risk, not these two claims. */}
        <section aria-label="Advertising disclaimer" className="mt-16 max-w-2xl border-t border-lp-border pt-8 sm:mt-20">
          <p className="text-sm leading-relaxed text-lp-muted">
            Advertising with us is not an endorsement of any advertiser or offer, and nothing we publish is personalized investment advice. Campaign results depend on your offer, creative and market conditions; past campaign performance does not guarantee future results.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
