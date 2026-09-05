import Link from "next/link";
import { Zap } from "lucide-react";

interface LogoProps {
  variant?: "light" | "dark";
  showText?: boolean;
  /** Render as a plain span (no link) — used on ad landing pages with no exits. */
  linked?: boolean;
  /** "lg" for landing page headers. */
  size?: "md" | "lg";
  /** Extra classes on the wrapper. */
  className?: string;
}

/** Brand mark: a solid lightning bolt beside the wordmark. */
export function Logo({ variant = "dark", showText = true, linked = true, size = "md", className = "" }: LogoProps) {
  const color = variant === "light" ? "text-white" : "text-lp-navy";
  const icon = size === "lg" ? "h-8 w-8 sm:h-9 sm:w-9" : "h-7 w-7";
  const text = size === "lg" ? "text-[1.35rem] sm:text-[1.75rem]" : "text-xl";
  const inner = (
    <>
      <Zap className={`${icon} ${color} shrink-0 fill-current`} strokeWidth={1.5} aria-hidden />
      {showText ? (
        <span className={`${text} font-semibold tracking-tight ${color}`}>FreeStockAlerts.AI</span>
      ) : null}
    </>
  );
  const wrapper = `flex items-center gap-2.5 ${className}`;
  if (!linked) return <span className={wrapper}>{inner}</span>;
  return (
    <Link href="/" className={wrapper} aria-label="FreeStockAlerts.AI home">
      {inner}
    </Link>
  );
}
