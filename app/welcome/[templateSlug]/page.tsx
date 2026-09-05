export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect, redirect } from "next/navigation";
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
import { isLegacyTemplateSlug, resolveTemplateSlug } from "@/lib/templates/redirects";
import { getStrategy } from "@/lib/templates/catalog";

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
  const { templateSlug: rawSlug } = await props.params;
  // Links in old emails and ads carry retired slugs; send them to the replacement.
  if (isLegacyTemplateSlug(rawSlug)) permanentRedirect(`/welcome/${resolveTemplateSlug(rawSlug)}`);
  const templateSlug = rawSlug;
  const strategy = getStrategy(templateSlug);
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
    <div className="flex min-h-screen flex-col bg-lp-bg">
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
        <div className="rounded-[20px] border-2 border-lp-teal/30 bg-lp-mint p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-lp-green" />
          {limitHit ? (
            <>
              <h1 className="mt-4 font-serif text-3xl text-lp-navy">You&apos;re at the {limitHit}-alert limit</h1>
              <p className="mt-2 text-sm text-lp-navy/75">
                Delete a few alerts on your dashboard, then come back to this page to activate {templateSlug.replace(/-/g, " ")}.
              </p>
            </>
          ) : strategy?.kind === "signal" ? (
            <>
              <h1 className="mt-4 font-serif text-3xl text-lp-navy md:text-4xl">
                You&apos;re subscribed to {result?.template.name}
              </h1>
              <p className="mt-2 text-base text-lp-navy/75">
                This strategy has no fixed list. Every trading day after the close we scan for new events that pass every rule, and you get one email per confirmed signal with the facts and the source link.
              </p>
              {result?.alreadyActive ? <p className="mt-2 text-xs text-lp-muted">This was already active on your account.</p> : null}
            </>
          ) : (
            <>
              <h1 className="mt-4 font-serif text-3xl text-lp-navy md:text-4xl">
                Your {alerts.length} alerts are live
              </h1>
              <p className="mt-2 text-base text-lp-navy/75">
                {result?.template.name}. We&apos;ll email you the moment any of these trigger,
                with a short summary of what happened and what investors typically watch next.
              </p>
              {result?.alreadyActive ? (
                <p className="mt-2 text-xs text-lp-muted">These were already active on your account.</p>
              ) : null}
            </>
          )}
          <Button asChild className="mt-6 h-12 bg-lp-teal px-8 text-base font-semibold hover:bg-lp-teal-dark">
            <Link href="/dashboard/alerts">Go to my alerts →</Link>
          </Button>
        </div>

        {items.length > 0 ? (
          <AlertProofList items={items} title="What you're watching" className="mt-8" />
        ) : null}

        <p className="mt-6 text-center text-xs text-lp-muted">
          {strategy?.kind === "signal"
            ? "The scan runs once per trading day after the close. Turn the strategy off any time from your dashboard."
            : "Alerts check every 5 minutes during market hours. Each one fires once, then pauses until you re-arm it."}
          {strategy ? (
            <>
              {" "}
              <Link href={`/templates/${strategy.slug}`} className="underline underline-offset-2 hover:text-lp-navy">
                How this strategy works
              </Link>
              .
            </>
          ) : null}
        </p>
        <p className="mt-2 text-center text-xs text-lp-muted">Educational information only. Not investment advice.</p>
      </main>

      <LpFooter />
    </div>
  );
}
