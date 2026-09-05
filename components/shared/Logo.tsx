import Link from "next/link";

interface LogoProps {
  variant?: "light" | "dark";
  showText?: boolean;
  /** Render as a plain span (no link) — used on ad landing pages with no exits. */
  linked?: boolean;
}

export function Logo({ variant = "dark", showText = true, linked = true }: LogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-text-primary";
  const inner = (
    <>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
        ⚡
      </span>
      {showText ? (
        <span className={`text-lg font-semibold tracking-tight ${textColor}`}>
          FreeStockAlerts<span className="text-primary">.AI</span>
        </span>
      ) : null}
    </>
  );
  if (!linked) return <span className="flex items-center gap-2">{inner}</span>;
  return (
    <Link href="/" className="flex items-center gap-2">
      {inner}
    </Link>
  );
}
