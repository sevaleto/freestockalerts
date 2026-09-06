/**
 * The email ad snippet, ported from the Trading Tips Email Ops banner creator
 * (tools.tradingtips.com/banners) so the two look the same. Single source of
 * truth for the HTML: the email, the admin preview and the tests all render
 * through `renderAdHtml`.
 *
 * Email-client constraints: table-based layout, every style inline, no
 * flexbox/grid, no <style> blocks, no web fonts. The two columns are "fluid
 * hybrid": inline-block divs that sit side by side while there is room and
 * stack when there isn't, with Outlook-only ghost tables. No fixed pixel
 * widths on a table or cell, or phones clip the card.
 *
 * Widths: the alert email body is a 600px container with 24px padding, so
 * the card's inner width is about 518px at 16px padding. Image 200 + gap 16
 * + copy 296 = 512 fits on desktop; on a phone the copy wraps under the image.
 * The wrapper uses font-size:0 so the whitespace between the two inline
 * blocks does not eat the slack.
 */

export const HEADLINE_COLORS = [
  { name: "Dark Navy", value: "#1a2b5c" },
  { name: "Dark Green", value: "#2d5a27" },
  { name: "Black", value: "#1a1a1a" },
] as const;

export const LEAD_IN_PRESETS = ["Additional Reading", "Special Report", "Exclusive Story", "From Our Partners"] as const;

