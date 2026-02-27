import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo />
        <Link href="/" className="text-sm text-text-secondary">
          ← Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        <h1 className="text-3xl font-semibold text-text-primary">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This is a placeholder privacy policy. We will update it before launch.
        </p>
      </main>
    </div>
  );
}
