import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { ingestInsiderFilings } from "@/lib/sec/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/insiders/ingest: reads EDGAR Form 4 filings into SecInsiderPurchase
 * (vercel.json, every 20 minutes). Time-boxed and resumable; a run with
 * nothing new to read makes one index request and exits.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await ingestInsiderFilings({ db: prisma, log: (m) => console.log(`[insider-ingest] ${m}`) });
    console.log(`[insider-ingest] read ${summary.filingsRead} filings, ${summary.purchasesFound} purchases, ${summary.fetchErrors} fetch errors in ${summary.ms}ms`);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[insider-ingest] failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "ingest failed" }, { status: 500 });
  }
}
