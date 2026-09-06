"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { onMetaPixelReady, trackCompleteRegistration } from "@/lib/tracking/events";

/**
 * Fires the browser CompleteRegistration for a brand-new registration only.
 * The server decides: it appends capi_eid to the post-sign-in redirect just
 * when this sign-in completed a registration (see lib/auth/completeSignIn.ts),
 * and the same id dedupes the pixel event against the CAPI one. No capi_eid
 * means a returning user, and nothing fires.
 *
 * Waits for the Meta pixel stub (it mounts after consent resolves and can
 * trail the first paint by well over the old fixed 200ms on slow devices and
 * in-app browsers). The sessionStorage flag is only set once the pixel
 * actually queued the event, so a refresh gets another chance.
 */
export function TrackRegistration() {
  const fired = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (fired.current) return;
    // Get CAPI event_id passed from auth callback; absent for returning users
    const capiEventId = searchParams.get("capi_eid") || undefined;
    if (!capiEventId) return;

    const key = "fsa_reg_tracked";
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* storage blocked: fire once per mount instead */
    }

    fired.current = true;

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
      if (window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("capi_eid");
        window.history.replaceState({}, "", url.toString());
      }
    });

    return cancel;
  }, [searchParams]);

  return null;
}
