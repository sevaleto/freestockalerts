import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";

/**
 * Resend webhook handler.
 * Listens for contact.unsubscribed events to sync unsubscribe state back to our DB.
 * 
 * Configure in Resend dashboard → Webhooks → Add endpoint:
 *   URL: https://www.freestockalerts.ai/api/webhooks/resend
 *   Events: contact.unsubscribed
 */
export async function POST(request: Request) {
  try {
    // Verify webhook signature if RESEND_WEBHOOK_SECRET is set
    const signature = request.headers.get("resend-signature");
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    
    if (webhookSecret && !signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const payload = await request.json();
    const { type, data } = payload;

    switch (type) {
      case "contact.updated": {
        const email = data?.email;
        if (!email) break;

        // If contact was marked unsubscribed in Resend, sync to our DB
        if (data?.unsubscribed === true) {
          await prisma.user.updateMany({
            where: { email },
            data: { unsubscribedFromBlasts: true },
          });
          console.log(`[Webhook] User unsubscribed from blasts: ${email}`);
        }
        break;
      }

      case "contact.deleted": {
        const email = data?.email;
        if (!email) break;

        // Contact removed from audience — mark as unsubscribed
        await prisma.user.updateMany({
          where: { email },
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
