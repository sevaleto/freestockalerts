import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { runScans, type StrategyKey } from "@/lib/strategies/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/strategies/scan?strategy=all|insider|analyst&dryRun=1&deliver=0
 *
 * Runs the event-strategy scans (scheduled daily after the close in vercel.json).
 * dryRun evaluates and reports without writing or emailing. Idempotent: a
 * second run on the same data creates nothing new.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const which = url.searchParams.get("strategy") ?? "all";
  const keys: StrategyKey[] = which === "insider" ? ["insider"] : which === "analyst" ? ["analyst"] : ["insider", "analyst"];
  const dryRun = url.searchParams.get("dryRun") === "1";
  const deliver = url.searchParams.get("deliver") !== "0" && !dryRun;
  const started = Date.now();
  try {
    const summaries = await runScans(keys, { db: prisma, dryRun, deliver, log: (m) => console.log(`[strategy-scan] ${m}`) });
    for (const s of summaries) {
      console.log(`[strategy-scan] ${s.strategySlug}: ${s.candidates} candidates, ${s.qualified} qualified, ${s.signalsCreated} signals, ${s.emailsSent} emails${dryRun ? " (dry run)" : ""}`);
    }
    return NextResponse.json({ ok: true, dryRun, ms: Date.now() - started, summaries });
  } catch (err) {
    console.error("[strategy-scan] failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "scan failed" }, { status: 500 });
  }
}
