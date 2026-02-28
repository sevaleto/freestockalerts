"use client";

import { useEffect, useRef } from "react";
import { trackCompleteRegistration } from "@/lib/tracking/events";

/**
 * Fires CompleteRegistration event once per session.
 * Uses sessionStorage to avoid double-firing on page refreshes.
 */
export function TrackRegistration() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    // Only fire once per browser session
    const key = "fsa_reg_tracked";
    if (sessionStorage.getItem(key)) return;

    fired.current = true;
    // Small delay for pixels to initialize
    setTimeout(() => {
      trackCompleteRegistration();
      sessionStorage.setItem(key, "1");
    }, 200);
  }, []);

  return null;
}
