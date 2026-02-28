"use client";

import { useState } from "react";
import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";

export function CookieConsent() {
  const { showBanner, acceptAll, rejectAll, savePreferences } =
    useCookieConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  if (!showBanner) return null;

  return (
    /* No backdrop — user can scroll & interact with the page freely */
    <div className="fixed inset-x-0 bottom-0 z-[9999] pointer-events-none p-3 sm:p-4">
      <div className="pointer-events-auto mx-auto max-w-xl rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm p-4 shadow-lg shadow-slate-900/5">
        {/* Compact single-line header + buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            We use cookies to improve your experience.{" "}
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:text-primary-hover"
            >
              {showDetails ? "Less" : "More"}
              {showDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={rejectAll}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
            >
              Reject
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

        {/* Expandable details */}
        {showDetails && (
          <div className="mt-3 space-y-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            {/* Essential — always on */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-text-primary">Essential</span>
              </div>
              <span className="text-[10px] font-medium text-emerald-600">Always on</span>
            </div>

            <div className="border-t border-slate-200" />

            {/* Analytics */}
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs font-medium text-text-primary">📊 Analytics</span>
              <ToggleSwitch checked={analytics} onChange={setAnalytics} />
            </label>

            <div className="border-t border-slate-200" />

            {/* Marketing */}
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs font-medium text-text-primary">📢 Marketing</span>
              <ToggleSwitch checked={marketing} onChange={setMarketing} />
            </label>

            <button
              type="button"
              onClick={() => savePreferences({ analytics, marketing })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
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
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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
