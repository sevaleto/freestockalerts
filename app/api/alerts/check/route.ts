import { runAlertCheck } from "@/lib/alerts/check";

export const dynamic = "force-dynamic";
// A burst of triggers runs AI context plus rate-limit retries per email.
export const maxDuration = 300;

/** Intraday alert check: every 5 minutes in market hours (vercel.json). */
export async function GET(request: Request) {
  return runAlertCheck(request, "intraday");
}

export async function POST(request: Request) {
  return runAlertCheck(request, "intraday");
}
