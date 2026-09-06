import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAdminUser } from "@/lib/auth/admin";
import { buildDailyIssues } from "@/lib/newsletter/build";
import { newsletterConfigured, NEWSLETTER, type Slot } from "@/lib/newsletter/config";
import { isDateKey } from "@/lib/newsletter/dates";
import { sendRunReport } from "@/lib/newsletter/report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST { date?, slot?, force? } — build (or rebuild) issue drafts from the admin page.
 * The build runs after the response (Cloudflare cuts browser requests at 100s and a
 * build takes a few minutes); rows update as each slot finishes and the run report
 * is emailed like the cron's. Returns 202 with what was queued.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!newsletterConfigured()) return NextResponse.json({ error: "BEEHIIV_API_KEY, ANTHROPIC_API_KEY and FMP_API_KEY must all be set" }, { status: 503 });
  const body = ((await request.json().catch(() => null)) ?? {}) as { date?: unknown; slot?: unknown; force?: unknown };
  const date = typeof body.date === "string" ? body.date : undefined;
  if (date && !isDateKey(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const slot = typeof body.slot === "number" ? (body.slot as Slot) : undefined;
  if (slot !== undefined && !NEWSLETTER.slots.includes(slot)) return NextResponse.json({ error: "slot must be 1 or 2" }, { status: 400 });
  const force = body.force === true;
  after(async () => {
    try {
      const result = await buildDailyIssues({ dateKey: date, slots: slot ? [slot] : undefined, force }, { db: prisma, log: (m) => console.log(`[newsletter:admin] ${m}`) });
      if (result.slots.some((s) => !s.skipped)) await sendRunReport(result);
    } catch (err) {
      console.error("[newsletter:admin] build failed:", err);
    }
  });
  return NextResponse.json({ ok: true, queued: true, date: date ?? null, slots: slot ? [slot] : [...NEWSLETTER.slots], force }, { status: 202 });
}
