/**
 * Advertiser inquiries from /advertise: validation, the notification email,
 * and delivery. Mirrors src/lib/advertiserInquiry.ts on research.tradingtips.com.
 *
 * The row in AdvertiserInquiry is the record; the email is the notification.
 * `sendAdvertiserInquiry` throws on failure so the route can mark the row
 * `failed` rather than let an undelivered lead look handled.
 */
import { Resend } from "resend";
import { addressList, EMAIL_PATTERN, escapeHtml, siteUrl, str } from "./shared";

export interface AdvertiserInquiryInput {
  name: string;
  email: string;
  company: string;
  website: string | null;
  phone: string | null;
  message: string | null;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: true; honeypot: true } | { ok: false; error: string };

/** Validate an untrusted JSON body. A filled honeypot (`fax`) is a silent accept: bots learn nothing. */
export function parseAdvertiserInquiry(body: Record<string, unknown>): ParseResult<AdvertiserInquiryInput> {
  if (str(body.fax)) return { ok: true, honeypot: true };
  const name = str(body.name, 150);
  const email = str(body.email, 200).toLowerCase();
  const company = str(body.company, 200);
  const missing: string[] = [];
  if (!name) missing.push("your name");
  if (!company) missing.push("a company name");
  if (!EMAIL_PATTERN.test(email)) missing.push("a valid work email address");
  if (missing.length) return { ok: false, error: `Please provide ${missing.join(", ")}.` };
  return {
    ok: true,
    data: {
      name,
      email,
      company,
      website: str(body.website, 300) || null,
      phone: str(body.phone, 50) || null,
      message: str(body.message, 2000) || null,
    },
  };
}

/**
 * Where inquiries land. Chelsie owns the follow-up; Manny is bcc'd so he sees
 * the flow without appearing on the thread the prospect replies to. Both are
 * env-overridable and read at call time.
 */
export function advertiserRecipients(): { to: string[]; bcc: string[] } {
  const to = addressList(process.env.ADVERTISER_INQUIRY_TO);
  const bcc = addressList(process.env.ADVERTISER_INQUIRY_BCC);
  return { to: to.length ? to : ["chelsie@trading-tips.us"], bcc: bcc.length ? bcc : ["manuel@tradingtips.com"] };
}

export interface AdvertiserInquiryPayload extends AdvertiserInquiryInput {
  id: string;
  receivedAt: Date;
}

function rows(i: AdvertiserInquiryPayload): Array<[string, string]> {
  return [
    ["Name", i.name],
    ["Email", i.email],
    ["Company", i.company],
    ["Website", i.website || "(not provided)"],
    ["Phone", i.phone || "(not provided)"],
    ["Message", i.message || "(none)"],
    ["Received", i.receivedAt.toISOString()],
  ];
}

export function renderInquiryEmail(i: AdvertiserInquiryPayload): { subject: string; html: string; text: string } {
  const pairs = rows(i);
  const html = [
    `<p style="margin:0 0 16px;font-family:system-ui,sans-serif;font-size:14px">New advertiser inquiry from <strong>${escapeHtml(i.company)}</strong> via ${escapeHtml(siteUrl())}/advertise.</p>`,
    `<table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">`,
    ...pairs.map(
      ([label, value]) =>
        `<tr><td style="vertical-align:top;color:#5B6B7F;white-space:nowrap"><strong>${escapeHtml(label)}</strong></td>` +
        `<td style="vertical-align:top;color:#071B3C">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
    ),
    `</table>`,
    `<p style="margin:16px 0 0;font-family:system-ui,sans-serif;font-size:14px">Reply to this email to reach ${escapeHtml(i.name)} directly.</p>`,
    `<p style="margin:8px 0 0;font-family:system-ui,sans-serif;font-size:13px;color:#8A97A8">Record id ${escapeHtml(i.id)} in the AdvertiserInquiry table.</p>`,
  ].join("");
  const text = [
    `New advertiser inquiry from ${i.company} via ${siteUrl()}/advertise.`,
    "",
    ...pairs.map(([label, value]) => `${label}: ${value}`),
    "",
    `Reply to this email to reach ${i.name} directly.`,
    `Record id ${i.id} in the AdvertiserInquiry table.`,
  ].join("\n");
  return { subject: `New advertiser inquiry — ${i.company}`, html, text };
}

/** Sends to the sales inbox with Reply-To set to the prospect. Throws on failure. */
export async function sendAdvertiserInquiry(i: AdvertiserInquiryPayload): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const from = process.env.RESEND_FROM ?? "FreeStockAlerts <alerts@freestockalerts.ai>";
  const { to, bcc } = advertiserRecipients();
  const { subject, html, text } = renderInquiryEmail(i);
  const { error } = await resend.emails.send({ from, to, bcc, subject, html, text, replyTo: i.email });
  if (error) throw new Error(`Advertiser inquiry email failed: ${JSON.stringify(error)}`);
}
