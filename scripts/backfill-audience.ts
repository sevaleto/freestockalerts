/**
 * Backfill script: Sync all existing users to the Resend broadcast audience.
 * 
 * Usage: npx tsx scripts/backfill-audience.ts
 * 
 * Safe to run multiple times — Resend dedupes by email, and we skip users
 * who already have a resendContactId or are unsubscribed.
 */

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY ?? "");

async function getOrCreateAudience(): Promise<string> {
  if (process.env.RESEND_AUDIENCE_ID) {
    return process.env.RESEND_AUDIENCE_ID;
  }

  const { data: audiences } = await resend.audiences.list();
  const existing = audiences?.data?.find(
    (a: { name: string }) => a.name === "FreeStockAlerts Users"
  );
  if (existing) {
    console.log(`Found existing audience: ${existing.id}`);
    return existing.id;
  }

  const { data: created } = await resend.audiences.create({
    name: "FreeStockAlerts Users",
  });
  if (!created) throw new Error("Failed to create audience");
  console.log(`Created new audience: ${created.id}`);
  return created.id;
}

async function main() {
  const audienceId = await getOrCreateAudience();
  console.log(`Audience ID: ${audienceId}\n`);

  // Get all users who haven't been synced yet and haven't unsubscribed
  const users = await prisma.user.findMany({
    where: {
      resendContactId: null,
      unsubscribedFromBlasts: false,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
    },
  });

  console.log(`Found ${users.length} users to sync\n`);

  let synced = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const { data } = await resend.contacts.create({
        audienceId,
        email: user.email,
        firstName: user.firstName ?? undefined,
        unsubscribed: false,
      });

      if (data?.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { resendContactId: data.id },
        });
        synced++;
        console.log(`✓ ${user.email} → ${data.id}`);
      }
    } catch (error) {
      failed++;
      console.error(`✗ ${user.email}:`, error);
    }

    // Rate limit: Resend allows 10 req/s on Pro
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`\nDone! Synced: ${synced}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