export const AD_STATUSES = ["active", "paused"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

/** Only what the snippet renders. */
export interface AdInput {
  leadIn: string;
  headline: string;
  headlineColor: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string | null;
}

/** What the admin form submits: the snippet plus scheduling. */
export interface AdRecordInput extends AdInput {
  name: string;
  status: AdStatus;
  weight: number;
  startAt: string | null;
  endAt: string | null;
  /** Revenue assumed per counted click, in cents. */
  valueCents: number;
}

export const DEFAULT_CLICK_VALUE_CENTS = 250;

const FONT = "Arial, Helvetica, sans-serif";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function bodyParagraphs(body: string): string {
  return body
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin: 0 0 14px 0; font-family: ${FONT}; font-size: 16px; color: #333333; line-height: 1.5;">${escapeHtml(p)}</p>`)
    .join("\n");
}

/**
 * @param clickUrl where the CTA and image link go. In emails this is the
 * tracked /api/ads/click/<id> URL; in the admin preview it is the raw CTA URL.
 */
export function renderAdHtml(input: AdInput, clickUrl: string): string {
  const headerLine = `${input.leadIn.trim()}:`;
  const url = escapeHtml(clickUrl.trim());
  const alt = escapeHtml(input.headline.trim());
  const color = HEADLINE_COLORS.some((c) => c.value === input.headlineColor) ? input.headlineColor : HEADLINE_COLORS[0].value;
  const image = input.imageUrl?.trim();
  const copyMaxWidth = image ? "296px" : "560px";

  const imageColumn = image
    ? `<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="200" valign="top"><![endif]-->
            <div style="display: inline-block; width: 100%; max-width: 200px; margin: 0 16px 16px 0; vertical-align: top; font-size: 16px;">
              <a href="${url}" target="_blank" rel="nofollow sponsored noopener" style="text-decoration: none;"><img src="${escapeHtml(image)}" width="200" alt="${alt}" style="display: block; width: 100%; max-width: 200px; height: auto; border: 0; border-radius: 12px;" /></a>
            </div>
            <!--[if mso]></td><td width="16">&nbsp;</td><td valign="top"><![endif]-->`
    : "";
  const msoClose = image ? `<!--[if mso]></td></tr></table><![endif]-->` : "";

  return `<!-- Sponsored: ${escapeHtml(input.headline.trim())} -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding: 0;">
      <div style="font-family: ${FONT}; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #8A97A8; padding: 0 0 8px 0; text-align: left;">Sponsored</div>
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #f7f7f7; border: 1px solid #e0e0e0; border-radius: 12px;">
        <tr>
          <td style="padding: 16px; font-family: ${FONT}; text-align: left;">
            <div style="font-family: ${FONT}; font-size: 20px; font-weight: bold; color: #1a1a1a; line-height: 1.3; padding-bottom: 16px;">${escapeHtml(headerLine)}</div>
            <div style="font-size: 0; line-height: 0;">
            ${imageColumn}
            <div style="display: inline-block; width: 100%; max-width: ${copyMaxWidth}; vertical-align: top; font-size: 16px; line-height: 1.5;">
              <div style="font-family: ${FONT}; font-size: 19px; font-weight: bold; color: ${color}; line-height: 1.3; padding-bottom: 10px;">${escapeHtml(input.headline.trim())} <span style="color:#888;font-weight:normal;font-size:14px;">(Ad)</span></div>
              ${bodyParagraphs(input.body)}
              <div style="padding-top: 6px;">
                <a href="${url}" target="_blank" rel="nofollow sponsored noopener" style="font-family: ${FONT}; font-size: 16px; font-weight: bold; color: #1a73e8; text-decoration: underline;">${escapeHtml(input.ctaText.trim())}</a>
              </div>
            </div>
            ${msoClose}
            </div>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>`;
}

export type ClickChannelParam = "alert" | "fsa" | "si";

/**
 * Tracked link for an ad. `channel` says which email carried it and `token`
 * identifies the reader: `u_<userId>` for app emails, or Beehiiv's
 * `{{api_subscription_id}}` merge tag for newsletter snippets.
 */
export function adClickUrl(adId: string, opts: { channel?: ClickChannelParam; token?: string | null; appUrl?: string } = {}) {
  const appUrl = opts.appUrl ?? "https://www.freestockalerts.ai";
  const params = new URLSearchParams();
  if (opts.channel) params.set("c", opts.channel);
  const q = params.toString();
  // The token is appended raw so a Beehiiv merge tag survives URL encoding.
  const tokenPart = opts.token ? `${q ? "&" : "?"}s=${opts.token}` : "";
  return `${appUrl}/api/ads/click/${adId}${q ? `?${q}` : ""}${tokenPart}`;
}

/** Snippet HTML to paste into a Beehiiv post; Beehiiv fills the subscriber id at send time. */
export const beehiivSnippetHtml = (ad: AdInput & { id: string }, channel: "fsa" | "si", appUrl?: string) =>
  renderAdHtml(ad, adClickUrl(ad.id, { channel, token: "{{api_subscription_id}}", appUrl }));

const str = (v: unknown, limit: number) => (typeof v === "string" ? v.trim().slice(0, limit) : "");

function httpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validate an untrusted admin submission. Picks fields explicitly so nothing else leaks through. */
export function validateAdInput(data: Record<string, unknown>): { ok: true; input: AdRecordInput } | { ok: false; error: string } {
  const name = str(data.name, 120);
  const leadIn = str(data.leadIn, 80);
  const headline = str(data.headline, 160);
  const headlineColor = str(data.headlineColor, 20);
  const body = str(data.body, 2000);
  const ctaText = str(data.ctaText, 120);
  const ctaUrl = str(data.ctaUrl, 1000);
  const imageUrl = str(data.imageUrl, 1000);
  for (const [key, value] of Object.entries({ name, leadIn, headline, body, ctaText, ctaUrl })) {
    if (!value) return { ok: false, error: `Missing field: ${key}` };
  }
  if (!HEADLINE_COLORS.some((c) => c.value === headlineColor)) return { ok: false, error: "Headline color must be one of the presets" };
  if (!httpUrl(ctaUrl)) return { ok: false, error: "CTA URL must be a valid http(s) URL" };
  if (imageUrl && !httpUrl(imageUrl)) return { ok: false, error: "Image URL must be a valid http(s) URL" };
  const status = str(data.status, 10) === "paused" ? "paused" : "active";
  const weightRaw = typeof data.weight === "number" ? data.weight : Number(str(data.weight, 5));
  const weight = Number.isInteger(weightRaw) && weightRaw >= 1 && weightRaw <= 100 ? weightRaw : 1;
  const date = (v: unknown): string | null | "invalid" => {
    const s = str(v, 40);
    if (!s) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : "invalid";
  };
  const startAt = date(data.startAt);
  const endAt = date(data.endAt);
  if (startAt === "invalid" || endAt === "invalid") return { ok: false, error: "Start and end must be valid dates" };
  if (startAt && endAt && startAt > endAt) return { ok: false, error: "End date must be after the start date" };
  const valueUnset = data.valueCents === undefined || data.valueCents === null || data.valueCents === "";
  const valueRaw = typeof data.valueCents === "number" ? data.valueCents : Number(str(data.valueCents, 10));
  if (!valueUnset && (!Number.isInteger(valueRaw) || valueRaw < 0 || valueRaw > 100_000)) return { ok: false, error: "Value per click must be between $0 and $1,000" };
  const valueCents = valueUnset ? DEFAULT_CLICK_VALUE_CENTS : valueRaw;
  return { ok: true, input: { name, leadIn, headline, headlineColor, body, ctaText, ctaUrl, imageUrl: imageUrl || null, status, weight, startAt, endAt, valueCents } };
}
