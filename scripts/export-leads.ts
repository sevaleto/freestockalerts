/**
 * Export mailable leads as CSV, gated on the deliverability verdict.
 *
 *   npx tsx scripts/export-leads.ts --purpose newsletter  [--since 2026-09-01] [--out leads.csv]
 *   npx tsx scripts/export-leads.ts --purpose lead-share  [--since 2026-09-01] [--out leads.csv]
 *
 * newsletter  → emailStatus VALID or ACCEPT_ALL, not unsubscribed
 * lead-share  → emailStatus VALID only, not unsubscribed
 *
 * The filter lives in lib/email/verification.ts (leadWhere) so this script,
 * the Resend audience, and any future API export agree.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { leadWhere, type LeadPurpose } from "../lib/email/verification";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const purpose = (arg("purpose") ?? "newsletter") as LeadPurpose;
  if (purpose !== "newsletter" && purpose !== "lead-share") throw new Error("--purpose must be newsletter or lead-share");
  const since = arg("since") ? new Date(arg("since")!) : undefined;
  const out = arg("out") ?? `leads-${purpose}-${new Date().toISOString().slice(0, 10)}.csv`;

  const where = { ...leadWhere(purpose), ...(since ? { createdAt: { gte: since } } : {}) };
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: { email: true, firstName: true, createdAt: true, signupSource: true, emailStatus: true, emailVerdict: true, emailVerified: true },
  });

  const excluded = await prisma.user.groupBy({
    by: ["emailStatus"],
    where: { NOT: where, ...(since ? { createdAt: { gte: since } } : {}) },
    _count: { _all: true },
  });

  const header = ["email", "first_name", "signed_up_at", "signup_source", "email_status", "email_verdict", "confirmed"];
  const rows = users.map((u) => [u.email, u.firstName, u.createdAt.toISOString(), u.signupSource, u.emailStatus, u.emailVerdict, u.emailVerified ? "yes" : "no"].map(csvCell).join(","));
  writeFileSync(out, [header.join(","), ...rows].join("\n") + "\n");

  console.log(`purpose=${purpose}${since ? ` since=${since.toISOString().slice(0, 10)}` : ""}`);
  console.log(`exported ${users.length} lead(s) → ${out}`);
  console.log("excluded by status:", Object.fromEntries(excluded.map((e) => [e.emailStatus, e._count._all])));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
