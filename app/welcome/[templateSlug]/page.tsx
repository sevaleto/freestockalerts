export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";
import { TrackRegistration } from "@/components/shared/TrackRegistration";
import { TrackSubscribe } from "@/components/shared/TrackSubscribe";
import { AlertProofList } from "@/components/lp/AlertProofList";
import { LpFooter } from "@/components/lp/LpFooter";
import { getAuthUser } from "@/lib/supabase/server";
import {
  activateTemplateForUser,
  AlertLimitError,
  TemplateNotFoundError,
} from "@/lib/templates/activate";

interface WelcomePageProps {
  params: Promise<{ templateSlug: string }>;
}

export const metadata: Metadata = {
  title: "Your alerts are live",
  robots: { index: false, follow: false },
};

/**
 * Post-signup destination for ad landing pages (and the Activate button
 * when the visitor wasn't logged in). Activates the template on arrival so
 * the user sees their alerts live with zero extra clicks.
 */
export default async function WelcomePage(props: WelcomePageProps) {
  const { templateSlug } = await props.params;
  const user = await getAuthUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/welcome/${templateSlug}`)}`);

  let result;
  let limitHit: number | null = null;
  try {
    result = await activateTemplateForUser(user.id, templateSlug);
  } catch (err) {
    if (err instanceof TemplateNotFoundError) notFound();
    if (err instanceof AlertLimitError) {
      limitHit = err.limit;
    } else {
      throw err;
    }
  }

  const alerts = result?.alerts ?? [];
  const items = alerts.map((a) => ({
    ticker: a.ticker,
    companyName: a.companyName,
    alertType: a.alertType,
    triggerValue: a.triggerValue,
    triggerDirection: a.triggerDirection,
    rationale: a.note,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense fallback={null}>
        <TrackRegistration />
      </Suspense>
      {result ? <TrackSubscribe templateName={result.template.name} alertCount={alerts.length} /> : null}

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link href="/dashboard" className="text-sm text-text-secondary hover:text-text-primary">
          Dashboard →
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16">
        <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          {limitHit ? (
            <>
              <h1 className="mt-4 text-2xl font-bold text-text-primary">You&apos;re at the {limitHit}-alert limit</h1>
              <p className="mt-2 text-sm text-slate-600">
                Delete a few alerts on your dashboard, then come back to this page to activate {templateSlug.replace(/-/g, " ")}.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-bold text-text-primary md:text-3xl">
                Your {alerts.length} alerts are live
              </h1>
              <p className="mt-2 text-base text-slate-600">
                {result?.template.iconEmoji} {result?.template.name}. We&apos;ll email you the moment any of these trigger,
                with a short AI summary of why it matters.
              </p>
              {result?.alreadyActive ? (
                <p className="mt-2 text-xs text-slate-500">These were already active on your account.</p>
              ) : null}
            </>
          )}
          <Button asChild className="mt-6 h-12 bg-emerald-600 px-8 text-base font-semibold hover:bg-emerald-700">
            <Link href="/dashboard/alerts">Go to my alerts →</Link>
          </Button>
        </div>

        {items.length > 0 ? (
          <AlertProofList items={items} title="What you're watching" className="mt-8" />
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-500">
          Alerts check every 5 minutes during market hours. Each one fires once, then pauses until you re-arm it.
        </p>
      </main>

      <LpFooter />
    </div>
  );
}
