"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/Logo";

export default function LoginPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link href="/" className="text-sm text-text-secondary">
          ← Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-soft">
          <h1 className="text-2xl font-semibold text-text-primary">
            Welcome to FreeStockAlerts
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            No password needed. We&apos;ll email you a secure login link every time.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <Input type="email" placeholder="you@email.com" required className="h-11" />
            <Button type="submit" className="h-11 w-full">
              Send Magic Link
            </Button>
          </form>
          {submitted ? (
            <p className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
              Check your inbox! We sent you a login link.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
