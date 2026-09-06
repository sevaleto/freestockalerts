import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { beehiivConfigured } from "@/lib/beehiiv/config";
import { syncAll } from "@/lib/subscribers/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/subscribers/sync
 * Hourly cron (vercel.json). Mirrors app users changed in the last two days,
 * looks every tracked subscriber up in both Beehiiv publications (a few
 * dozen API calls), and refreshes the latest issues' link stats.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!beehiivConfigured()) return NextResponse.json({ ok: false, error: "BEEHIIV_API_KEY is not set" }, { status: 503 });
  const started = Date.now();
  try {
    const result = await syncAll({ db: prisma, appSince: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), log: (m) => console.log(`[subscriber-sync] ${m}`) });
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...result });
  } catch (err) {
    console.error("[subscriber-sync] failed:", err);
    return NextResponse.json({ ok: false, error: "sync failed; see function logs" }, { status: 500 });
  }
}
