"use client";

import { useEffect, useRef } from "react";

interface TrackEventProps {
  /** Callback that fires the tracking event */
  fire: () => void;
}

/**
 * Invisible client component that fires a tracking event once on mount.
 * Use in server components to trigger client-side pixel events.
 */
export function TrackEvent({ fire }: TrackEventProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      // Small delay to ensure pixel scripts have loaded
      setTimeout(fire, 100);
    }
  }, [fire]);

  return null;
}
