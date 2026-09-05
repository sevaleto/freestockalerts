import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma/client";
import { unsubscribeContact } from "@/lib/email/audience";
import { markEmailFromResend } from "@/lib/email/verification";

export const dynamic = "force-dynamic";

/**
 * Resend webhook handler.
 *
 * Configure in Resend dashboard → Webhooks → Add endpoint:
 *   URL:    https://www.freestockalerts.ai/api/webhooks/resend
 *   Events: email.bounced, email.complained, contact.updated, contact.deleted
 * Put the endpoint's signing secret (whsec_…) in RESEND_WEBHOOK_SECRET.
 *
 * Bounces and complaints suppress the address from broadcasts and record the
 * verdict on the user (complaint → SUPPRESSED, bounce → INVALID) so exports
 * and lead sharing skip them too. See lib/email/verification.ts.
 */

const TOLERANCE_SEC = 5 * 60;

/** Standard-Webhooks / Svix signature check, no dependency. */
function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const timestamp = headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const signature = headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SEC) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();

  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

async function suppress(email: string, why: "email.bounced" | "email.complained") {
  const normalized = email.trim().toLowerCase();
  await markEmailFromResend(normalized, why === "email.complained" ? "complaint" : "bounce");
  const users = await prisma.user.findMany({
    where: { email: normalized },
    select: { id: true, resendContactId: true },
  });
  await prisma.user.updateMany({
    where: { email: normalized },
    data: { unsubscribedFromBlasts: true },
  });
  for (const u of users) {
    if (u.resendContactId) await unsubscribeContact(u.resendContactId);
  }
  console.log(`[Webhook] ${why}: suppressed ${normalized} (${users.length} user row(s))`);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const secret = process.env.RESEND_WEBHOOK_SECRET;

    if (secret) {
      if (!verifySignature(rawBody, request.headers, secret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("[Webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned webhook");
    }

    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    switch (type) {
      case "email.bounced":
      case "email.complained": {
        const recipients: string[] = Array.isArray(data?.to) ? data.to : data?.to ? [data.to] : [];
        for (const to of recipients) await suppress(to, type);
        break;
      }

      case "contact.updated": {
        const email = data?.email;
        if (!email) break;
        if (data?.unsubscribed === true) {
          await prisma.user.updateMany({
            where: { email: String(email).toLowerCase() },
            data: { unsubscribedFromBlasts: true },
          });
          console.log(`[Webhook] User unsubscribed from blasts: ${email}`);
        }
        break;
      }

      case "contact.deleted": {
        const email = data?.email;
        if (!email) break;
        await prisma.user.updateMany({
          where: { email: String(email).toLowerCase() },
          data: { unsubscribedFromBlasts: true, resendContactId: null },
        });
        console.log(`[Webhook] Contact deleted, marked unsubscribed: ${email}`);
        break;
      }

      case "contact.created":
        console.log(`[Webhook] Contact created: ${data?.email}`);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing Resend webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
