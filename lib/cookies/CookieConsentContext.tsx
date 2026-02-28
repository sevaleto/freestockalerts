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
  DEFAULT_PREFERENCES,
  acceptAllPreferences,
  rejectAllPreferences,
  getConsent,
  setConsent,
} from "./consent";

interface CookieConsentContextValue {
  /** Current preferences (null = hasn't decided yet) */
  preferences: ConsentPreferences | null;
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

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Read cookie on mount
  useEffect(() => {
    const stored = getConsent();
    if (stored) {
      setPreferences(stored);
      setShowBanner(false);
    } else {
      setShowBanner(true);
    }
    setLoaded(true);
  }, []);

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
      if (!preferences) return false;
      return preferences[category] === true;
    },
    [preferences]
  );

  return (
    <CookieConsentContext.Provider
      value={{
        preferences,
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
