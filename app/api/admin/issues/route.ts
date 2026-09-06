import { NextResponse, after } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { newsletterConfigured, NEWSLETTER, type Slot } from "@/lib/newsletter/config";
import { isDateKey } from "@/lib/newsletter/dates";
import { triggerSlotBuilds } from "@/lib/newsletter/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST { date?, slot?, force? } — build (or rebuild) issue drafts from the admin page.
 * Answers 202 at once (Cloudflare cuts browser requests at 100s), then starts one
 * build invocation per slot so each has its own function budget. Rows update as
 * slots finish; the last slot emails the day's report.
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
    const outcomes = await triggerSlotBuilds({ dateKey: date, slots: slot ? [slot] : NEWSLETTER.slots, force });
    console.log(`[newsletter:admin] slot builds: ${outcomes.map((o) => `${o.slot}=${o.status ?? o.error}`).join(", ")}`);
  });
  return NextResponse.json({ ok: true, queued: true, date: date ?? null, slots: slot ? [slot] : [...NEWSLETTER.slots], force }, { status: 202 });
}
