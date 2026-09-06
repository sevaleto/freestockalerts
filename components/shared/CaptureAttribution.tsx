"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/tracking/attributionClient";

/** Mounted once in the root layout; records the landing URL's UTM/fbclid for the signup forms. */
export function CaptureAttribution() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
