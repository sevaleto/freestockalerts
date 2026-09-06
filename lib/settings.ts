/** Small key/value admin settings backed by AppSetting. */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

export const NEWSLETTER_CLICK_VALUE_KEY = "newsletterClickValueCents";
export const DEFAULT_NEWSLETTER_CLICK_VALUE_CENTS = 250;

export async function getSetting(key: string, db: PrismaClient = prisma): Promise<string | null> {
  const row = await db.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, db: PrismaClient = prisma): Promise<void> {
  await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Revenue assumed per unique newsletter click (Beehiiv counts), in cents. */
export async function getNewsletterClickValueCents(db: PrismaClient = prisma): Promise<number> {
  const raw = (await getSetting(NEWSLETTER_CLICK_VALUE_KEY, db))?.trim() ?? "";
  // Number("") is 0, so a blank value must be treated as unset, not as free clicks.
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_NEWSLETTER_CLICK_VALUE_CENTS;
}
