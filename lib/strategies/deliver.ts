/**
 * Email a new signal to everyone subscribed to its strategy. A delivery row is
 * unique per signal and user, so re-running the scan (or two overlapping runs)
 * never sends the same alert twice.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { sendSignalEmail } from "@/lib/email/sendSignalEmail";
import type { SignalLike } from "./present";

type Db = PrismaClient;

const NEVER_MAIL = new Set(["INVALID", "SUPPRESSED"]);

export interface DeliveryResult {
  subscribers: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function deliverSignal(db: Db, signal: SignalLike & { id: string }, strategyName: string, log: (m: string) => void = () => {}): Promise<DeliveryResult> {
  const subs = await db.templateSubscription.findMany({
    where: { isActive: true, template: { slug: signal.strategySlug } },
    include: { user: { select: { id: true, email: true, emailStatus: true, preferences: { select: { emailAlerts: true } } } } },
  });
  const result: DeliveryResult = { subscribers: subs.length, sent: 0, skipped: 0, failed: 0 };

  for (const sub of subs) {
    const user = sub.user;
    if (!user?.email || user.preferences?.emailAlerts === false || NEVER_MAIL.has(user.emailStatus)) {
      result.skipped++;
      continue;
    }
    // Claim the delivery first; a unique-constraint hit means another run already has it.
    let delivery;
    try {
      delivery = await db.signalDelivery.create({ data: { signalId: signal.id, userId: user.id, emailSent: false } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        result.skipped++;
        continue;
      }
      throw err;
    }
    try {
      const { error } = await sendSignalEmail({ to: user.email, userId: user.id, strategyName, signal });
      if (error) throw new Error(JSON.stringify(error));
      await db.signalDelivery.update({ where: { id: delivery.id }, data: { emailSent: true, sentAt: new Date() } });
      result.sent++;
    } catch (err) {
      result.failed++;
      log(`email failed for ${signal.symbol} → ${user.id}: ${err instanceof Error ? err.message : err}`);
      // Leave the claim so a retry loop elsewhere can pick it up; it will not be re-sent by the scan.
    }
  }
  return result;
}
