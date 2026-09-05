/** Read helpers for pages: recent signals and the last scan for a strategy. */
import { prisma } from "@/lib/prisma/client";

export interface RecentSignalsView {
  signals: Array<{
    id: string;
    symbol: string;
    companyName: string | null;
    price: number;
    score: number;
    confirmation: string;
    explanation: string;
    payload: unknown;
    dataAsOf: Date;
    createdAt: Date;
    strategySlug: string;
  }>;
  lastScan: { finishedAt: Date | null; startedAt: Date; status: string; candidates: number; qualified: number } | null;
}

export async function loadRecentSignals(strategySlug: string, limit = 10): Promise<RecentSignalsView> {
  try {
    const [signals, lastScan] = await Promise.all([
      prisma.strategySignal.findMany({ where: { strategySlug }, orderBy: { createdAt: "desc" }, take: limit }),
      prisma.strategyScanRun.findFirst({ where: { strategySlug, dryRun: false }, orderBy: { startedAt: "desc" }, select: { finishedAt: true, startedAt: true, status: true, candidates: true, qualified: true } }),
    ]);
    return { signals, lastScan };
  } catch (err) {
    console.error(`[signals] read failed for ${strategySlug}:`, err);
    return { signals: [], lastScan: null };
  }
}
