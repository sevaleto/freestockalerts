/**
 * The HTTP side of a build: one request = one slot (or both, for local use).
 * Each slot gets its own Vercel invocation and its own 300-second budget; an
 * article with several web searches can take four minutes on its own.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { buildDailyIssues } from "./build";
import { NEWSLETTER, newsletterConfigured, type Slot } from "./config";
import { isDateKey, pacificDateKey } from "./dates";
import { sendDayReport } from "./report";

export const parseSlot = (v: string | null | undefined): Slot | null | "invalid" => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return NEWSLETTER.slots.includes(n as Slot) ? (n as Slot) : "invalid";
};

/**
 * Query: force=1 (rebuild an existing draft), date=YYYY-MM-DD, dry=1 (no Beehiiv write, no rows, no report),
 * report=0|1 (default: report after the last slot of the day, i.e. slot 2 or a both-slots run).
 */
export async function handleBuildRequest(request: Request, slotFromPath?: string): Promise<Response> {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!newsletterConfigured()) return NextResponse.json({ ok: false, error: "BEEHIIV_API_KEY, ANTHROPIC_API_KEY and FMP_API_KEY must all be set" }, { status: 503 });
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const dry = url.searchParams.get("dry") === "1";
  const dateParam = url.searchParams.get("date");
  if (dateParam && !isDateKey(dateParam)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const slot = parseSlot(slotFromPath ?? url.searchParams.get("slot"));
  if (slot === "invalid") return NextResponse.json({ error: "slot must be 1 or 2" }, { status: 400 });
  const lastSlot = NEWSLETTER.slots[NEWSLETTER.slots.length - 1];
  const reportParam = url.searchParams.get("report");
  const report = !dry && (reportParam ? reportParam === "1" : slot === null || slot === lastSlot);
  const dateKey = dateParam ?? pacificDateKey(new Date());
  try {
    const result = await buildDailyIssues({ dateKey, slots: slot ? [slot] : undefined, force }, { db: prisma, dry, log: (m) => console.log(`[newsletter${slot ? `:${slot}` : ""}] ${m}`) });
    const sent = report ? await sendDayReport(prisma, dateKey, { warnings: result.warnings, ms: result.ms }) : { sent: false, error: "no report for this run" };
    return NextResponse.json({ ok: true, report: sent, ...result, slots: result.slots.map((s) => (dry ? s : { ...s, body: undefined })) });
  } catch (err) {
    console.error("[newsletter] build failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "build failed; see function logs" }, { status: 500 });
  }
}

/**
 * How to call ourselves. Deployment URLs sit behind Vercel's SSO protection,
 * so they only work with the automation bypass secret; otherwise use the public
 * origin. Cloudflare drops that connection after 100 seconds, which is fine: the
 * invocation keeps running and the caller does not need the response.
 */
export function selfTarget(): { origin: string; headers: Record<string, string> } {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && process.env.VERCEL_URL) return { origin: `https://${process.env.VERCEL_URL}`, headers: { "x-vercel-protection-bypass": bypass } };
  return { origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", headers: {} };
}

/** Gap between fanned-out slot invocations (the crons are a minute apart). */
export const SLOT_STAGGER_MS = 30_000;

/**
 * Start one build invocation per slot over HTTP (each gets its own function
 * and budget) and wait for them. Used by the admin route from inside after().
 */
export async function triggerSlotBuilds(opts: { dateKey?: string; slots: readonly Slot[]; force: boolean }): Promise<{ slot: Slot; status: number | null; error?: string }[]> {
  const target = selfTarget();
  const headers: Record<string, string> = { ...target.headers };
  if (process.env.CRON_SECRET) headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  const last = opts.slots[opts.slots.length - 1];
  return Promise.all(
    opts.slots.map(async (slot, i) => {
      // Stagger so the second slot sees the first slot's pending row when it picks its topic.
      if (i > 0) await new Promise((r) => setTimeout(r, i * SLOT_STAGGER_MS));
      const u = new URL(`${target.origin}/api/newsletter/build/${slot}`);
      if (opts.dateKey) u.searchParams.set("date", opts.dateKey);
      if (opts.force) u.searchParams.set("force", "1");
      u.searchParams.set("report", slot === last ? "1" : "0");
      try {
        const res = await fetch(u, { headers, cache: "no-store", redirect: "manual" });
        // 3xx here means Vercel's SSO wall, i.e. the wrong origin; the build did not start.
        return { slot, status: res.status, ...(res.status >= 300 && res.status < 400 ? { error: "redirected (deployment protection); set VERCEL_AUTOMATION_BYPASS_SECRET or NEXT_PUBLIC_APP_URL" } : {}) };
      } catch (err) {
        return { slot, status: null, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );
}
