"use client";

import { useEffect, useState } from "react";

/**
 * When a visitor clicks a template card on the homepage, remember it so the
 * signup form can say "Activating: <template>" and send them to the welcome
 * page that activates it. Session-scoped; cleared on submit or dismiss.
 */
export interface PendingTemplate {
  slug: string;
  name: string;
}

const KEY = "fsa_pending_template";
const EVENT = "fsa:pending-template";

export function selectTemplate(t: PendingTemplate | null) {
  try {
    if (t) sessionStorage.setItem(KEY, JSON.stringify(t));
    else sessionStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function usePendingTemplate(): [PendingTemplate | null, (t: PendingTemplate | null) => void] {
  const [pending, setPending] = useState<PendingTemplate | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem(KEY);
        setPending(raw ? (JSON.parse(raw) as PendingTemplate) : null);
      } catch {
        setPending(null);
      }
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  return [pending, selectTemplate];
}
