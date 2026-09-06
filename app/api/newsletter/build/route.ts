import { handleBuildRequest } from "@/lib/newsletter/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/newsletter/build[?slot=1|2&force=1&date=YYYY-MM-DD&dry=1&report=0|1]
 * Builds the day's FreeStockAlerts drafts in Beehiiv. The crons call
 * /api/newsletter/build/1 and /2 so each slot has its own invocation.
 */
export async function GET(request: Request) {
  return handleBuildRequest(request);
}
