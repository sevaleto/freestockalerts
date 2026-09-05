/**
 * Run the event-strategy scans from the command line (same code as the cron route).
 *
 *   set -a; source .env.local; set +a
 *   npm run scan:strategies -- --dry-run            # evaluate only, print what would be created
 *   npm run scan:strategies -- --only insider       # insider | analyst
 *   npm run scan:strategies -- --no-deliver         # create signals, send no email
 *
 * DATABASE_URL decides where signals go. Point it at a local database to try it safely.
 */
import { PrismaClient } from "@prisma/client";
import { runScans, type StrategyKey } from "../lib/strategies/scan";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const deliver = !args.includes("--no-deliver") && !dryRun;
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? (args[onlyIdx + 1] as StrategyKey) : null;
const keys: StrategyKey[] = only ? [only] : ["insider", "analyst"];

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  console.log(`scan ${keys.join(", ")}${dryRun ? " (dry run)" : deliver ? "" : " (no delivery)"} → ${(process.env.DATABASE_URL ?? "").replace(/:[^:@/]+@/, ":***@")}`);
  const summaries = await runScans(keys, { db: prisma, dryRun, deliver, log: (m) => console.log(`  ${m}`) });
  for (const s of summaries) {
    console.log(`\n== ${s.strategySlug}: ${s.candidates} candidates, ${s.qualified} qualified, ${s.signalsCreated} created, ${s.emailsSent} emails, ${s.skipped.length} skipped`);
    for (const c of s.created) console.log(`  + ${c.symbol} score ${c.score} (${c.confirmation})`);
    for (const c of s.wouldCreate) console.log(`  ? ${c.symbol} score ${c.score} (${c.confirmation}): ${c.explanation}`);
    for (const c of s.skipped) console.log(`  - ${c.symbol}: ${c.reason}`);
    const byReason = new Map<string, number>();
    for (const r of s.rejected) for (const reason of r.reasons) byReason.set(reason.replace(/\d[\d,.]*/g, "N"), (byReason.get(reason.replace(/\d[\d,.]*/g, "N")) ?? 0) + 1);
    console.log(`  rejected ${s.rejected.length}: ${[...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([r, n]) => `${r} ×${n}`).join("; ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
