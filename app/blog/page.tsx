import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo size="lg" />
        <Link href="/" className="text-sm text-text-secondary">
          ← Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        <h1 className="font-serif text-4xl text-lp-navy md:text-5xl">Blog</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Insights, alert strategies, and market context. Coming soon.
        </p>
        <div className="mt-8 rounded-[20px] border border-border bg-white p-8 shadow-sm">
          <p className="text-sm text-text-secondary">
            We&apos;re drafting the first set of posts. Check back soon for market breakdowns and alert
            playbooks.
          </p>
        </div>
      </main>
    </div>
  );
}
