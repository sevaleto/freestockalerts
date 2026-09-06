"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { onMetaPixelReady, trackCompleteRegistration } from "@/lib/tracking/events";

/**
 * Fires CompleteRegistration once per session, as soon as the Meta pixel stub
 * exists (it mounts after consent resolves and can trail the first paint by
 * well over the old fixed 200ms on slow devices and in-app browsers).
 * Picks up capi_eid from URL params for Meta pixel ↔ CAPI deduplication.
 *
 * The sessionStorage flag is only set once the pixel actually queued the
 * event, so a refresh gets another chance if the pixel wasn't ready in time.
 */
export function TrackRegistration() {
  const fired = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (fired.current) return;
    const key = "fsa_reg_tracked";
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* storage blocked: fire once per mount instead */
    }

    fired.current = true;

    // Get CAPI event_id passed from auth callback
    const capiEventId = searchParams.get("capi_eid") || undefined;

    const cancel = onMetaPixelReady((ready) => {
      const sent = trackCompleteRegistration(capiEventId);
      if (ready && sent) {
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      }

      // Clean up URL param (cosmetic)
      if (capiEventId && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("capi_eid");
        window.history.replaceState({}, "", url.toString());
      }
    });

    return cancel;
  }, [searchParams]);

  return null;
}
