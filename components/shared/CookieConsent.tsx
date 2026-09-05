"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";

/**
 * One panel, two jobs:
 *  - optin mode (EEA/UK/CH): shown on first visit until the visitor chooses.
 *    Reject and Accept carry equal weight.
 *  - optout mode (US and everyone else): never shown unprompted. Opened from
 *    the footer ("Cookie Settings" / "Do Not Sell or Share"), it opens
 *    straight into the switches, pre-set to what currently applies.
 */
export function CookieConsent() {
  const { showBanner, mode, gpc, effective, acceptAll, rejectAll, savePreferences } = useCookieConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Seed the switches from what applies right now each time the panel opens.
  useEffect(() => {
    if (!showBanner) return;
    setAnalytics(effective.analytics);
    setMarketing(effective.marketing);
    setShowDetails(mode === "optout");
  }, [showBanner, mode, effective.analytics, effective.marketing]);

  if (!showBanner) return null;

  const optout = mode === "optout";

  return (
    /* No backdrop — user can scroll & interact with the page freely */
    <div className="fixed inset-x-0 bottom-0 z-[9999] pointer-events-none p-3 sm:p-4" role="dialog" aria-label={optout ? "Your privacy choices" : "Cookie consent"}>
      <div className="pointer-events-auto mx-auto max-w-xl rounded-xl border border-lp-border/80 bg-white/95 p-4 shadow-lg shadow-lp-navy/5 backdrop-blur-sm">
        {optout ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-lp-navy">Your privacy choices</p>
            <p className="text-sm text-lp-navy/75">
              Analytics and advertising cookies are on by default. Turn off &quot;Marketing&quot; to opt out of the sale or
              sharing of your information through cookies on this browser.{" "}
              <Link href="/privacy" className="font-medium text-primary underline-offset-2 hover:underline">Privacy Policy</Link>
            </p>
            {gpc ? (
              <p className="text-xs text-lp-teal">
                Your browser sent a Global Privacy Control signal, so advertising cookies are already off unless you turn them on.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-lp-navy/75">
              We use cookies for analytics and advertising.{" "}
              <Link href="/privacy" className="font-medium text-primary underline-offset-2 hover:underline">Privacy Policy</Link>
              {" · "}
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:text-primary-hover"
              >
                {showDetails ? "Less" : "Manage"}
                {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </p>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={rejectAll}
                className="rounded-lg border border-lp-navy/30 bg-white px-4 py-1.5 text-xs font-semibold text-lp-navy transition-colors hover:bg-lp-bg"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Accept all
              </button>
            </div>
          </div>
        )}

        {/* Category switches */}
        {showDetails && (
          <div className="mt-3 space-y-2.5 rounded-lg border border-lp-border bg-lp-bg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-lp-green" />
                <span className="text-xs font-medium text-text-primary">Essential</span>
              </div>
              <span className="text-[10px] font-medium text-lp-green">Always on</span>
            </div>

            <div className="border-t border-lp-border" />

            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs font-medium text-text-primary">📊 Analytics</span>
              <ToggleSwitch checked={analytics} onChange={setAnalytics} />
            </label>

            <div className="border-t border-lp-border" />

            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs font-medium text-text-primary">📢 Marketing (ad pixels, retargeting)</span>
              <ToggleSwitch checked={marketing} onChange={setMarketing} />
            </label>

            <button
              type="button"
              onClick={() => savePreferences({ analytics, marketing })}
              className={
                optout
                  ? "mt-1 w-full rounded-lg bg-primary py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                  : "mt-1 w-full rounded-lg border border-lp-border bg-white py-1.5 text-xs font-medium text-lp-navy/75 transition-colors hover:bg-lp-bg"
              }
            >
              Save preferences
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact toggle switch */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-primary
        ${checked ? "bg-primary" : "bg-slate-200"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-white
          shadow ring-0 transition-transform duration-200
          ${checked ? "translate-x-4" : "translate-x-0"}
        `}
      />
    </button>
  );
}
