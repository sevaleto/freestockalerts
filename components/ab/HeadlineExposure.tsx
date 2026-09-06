"use client";

import { useEffect } from "react";
import { VARIANT_COOKIE, VARIANT_COOKIE_MAX_AGE } from "@/lib/cookies/bucket";

/**
 * Records which headline variant this browser saw.
 *
 * 1. Writes the `fsa_var` cookie ("<page slug>:<key>") that the auth routes
 *    read at signup and store on User.signupVariant. Every signup surface on
 *    the page (email form, Google, resend, one-time code) inherits it.
 * 2. Sends one view beacon per browser session per variant so the admin can
 *    compute a conversion rate. Skipped when the variant was forced with
 *    `?v=` (previews are not traffic).
 */
export function HeadlineExposure({ tag, count = true }: { tag: string; count?: boolean }) {
  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${VARIANT_COOKIE}=${encodeURIComponent(tag)}; Path=/; Max-Age=${VARIANT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    // The pre-2026-09 client-side test left a year-long cookie behind; nothing reads it any more.
    if (document.cookie.includes("ab_hero_headline=")) document.cookie = "ab_hero_headline=; Path=/; Max-Age=0; SameSite=Lax";
    if (!count) return;
    const seenKey = `fsa_seen:${tag}`;
    try {
      if (sessionStorage.getItem(seenKey)) return;
      sessionStorage.setItem(seenKey, "1");
    } catch {
      // Storage blocked: count the view anyway; the server dedupes nothing, so refreshes may double-count here.
    }
    fetch("/api/ab/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
      keepalive: true,
    }).catch(() => {});
  }, [tag, count]);

  return null;
}
