"use client";

import { suggestEmail } from "@/lib/auth/emailSuggest";

interface EmailSuggestionProps {
  email: string;
  onAccept: (email: string) => void;
  variant?: "light" | "dark";
  className?: string;
}

/** "Did you mean stepnej@yahoo.com?" under an email input. Renders nothing when there's no suggestion. */
export function EmailSuggestion({ email, onAccept, variant = "light", className = "" }: EmailSuggestionProps) {
  const suggestion = suggestEmail(email);
  if (!suggestion) return null;
  const text = variant === "dark" ? "text-slate-300" : "text-slate-600";
  const link = variant === "dark" ? "text-emerald-300" : "text-primary";
  return (
    <p className={`text-xs ${text} ${className}`}>
      Did you mean{" "}
      <button type="button" onClick={() => onAccept(suggestion)} className={`font-semibold underline ${link}`}>
        {suggestion}
      </button>
      ?
    </p>
  );
}
