import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { TemplatePreview } from "@/components/landing/TemplatePreview";
import { Testimonials } from "@/components/landing/Testimonials";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Logo } from "@/components/shared/Logo";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Hero />
      <HowItWorks />
      <Features />
      <TemplatePreview />
      <Testimonials />
      <FinalCTA />
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
          </div>
        </div>
        <div className="mx-auto mt-6 w-full max-w-6xl px-6 text-xs text-text-muted">
          © 2026 FreeStockAlerts.AI — Built for traders, by traders.
        </div>
      </footer>
    </main>
  );
}
