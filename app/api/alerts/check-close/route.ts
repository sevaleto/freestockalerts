import { runAlertCheck } from "@/lib/alerts/check";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Post-close volume-spike check (vercel.json: two evening runs plus a morning
 * catch-up). Judges each VOLUME_SPIKE alert once per session on the completed
 * daily bar's full-market volume. ?dryRun=1 reports without sending or writing.
 */
export async function GET(request: Request) {
  return runAlertCheck(request, "close");
}

export async function POST(request: Request) {
  return runAlertCheck(request, "close");
}
