import { NextResponse } from "next/server";
import { verifyPendingEmails } from "@/lib/email/verification";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/email/verify-pending
 *
 * Hourly cron (vercel.json). Re-checks PENDING addresses: those whose
 * after-response verification never ran, and Email Oversight Retry/Unknown
 * replies (up to 3 attempts, then RISKY). Locked with CRON_SECRET like the
 * alert cron. `?limit=` caps the batch (default 50).
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
  const results = await verifyPendingEmails(limit);
  const summary = results.reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  console.log("[verify-pending]", { checked: results.length, summary });
  return NextResponse.json({ checked: results.length, summary, results });
}
