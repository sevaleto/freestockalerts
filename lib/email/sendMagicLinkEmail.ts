import { Resend } from "resend";
import { MagicLinkEmail, magicLinkSubject } from "@/lib/email/magicLinkEmail";

interface SendMagicLinkEmailInput {
  to: string;
  link: string;
  code: string;
  isNewUser: boolean;
  appUrl: string;
}

export async function sendMagicLinkEmail(input: SendMagicLinkEmailInput) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const from = process.env.RESEND_FROM ?? "FreeStockAlerts <alerts@freestockalerts.ai>";

  return resend.emails.send({
    from,
    to: input.to,
    subject: magicLinkSubject(input.isNewUser),
    react: MagicLinkEmail({
      link: input.link,
      code: input.code,
      isNewUser: input.isNewUser,
      appUrl: input.appUrl,
    }),
    headers: { "X-Entity-Ref-ID": `magic-link-${Date.now()}` },
  });
}
