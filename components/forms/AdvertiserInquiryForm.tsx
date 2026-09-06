"use client";

import { useState } from "react";
import Link from "next/link";
import { useTurnstile } from "@/components/auth/useTurnstile";
import { Field, FIELD_CLASS, LABEL_CLASS } from "./FormField";

/**
 * The /advertise inquiry form. Posts JSON to /api/advertiser-inquiry, which
 * stores the lead and then emails sales. Same bones as PrivacyRequestForm:
 * status machine, honeypot, Turnstile, success and failure cards.
 *
 * The honeypot is `fax`, not `company`: company is a real required field here.
 * The success card publishes the sales address on purpose; the failure paths
 * point at support, because they only fire when the inquiry could not be stored.
 */
type Status = "idle" | "sending" | "done" | "error";

export function AdvertiserInquiryForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const turnstile = useTurnstile("light");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await fetch("/api/advertiser-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, turnstileToken: await turnstile.waitForToken() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setError(payload?.error ?? "Something went wrong. Please try again.");
        turnstile.reset();
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setError("We couldn't reach the server. Please email support@freestockalerts.ai so your inquiry is not lost.");
      turnstile.reset();
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="rounded-[20px] border border-lp-teal/30 bg-lp-mint p-6">
        <h3 className="text-lg font-semibold text-lp-navy">Thanks, we have your inquiry</h3>
        <p className="mt-2 text-sm leading-relaxed text-lp-navy/80">
          A dedicated manager will follow up personally, usually within one business day, with rates and a media kit for the formats that fit your offer.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-lp-navy/80">
          Need to add something in the meantime? Email{" "}
          <a href="mailto:chelsie@trading-tips.us" className="font-medium text-lp-teal underline underline-offset-2">
            chelsie@trading-tips.us
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} method="post" className="max-w-2xl" noValidate={false}>
      {/* Honeypot: hidden from sight and screen readers, skipped by Tab. Only a bot fills it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="fax">Fax</label>
        <input id="fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Your name" required autoComplete="name" />
        <Field name="email" label="Work email" required type="email" autoComplete="email" />
        <Field name="company" label="Company" required autoComplete="organization" />
        <Field name="website" label="Website" type="url" autoComplete="url" />
        <Field name="phone" label="Phone" type="tel" autoComplete="tel" />
      </div>

      <div className="mt-6">
        <label htmlFor="message" className={LABEL_CLASS}>
          What are you promoting?
        </label>
        <textarea id="message" name="message" rows={4} maxLength={2000} className={`${FIELD_CLASS} h-auto py-2.5`} />
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <turnstile.Widget />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-lp-teal px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "sending" ? "Sending…" : "Request rates & media kit"}
      </button>

      <p className="mt-6 text-sm leading-relaxed text-lp-muted">
        We use what you send here to answer your inquiry and nothing else. See our{" "}
        <Link href="/privacy" className="text-lp-teal underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
