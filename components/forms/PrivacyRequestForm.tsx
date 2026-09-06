"use client";

import { useState } from "react";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";
import { useTurnstile } from "@/components/auth/useTurnstile";
import { Field, FIELD_CLASS, LABEL_CLASS } from "./FormField";

/**
 * The privacy opt-out form (CCPA/CPRA and the similar state laws), carried
 * over field for field from research.tradingtips.com. Posts JSON to
 * /api/privacy-request, which writes an auditable row and alerts staff.
 *
 * A failure here is not a failed newsletter signup: if the write fails the
 * visitor is told to email support, because the request must not evaporate.
 * Agents are not shut out (CCPA requires that we accept them); they say so in
 * the details field or use the support address the page offers.
 */
type Status = "idle" | "sending" | "done" | "error";

export function PrivacyRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const turnstile = useTurnstile("light");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await fetch("/api/privacy-request", {
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
      setError("We couldn't reach the server. Please email support@freestockalerts.ai so your request is not lost.");
      turnstile.reset();
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="rounded-[20px] border border-lp-teal/30 bg-lp-mint p-6">
        <h2 className="text-lg font-semibold text-lp-navy">Request received</h2>
        <p className="mt-2 text-sm leading-relaxed text-lp-navy/80">
          We have recorded your request and will process it in line with our{" "}
          <Link href="/privacy" className="font-medium text-lp-teal underline underline-offset-2">
            Privacy Policy
          </Link>
          . We may contact you at the email or phone number you provided to verify your identity before completing it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} method="post" className="max-w-2xl">
      {/* Honeypot: hidden from sight and screen readers, skipped by Tab. Only a bot fills it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="firstName" label="First Name" required autoComplete="given-name" />
        <Field name="lastName" label="Last Name" required autoComplete="family-name" />
        <Field name="email" label="Email" required type="email" autoComplete="email" />
        <Field name="phone" label="Phone" type="tel" autoComplete="tel" />
      </div>

      <div className="mt-5 grid gap-5">
        <Field name="street" label="Address" autoComplete="street-address" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="city" label="City" autoComplete="address-level2" />
          <Field name="state" label="State" autoComplete="address-level1" />
          <Field name="zip" label="Zip / Postal Code" autoComplete="postal-code" />
          <div>
            <label htmlFor="country" className={LABEL_CLASS}>
              Country
            </label>
            <select id="country" name="country" className={FIELD_CLASS} defaultValue="">
              <option value="">Please select one</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="details" className={LABEL_CLASS}>
            Any other request details
          </label>
          <textarea id="details" name="details" rows={4} maxLength={2000} className={`${FIELD_CLASS} h-auto py-2.5`} />
        </div>
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
        {status === "sending" ? "Submitting…" : "Submit"}
      </button>

      <p className="mt-6 text-sm leading-relaxed text-lp-muted">
        <span className="font-semibold text-lp-navy">Acknowledgement.</span> By submitting this form, you acknowledge that the information you provided is true and accurate.
      </p>
    </form>
  );
}
