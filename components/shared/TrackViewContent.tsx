"use client";

import { useEffect, useRef } from "react";
import { trackViewContent } from "@/lib/tracking/events";

interface TrackViewContentProps {
  name: string;
  slug: string;
}

export function TrackViewContent({ name, slug }: TrackViewContentProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      setTimeout(() => trackViewContent(name, slug), 100);
    }
  }, [name, slug]);

  return null;
}
