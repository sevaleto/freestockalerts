/**
 * "Do Not Sell or Share My Personal Information" requests from /do-not-sell:
 * validation, the staff alert, and delivery. Mirrors src/lib/privacyNotify.ts
 * and the /api/privacy-request handler on research.tradingtips.com.
 *
 * A rights request carries a statutory deadline (CCPA/CPRA: 45 days,
 * extendable to 90 with notice), so the row is the durable record and the
 * email is the alert that a human has to act.
 */
import { Resend } from "resend";
import { addressList, EMAIL_PATTERN, escapeHtml, siteUrl, str } from "./shared";
import type { ParseResult } from "./advertiserInquiry";

export interface PrivacyRequestInput {
  requesterType: "consumer" | "agent";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  details: string | null;
}

/** Validate an untrusted JSON body. A filled honeypot (`company`) is a silent accept. */
export function parsePrivacyRequest(body: Record<string, unknown>): ParseResult<PrivacyRequestInput> {
  if (str(body.company)) return { ok: true, honeypot: true };
  const firstName = str(body.firstName, 100);
  const lastName = str(body.lastName, 100);
  const email = str(body.email, 200).toLowerCase();
  const missing: string[] = [];
  if (!firstName) missing.push("first name");
  if (!lastName) missing.push("last name");
  if (!EMAIL_PATTERN.test(email)) missing.push("a valid email address");
  if (missing.length) return { ok: false, error: `Please provide ${missing.join(", ")}.` };
  return {
    ok: true,
    data: {
      requesterType: str(body.requesterType) === "agent" ? "agent" : "consumer",
      firstName,
      lastName,
      email,
      phone: str(body.phone, 50),
      street: str(body.street, 300) || null,
      city: str(body.city, 120) || null,
      state: str(body.state, 120) || null,
      zip: str(body.zip, 20) || null,
      country: str(body.country, 120) || null,
      details: str(body.details, 2000) || null,
    },
  };
}

/**
 * Recipients default to the named staff rather than requiring an env var: a
 * failsafe that silently does nothing because a variable was never set is not
 * a failsafe. PRIVACY_ALERT_EMAILS overrides without a deploy.
 */
const DEFAULT_RECIPIENTS = ["manuel@tradingtips.com", "chelsie@trading-tips.us", "nicole@trading-tips.us"];

export function privacyAlertRecipients(): string[] {
  const configured = addressList(process.env.PRIVACY_ALERT_EMAILS);
  return configured.length ? configured : DEFAULT_RECIPIENTS;
}

export interface PrivacyRequestPayload extends PrivacyRequestInput {
  id: string;
  receivedAt: Date;
}

function lines(r: PrivacyRequestPayload): Array<[string, string]> {
  const address = [r.street, r.city, r.state, r.zip, r.country].filter(Boolean).join(", ");
  return [
    ["Received", r.receivedAt.toISOString()],
    ["Filed by", r.requesterType === "agent" ? "Consumer's Authorized Agent" : "Consumer"],
    ["Name", `${r.firstName} ${r.lastName}`],
    ["Email", r.email],
    ["Phone", r.phone || "—"],
    ["Address", address || "—"],
    ["Details", r.details?.trim() || "(none provided)"],
  ];
}

export function renderPrivacyAlert(r: PrivacyRequestPayload): { subject: string; html: string; text: string } {
  const host = siteUrl().replace(/^https?:\/\//, "");
  const text = [
    `A "Do Not Sell or Share My Personal Information" request was submitted on ${host}.`,
    "",
    ...lines(r).map(([label, value]) => `${label}: ${value}`),
    "",
    "CCPA/CPRA allows 45 days to respond, extendable to 90 with notice.",
    `Record id ${r.id} in the PrivacyRequest table.`,
  ].join("\n");
  const html = [
    `<p style="font-family:system-ui,sans-serif;font-size:14px">A &ldquo;Do Not Sell or Share My Personal Information&rdquo; request was submitted on ${escapeHtml(host)}.</p>`,
    `<table cellpadding="6" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">`,
    ...lines(r).map(
      ([label, value]) =>
        `<tr><td style="vertical-align:top;color:#5B6B7F"><strong>${escapeHtml(label)}</strong></td>` +
        `<td style="vertical-align:top;color:#071B3C">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
    ),
    `</table>`,
    `<p style="font-family:system-ui,sans-serif;font-size:13px;color:#5B6B7F">CCPA/CPRA allows 45 days to respond, extendable to 90 with notice.<br>Record id ${escapeHtml(r.id)} in the PrivacyRequest table.</p>`,
  ].join("\n");
  return { subject: `Do Not Sell request — ${r.firstName} ${r.lastName}`, html, text };
}

export async function sendPrivacyRequestAlert(r: PrivacyRequestPayload): Promise<{ ok: boolean; error?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const from = process.env.RESEND_FROM ?? "FreeStockAlerts <alerts@freestockalerts.ai>";
  const { subject, html, text } = renderPrivacyAlert(r);
  const { error } = await resend.emails.send({ from, to: privacyAlertRecipients(), subject, html, text });
  return error ? { ok: false, error: JSON.stringify(error) } : { ok: true };
}
