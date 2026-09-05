/**
 * Backfill / bulk-verify deliverability verdicts.
 *
 *   npx tsx scripts/verify-emails.ts --confirmed          # confirmed users → VALID (free, no API calls)
 *   npx tsx scripts/verify-emails.ts --pending --limit 100 # PENDING users → Email Oversight (1 credit each)
 *   npx tsx scripts/verify-emails.ts --status              # counts per status
 *
 * Add --dry-run to see what would change without writing.
 */
import { PrismaClient } from "@prisma/client";
import { MAX_CHECK_ATTEMPTS, verifyUserEmail } from "../lib/email/verification";
import { oversightEnabled } from "../lib/email/oversight";

const prisma = new PrismaClient();
const has = (f: string) => process.argv.includes(`--${f}`);
const argv = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function status() {
  const rows = await prisma.user.groupBy({ by: ["emailStatus"], _count: { _all: true } });
  console.table(Object.fromEntries(rows.map((r) => [r.emailStatus, r._count._all])));
}

async function confirmed(dry: boolean) {
  const users = await prisma.user.findMany({
    where: { emailVerified: true, emailStatus: { notIn: ["VALID", "SUPPRESSED"] } },
    select: { id: true, email: true, emailStatus: true },
  });
  console.log(`${users.length} confirmed user(s) not yet VALID`);
  if (dry) { users.forEach((u) => console.log(`  would mark VALID: ${u.email} (${u.emailStatus})`)); return; }
  const res = await prisma.user.updateMany({
    where: { id: { in: users.map((u) => u.id) } },
    data: { emailStatus: "VALID", emailVerdict: "magic-link", emailCheckedAt: new Date() },
  });
  console.log(`marked ${res.count} as VALID (verdict: magic-link)`);
}

async function pending(limit: number, dry: boolean) {
  if (!oversightEnabled()) throw new Error("EMAIL_OVERSIGHT_API_TOKEN / EMAIL_OVERSIGHT_LIST_ID not set");
  const users = await prisma.user.findMany({
    where: { emailStatus: "PENDING", emailVerified: false, emailCheckAttempts: { lt: MAX_CHECK_ATTEMPTS } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, email: true, emailCheckAttempts: true },
  });
  console.log(`${users.length} PENDING user(s) to check (limit ${limit})`);
  if (dry) { users.forEach((u) => console.log(`  would verify: ${u.email} (attempts so far ${u.emailCheckAttempts})`)); return; }
  const tally: Record<string, number> = {};
  for (const u of users) {
    const out = await verifyUserEmail(u.id);
    const key = out?.status ?? "?";
    tally[key] = (tally[key] ?? 0) + 1;
    console.log(`  ${u.email}: ${out?.verdict ?? "no reply"} → ${key}`);
  }
  console.log("done:", tally);
}

async function main() {
  const dry = has("dry-run");
  if (has("confirmed")) await confirmed(dry);
  if (has("pending")) await pending(Number(argv("limit") ?? 50), dry);
  if (has("status") || (!has("confirmed") && !has("pending"))) await status();
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
