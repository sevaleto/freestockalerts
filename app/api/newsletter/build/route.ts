import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { buildDailyIssues } from "@/lib/newsletter/build";
import { newsletterConfigured, NEWSLETTER, type Slot } from "@/lib/newsletter/config";
import { isDateKey } from "@/lib/newsletter/dates";
import { sendRunReport } from "@/lib/newsletter/report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/newsletter/build
 * Daily cron (vercel.json, 11:00 UTC = 4 AM PDT / 3 AM PST). Builds the day's
 * two FreeStockAlerts drafts in Beehiiv and emails the run report.
 * Query: force=1 (rebuild existing slots), date=YYYY-MM-DD, slot=1|2, dry=1 (no Beehiiv write, no report).
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!newsletterConfigured()) return NextResponse.json({ ok: false, error: "BEEHIIV_API_KEY, ANTHROPIC_API_KEY and FMP_API_KEY must all be set" }, { status: 503 });
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const dry = url.searchParams.get("dry") === "1";
  const dateParam = url.searchParams.get("date");
  const slotParam = url.searchParams.get("slot");
  if (dateParam && !isDateKey(dateParam)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const slots = slotParam ? ([Number(slotParam)] as Slot[]) : undefined;
  if (slots && !NEWSLETTER.slots.includes(slots[0])) return NextResponse.json({ error: "slot must be 1 or 2" }, { status: 400 });
  try {
    const result = await buildDailyIssues({ dateKey: dateParam ?? undefined, slots, force }, { db: prisma, dry, log: (m) => console.log(`[newsletter] ${m}`) });
    const report = dry ? { sent: false, error: "dry run" } : await sendRunReport(result);
    // Dry runs return the bodies so the caller can inspect them; live runs keep the response small.
    return NextResponse.json({ ok: true, report, ...result, slots: result.slots.map((s) => (dry ? s : { ...s, body: undefined })) });
  } catch (err) {
    console.error("[newsletter] build failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "build failed; see function logs" }, { status: 500 });
  }
}
