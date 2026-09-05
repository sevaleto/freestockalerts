"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type ConsentCategory,
  type ConsentPreferences,
  acceptAllPreferences,
  rejectAllPreferences,
  effectivePreferences,
  getConsent,
  hasGpc,
  readRegionCookie,
  setConsent,
} from "./consent";
import type { ConsentRegion } from "./region";

export type ConsentMode = ConsentRegion;

interface CookieConsentContextValue {
  /** Stored choice (null = the visitor hasn't chosen; region defaults apply) */
  preferences: ConsentPreferences | null;
  /** What applies right now: stored choice, else the region default */
  effective: ConsentPreferences;
  /** "optin" (EEA/UK/CH: banner until a choice) or "optout" (no banner, on by default) */
  mode: ConsentMode;
  /** Browser sent a Global Privacy Control signal */
  gpc: boolean;
  /** Whether the banner should show */
  showBanner: boolean;
  /** Check consent for a category */
  hasConsent: (category: ConsentCategory) => boolean;
  /** Accept all cookies */
  acceptAll: () => void;
  /** Reject all non-essential */
  rejectAll: () => void;
  /** Save custom preferences */
  savePreferences: (prefs: Omit<ConsentPreferences, "essential" | "timestamp">) => void;
  /** Re-open the banner (for "Cookie Settings" link in footer) */
  openBanner: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

/**
 * Ad landing pages are bought for US traffic; when the region cookie is
 * missing (unknown geo) they still run under the opt-out model.
 */
const OPT_OUT_PREFIXES = ["/go/"];
const isOptOutPage = () =>
  typeof window !== "undefined" && OPT_OUT_PREFIXES.some((p) => window.location.pathname.startsWith(p));

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(null);
  const [mode, setMode] = useState<ConsentMode>("optin");
  const [gpc, setGpc] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Read the stored choice, the region stamped by the middleware, and GPC on mount.
  useEffect(() => {
    const stored = getConsent();
    const region = readRegionCookie();
    const nextMode: ConsentMode = region === "optout" || (region === null && isOptOutPage()) ? "optout" : "optin";
    setMode(nextMode);
    setGpc(hasGpc());
    setPreferences(stored);
    // Opt-in regions see the banner until they choose. Opt-out regions never
    // see it unprompted; defaults apply without writing a cookie.
    setShowBanner(!stored && nextMode === "optin");
    setLoaded(true);
  }, []);

  const effective = effectivePreferences(preferences, mode, gpc);

  const acceptAll = useCallback(() => {
    const prefs = acceptAllPreferences();
    setConsent(prefs);
    setPreferences(prefs);
    setShowBanner(false);
  }, []);

  const rejectAll = useCallback(() => {
    const prefs = rejectAllPreferences();
    setConsent(prefs);
    setPreferences(prefs);
    setShowBanner(false);
  }, []);

  const savePreferences = useCallback(
    (custom: Omit<ConsentPreferences, "essential" | "timestamp">) => {
      const prefs: ConsentPreferences = {
        essential: true,
        analytics: custom.analytics,
        marketing: custom.marketing,
        timestamp: new Date().toISOString(),
      };
      setConsent(prefs);
      setPreferences(prefs);
      setShowBanner(false);
    },
    []
  );

  const openBanner = useCallback(() => {
    setShowBanner(true);
  }, []);

  const checkConsent = useCallback(
    (category: ConsentCategory) => {
      if (category === "essential") return true;
      if (!loaded) return false; // nothing loads before we know the region
      return effective[category] === true;
    },
    [effective, loaded]
  );

  return (
    <CookieConsentContext.Provider
      value={{
        preferences,
        effective,
        mode,
        gpc,
        showBanner: loaded && showBanner,
        hasConsent: checkConsent,
        acceptAll,
        rejectAll,
        savePreferences,
        openBanner,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return ctx;
}
