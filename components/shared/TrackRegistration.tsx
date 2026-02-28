"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { trackCompleteRegistration } from "@/lib/tracking/events";

/**
 * Fires CompleteRegistration event once per session.
 * Uses sessionStorage to avoid double-firing on page refreshes.
 * Picks up capi_eid from URL params for Meta pixel ↔ CAPI deduplication.
 */
export function TrackRegistration() {
  const fired = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (fired.current) return;
    const key = "fsa_reg_tracked";
    if (sessionStorage.getItem(key)) return;

    fired.current = true;

    // Get CAPI event_id passed from auth callback
    const capiEventId = searchParams.get("capi_eid") || undefined;

    setTimeout(() => {
      trackCompleteRegistration(capiEventId);
      sessionStorage.setItem(key, "1");

      // Clean up URL param (cosmetic)
      if (capiEventId && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("capi_eid");
        window.history.replaceState({}, "", url.toString());
      }
    }, 200);
  }, [searchParams]);

  return null;
}
