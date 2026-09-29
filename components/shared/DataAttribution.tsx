import { MARKET_DATA_CREDIT_PREFIX, MARKET_DATA_PROVIDER, TWELVE_DATA_URL } from "@/lib/marketData/attribution";

/** Required credit next to displayed prices. Plain link on purpose: the licence asks for a dofollow link. */
export function DataAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-lp-muted ${className}`}>
      {MARKET_DATA_CREDIT_PREFIX}{" "}
      <a href={TWELVE_DATA_URL} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-lp-navy">
        {MARKET_DATA_PROVIDER}
      </a>
    </p>
  );
}
