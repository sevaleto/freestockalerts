"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";

export function Footer() {
  const { openBanner } = useCookieConsent();

  return (
    <footer className="bg-white py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between">
        <Logo />
        <div className="flex flex-wrap gap-6 text-sm text-text-secondary">
          <Link href="/about">About</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <button
            type="button"
            onClick={openBanner}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Cookie Settings
          </button>
        </div>
      </div>
      <div className="mx-auto mt-6 w-full max-w-6xl px-6 text-xs text-text-muted">
        © 2026 FreeStockAlerts.AI — Built for traders, by traders.
      </div>
    </footer>
  );
}
