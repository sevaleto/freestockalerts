import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo />
        <Link href="/" className="text-sm text-text-secondary">
          ← Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        <h1 className="text-3xl font-semibold text-text-primary">Contact</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Questions or feedback? Email us at hello@freestockalerts.ai
        </p>
      </main>
    </div>
  );
}
