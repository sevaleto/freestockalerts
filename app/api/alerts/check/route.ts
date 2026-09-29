import { runAlertCheck } from "@/lib/alerts/check";

export const dynamic = "force-dynamic";

/** Intraday alert check: every 5 minutes in market hours (vercel.json). */
export async function GET(request: Request) {
  return runAlertCheck(request, "intraday");
}

export async function POST(request: Request) {
  return runAlertCheck(request, "intraday");
}
