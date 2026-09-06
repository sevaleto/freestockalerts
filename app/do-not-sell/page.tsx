import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { Footer } from "@/components/shared/Footer";
import { PrivacyRequestForm } from "@/components/forms/PrivacyRequestForm";
import { PrivacyChoicesLink } from "@/components/forms/PrivacyChoicesLink";

/**
 * Modeled on research.tradingtips.com/do-not-sell. Unlike the other legal
 * pages this one is functional, not prose: the privacy policy sends readers
 * here to exercise their opt-out, so the form has to actually work.
 *
 * The copy explains the right before asking for anything. It is not
 * California-only: residents of any state with an applicable privacy law are
 * invited, and opt-outs from any US visitor are processed regardless.
 *
 * Two halves of one opt-out: the form (server-side records and lists) posts
 * to /api/privacy-request; the cookie and pixel half is the site's own
 * privacy-choices panel, opened from the link in "How to opt out".
 */

const LAST_UPDATED = "September 5, 2026";
const HEADING = "mt-10 mb-3 text-xl font-semibold text-lp-navy";
const LINK = "text-lp-teal underline underline-offset-2 hover:text-lp-teal-dark";
const SUPPORT = "support@freestockalerts.ai";

export const metadata: Metadata = {
  title: { absolute: "Do Not Sell or Share My Personal Information | Unsubscribe | FreeStockAlerts.AI" },
  description: "Opt out of the sale or sharing of your personal information by Wealthpire Inc. d/b/a FreeStockAlerts.AI, or unsubscribe from our emails.",
  alternates: { canonical: "/do-not-sell" },
};

export default function DoNotSellPage() {
  return (
    <div className="min-h-screen bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-6 sm:py-8">
        <Logo size="lg" />
        <Link href="/" className="shrink-0 text-sm text-text-secondary hover:text-text-primary">
          ← Back to home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-20 sm:px-6">
        <h1 className="font-serif text-4xl leading-tight text-lp-navy md:text-5xl">Do Not Sell or Share My Personal Information | Unsubscribe</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-lp-navy/80">Opt out of the sale or sharing of your personal information, or unsubscribe from our emails.</p>
        <p className="mt-3 text-sm text-text-secondary">Last updated {LAST_UPDATED}.</p>

        <div className="mt-10 max-w-3xl text-base leading-relaxed text-lp-navy/90">
          <p className="mb-5">
            FreeStockAlerts.AI is in the business of creating stock alerts and research tools and making them available to investors at all levels through its website and its emails. To that end, any personal information that we collect (as noted in our{" "}
            <Link href="/privacy" className={LINK}>
              privacy policy
            </Link>
            ) is used with the intent to align you with the best stock research and other related (or unrelated) service providers and offers that we deem to best suit your needs. FreeStockAlerts.AI and its emails are 100% opt-in based, and we do not send any unsolicited email (commonly referred to as spam) to our subscribers.
          </p>

          <p className="mb-5">
            Nevertheless, if you live in a state with an applicable privacy law, such as the California Consumer Privacy Act (CCPA), you may use the form below to submit a &ldquo;do not sell or share my personal information&rdquo; request. We process opt-out requests from any visitor in the United States, whether or not your state has such a law.
          </p>

          <h2 className={HEADING}>Right to Opt Out of the Sale or Sharing of Personal Information</h2>
          <p className="mb-5">
            The California Consumer Privacy Act (CCPA) and similar privacy laws in other states give consumers the right to stop businesses from selling or sharing their personal information by choosing to &ldquo;opt out.&rdquo; These rights may be exercised at any time.
          </p>

          <h2 className={HEADING}>How to Opt Out</h2>
          <ul className="mb-5 list-disc space-y-3 pl-6 marker:text-lp-teal">
            <li>By completing the form below.</li>
            <li>
              By sending an email to{" "}
              <a href={`mailto:${SUPPORT}`} className={LINK}>
                {SUPPORT}
              </a>
              .
            </li>
            <li>
              To stop cookies and ad pixels from sharing your browsing data with advertising partners:{" "}
              <PrivacyChoicesLink className={LINK} fallbackTargetId="opt-out-request-form">
                Do Not Sell or Share My Personal Information
              </PrivacyChoicesLink>{" "}
              (opens your privacy choices for this browser).
            </li>
          </ul>

          <h2 className={HEADING}>How to Unsubscribe</h2>
          <p className="mb-5">
            To stop receiving our emails, use the unsubscribe link at the bottom of any message we send. Alert emails can also be turned off under{" "}
            <Link href="/dashboard/settings" className={LINK}>
              Settings
            </Link>{" "}
            in your account. Unsubscribing does not by itself opt you out of the sale or sharing of your information; use the form below for that.
          </p>

          <h2 id="opt-out-request-form" className={`${HEADING} scroll-mt-24`}>
            Opt-Out Request Form
          </h2>
          <p className="mb-8">The information you provide in this form will only be used for the purpose of verifying and processing your request.</p>

          <div className="rounded-[20px] border border-lp-border bg-white p-6 shadow-sm sm:p-8">
            <PrivacyRequestForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
