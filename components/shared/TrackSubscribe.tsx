"use client";

import { useEffect, useRef } from "react";
import { trackSubscribe } from "@/lib/tracking/events";

/** Fires the Subscribe pixel event once when a template is activated on page load. */
export function TrackSubscribe({ templateName, alertCount }: { templateName: string; alertCount: number }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    setTimeout(() => trackSubscribe(templateName, alertCount), 150);
  }, [templateName, alertCount]);
  return null;
}
