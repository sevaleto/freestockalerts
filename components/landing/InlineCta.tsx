import { EmailSignupForm } from "@/components/landing/EmailSignupForm";

/** Mid-page ask so nobody scrolls ten screens without a place to sign up. */
export function InlineCta() {
  return (
    <section className="border-t border-lp-border/70 bg-lp-mint py-12">
      <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:px-12">
        <div>
          <h2 className="font-serif text-2xl text-lp-navy md:text-3xl">Set your first alert in 60 seconds.</h2>
          <p className="mt-2 text-base text-lp-navy/75">Free forever. No credit card. One email per alert, never a flood.</p>
        </div>
        <EmailSignupForm source="inline-cta" contentName="home_inline_cta" inline />
      </div>
    </section>
  );
}
