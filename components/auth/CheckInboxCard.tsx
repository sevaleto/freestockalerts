"use client";

import { useEffect, useState } from "react";
import { MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { sendMagicLink, verifyCode } from "@/lib/auth/magicLink";

interface CheckInboxCardProps {
  email: string;
  source: string;
  variant?: "light" | "dark";
  purpose?: "signup" | "login";
  next?: string;
  /** Go back to the form. Parent should keep `email` state so it is prefilled. */
  onChangeEmail: () => void;
  /** Go back to the form with a corrected address. */
  onUseSuggestion?: (email: string) => void;
  className?: string;
}

const RESEND_COOLDOWN = 60;

/** Deep link into the visitor's webmail, searched for our sender, when we recognise the domain. */
function inboxLink(email: string): { label: string; href: string } | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (/^(gmail|googlemail)\.com$/.test(domain)) return { label: "Open Gmail", href: "https://mail.google.com/mail/u/0/#search/FreeStockAlerts" };
  if (/^(outlook|hotmail|live|msn)\./.test(domain)) return { label: "Open Outlook", href: "https://outlook.live.com/mail/0/" };
  if (/^(yahoo|ymail|rocketmail)\./.test(domain) || /^aol\.com$/.test(domain)) return { label: domain.startsWith("aol") ? "Open AOL Mail" : "Open Yahoo Mail", href: domain.startsWith("aol") ? "https://mail.aol.com/" : "https://mail.yahoo.com/" };
  if (/^(icloud|me|mac)\.com$/.test(domain)) return { label: "Open iCloud Mail", href: "https://www.icloud.com/mail/" };
  return null;
}

export function CheckInboxCard({
  email,
  source,
  variant = "light",
  purpose = "signup",
  next,
  onChangeEmail,
  onUseSuggestion,
  className = "",
}: CheckInboxCardProps) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    setResending(true);
    setResendError(null);
    setResent(false);
    const r = await sendMagicLink(email, source, next);
    if (r.ok) {
      setResent(true);
      setCooldown(RESEND_COOLDOWN);
    } else if (r.retryAfterSec) {
      setCooldown(r.retryAfterSec);
    } else {
      setResendError(r.message);
    }
    setResending(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setCodeError(null);
    const r = await verifyCode(email, code, next);
    if (r.ok) {
      window.location.assign(r.redirectTo);
      return;
    }
    setCodeError(r.message);
    setVerifying(false);
  };

  const dark = variant === "dark";
  const card = dark
    ? "rounded-2xl border border-white/20 bg-white/10 p-6 text-white"
    : "rounded-2xl border-2 border-lp-teal/30 bg-lp-mint p-6 text-lp-navy";
  const muted = dark ? "text-slate-300" : "text-lp-navy/75";
  const faint = dark ? "text-lp-muted" : "text-lp-muted";
  const icon = dark ? "text-emerald-300" : "text-lp-green";
  const linkBtn = dark ? "text-white" : "text-primary";
  const outline = dark
    ? "border-white/30 bg-transparent text-white hover:bg-white/10"
    : "border-lp-teal/40 bg-white text-lp-navy hover:bg-lp-mint";
  const input = dark
    ? "border-white/30 bg-white/10 text-white placeholder:text-lp-muted"
    : "border-lp-teal/40 bg-white";

  return (
    <div className={`${card} ${className}`}>
      <div className="flex items-start gap-3">
        <MailCheck className={`mt-0.5 h-6 w-6 shrink-0 ${icon}`} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">Check your inbox</p>
          <p className={`mt-1 text-sm ${muted}`}>
            We sent your {purpose === "signup" ? "activation" : "login"} link to{" "}
            <strong className="break-all">{email}</strong>.
            {" "}Click the button in the email to{" "}
            {next?.startsWith("/welcome/")
              ? "activate your alerts"
              : purpose === "signup"
                ? "activate your account and set your first alert"
                : "open your dashboard"}.
          </p>
          <EmailSuggestion
            email={email}
            variant={variant}
            className="mt-1"
            onAccept={(fixed) => (onUseSuggestion ? onUseSuggestion(fixed) : onChangeEmail())}
          />

          <form onSubmit={handleVerify} className="mt-4">
            <p className={`text-xs font-medium ${muted}`}>On another device? Enter the code from the email:</p>
            <div className="mt-2 flex gap-2">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="12345678"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className={`h-11 max-w-[12rem] font-mono text-lg tracking-[0.25em] ${input}`}
              />
              <Button
                type="submit"
                disabled={verifying || code.length < 6}
                className="h-11 bg-lp-teal px-5 font-semibold hover:bg-lp-teal-dark"
              >
                {verifying ? "Verifying…" : "Verify"}
              </Button>
            </div>
            {codeError && <p className="mt-2 text-sm text-red-500">{codeError}</p>}
          </form>

          <p className={`mt-4 text-xs ${faint}`}>
            It&apos;s from <span className="font-medium">FreeStockAlerts.AI</span> (alerts@freestockalerts.ai). Not at the top? Check Spam or
            Promotions, or search your inbox for &ldquo;FreeStockAlerts&rdquo;. Links and codes expire after 1 hour.
          </p>
          {inboxLink(email) ? (
            <a
              href={inboxLink(email)!.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
                dark ? "bg-white text-lp-navy hover:bg-lp-bg" : "bg-lp-teal text-white hover:bg-lp-teal-dark"
              }`}
            >
              {inboxLink(email)!.label} →
            </a>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resending || cooldown > 0}
              onClick={handleResend}
              className={outline}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend link"}
            </Button>
            <button type="button" onClick={onChangeEmail} className={`text-sm font-semibold underline ${linkBtn}`}>
              Use a different email
            </button>
          </div>
          {resent && <p className={`mt-2 text-xs ${muted}`}>Sent again. Give it a minute to arrive.</p>}
          {resendError && <p className="mt-2 text-xs text-red-500">{resendError}</p>}
        </div>
      </div>
    </div>
  );
}
