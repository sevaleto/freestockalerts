"use client";

import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";

/**
 * Opens the site's privacy-choices panel (the cookie and pixel half of a
 * "do not sell or share" opt-out) alongside the form that handles the
 * server-side half. A button styled as a link: it performs an action rather
 * than navigating. If the panel cannot open for any reason the click scrolls
 * to the request form, so a statutory control never swallows a click.
 */
export function PrivacyChoicesLink({ className = "", fallbackTargetId, children }: { className?: string; fallbackTargetId?: string; children: React.ReactNode }) {
  const { openBanner } = useCookieConsent();
  return (
    <button
      type="button"
      className={`cursor-pointer text-left ${className}`}
      onClick={() => {
        try {
          openBanner();
        } catch {
          if (fallbackTargetId) document.getElementById(fallbackTargetId)?.scrollIntoView({ block: "start" });
        }
      }}
    >
      {children}
    </button>
  );
}
