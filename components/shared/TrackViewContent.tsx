"use client";

import { useEffect, useRef } from "react";
import { trackViewContent } from "@/lib/tracking/events";

interface TrackViewContentProps {
  name: string;
  slug: string;
  contentType?: string;
}

export function TrackViewContent({ name, slug, contentType = "template" }: TrackViewContentProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      setTimeout(() => trackViewContent(name, slug, contentType), 100);
    }
  }, [name, slug, contentType]);

  return null;
}
