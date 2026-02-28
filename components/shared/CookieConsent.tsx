"use client";

import { useState } from "react";
import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";
import { Cookie, ChevronDown, ChevronUp, Shield } from "lucide-react";

export function CookieConsent() {
  const { showBanner, acceptAll, rejectAll, savePreferences } =
    useCookieConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  if (!showBanner) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px]" />

      {/* Banner */}
      <div className="fixed inset-x-0 bottom-0 z-[9999] animate-fade-up p-4 sm:p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 sm:p-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text-primary">
                We value your privacy
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                We use cookies to improve your experience and analyze site
                traffic. You can choose which cookies to allow.
              </p>
            </div>
          </div>

          {/* Expandable details */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
          >
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showDetails ? "Hide details" : "Customize preferences"}
          </button>

          {showDetails && (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              {/* Essential — always on */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-text-primary">
                      Essential
                    </span>
                  </div>
                  <p className="mt-0.5 pl-6 text-xs text-slate-500">
                    Authentication, security, basic site functionality
                  </p>
                </div>
                <div className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Always on
                </div>
              </div>

              <div className="border-t border-slate-200" />

              {/* Analytics */}
              <label className="flex cursor-pointer items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    📊 Analytics
                  </span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Help us understand how visitors use the site
                  </p>
                </div>
                <ToggleSwitch
                  checked={analytics}
                  onChange={setAnalytics}
                />
              </label>

              <div className="border-t border-slate-200" />

              {/* Marketing */}
              <label className="flex cursor-pointer items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    📢 Marketing
                  </span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Meta Pixel, TikTok Pixel, and ad personalization
                  </p>
                </div>
                <ToggleSwitch
                  checked={marketing}
                  onChange={setMarketing}
                />
              </label>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={rejectAll}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Reject all
            </button>
            {showDetails && (
              <button
                type="button"
                onClick={() => savePreferences({ analytics, marketing })}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Save preferences
              </button>
            )}
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Simple toggle switch */
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
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-primary
        ${checked ? "bg-primary" : "bg-slate-200"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white
          shadow ring-0 transition-transform duration-200
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}
