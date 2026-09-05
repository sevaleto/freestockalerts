"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile, managed (mostly invisible) mode.
 *
 * `useTurnstile()` returns a token to send with the signup request plus a
 * `<Widget />` to drop inside the form. When NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is unset the widget renders nothing and the token stays undefined, so the
 * forms work in development without keys.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
    __turnstileLoading?: Promise<void>;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!window.__turnstileLoading) {
    window.__turnstileLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("turnstile script failed"));
      document.head.appendChild(s);
    });
  }
  return window.__turnstileLoading;
}

export function useTurnstile(theme: "light" | "dark" = "light") {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const tokenRef = useRef<string | undefined>(undefined);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetId.current) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          size: "flexible",
          appearance: "interaction-only", // invisible unless Cloudflare needs a click
          callback: (t: string) => { setToken(t); setFailed(false); },
          "expired-callback": () => setToken(undefined),
          "error-callback": () => { setToken(undefined); setFailed(true); },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
  }, [theme]);

  /** Resolve with the current token, waiting briefly if the widget is still solving. */
  const waitForToken = useCallback(async (timeoutMs = 6000): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    const start = Date.now();
    while (!tokenRef.current && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 120));
    }
    return tokenRef.current;
  }, []);

  /** Get a fresh token after a submit (tokens are single-use). */
  const reset = useCallback(() => {
    setToken(undefined);
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, []);

  const Widget = useCallback(
    () => (SITE_KEY ? <div ref={containerRef} className="turnstile-slot" aria-live="polite" /> : null),
    []
  );

  return { token, failed, enabled: !!SITE_KEY, reset, waitForToken, Widget };
}
