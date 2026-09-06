/**
 * Identity and counting rules for ad clicks.
 *
 * Link shape: /api/ads/click/<adId>?c=<channel>&s=<token>
 *   channel: alert | fsa | si   (which email carried the ad)
 *   token:   u_<userId>          alert emails, added by the sender
 *            sub_…               Beehiiv's {{api_subscription_id}} merge tag
 */
import type { PrismaClient } from "@prisma/client";
import { attributionFromUser } from "./cohort";
import { upsertSubscriber } from "./sync";

export type ClickChannel = "alert" | "beehiiv_fsa" | "beehiiv_si" | "unknown";

const CHANNELS: Record<string, ClickChannel> = { alert: "alert", fsa: "beehiiv_fsa", si: "beehiiv_si" };

export const parseChannel = (v: string | null | undefined): ClickChannel => (v && CHANNELS[v]) || "unknown";

/** Trim, cap, and drop anything that is not a token we mint or Beehiiv mints. Unrendered merge tags ("{{…}}") are dropped. */
export function parseToken(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().slice(0, 120);
  if (!t || t.includes("{")) return null;
  if (/^u_[A-Za-z0-9-]{8,}$/.test(t) || /^sub_[A-Za-z0-9-]{8,}$/.test(t)) return t;
  return null;
}

/** The same person clicking the same ad again within this window is one click. */
export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|scanner|curl|wget|python-requests|headless|proofpoint|mimecast|safelinks|urldefense/i;

export const isBotUserAgent = (ua: string | null | undefined) => !!ua && BOT_UA.test(ua);

/** Resolve a token to a subscriber id; null when unknown (kept on the click row for later). */
export async function resolveSubscriber(db: PrismaClient, token: string | null, channel: ClickChannel): Promise<string | null> {
  if (!token) return null;
  if (token.startsWith("u_")) {
    const row = await db.subscriber.findUnique({ where: { userId: token.slice(2) }, select: { id: true } });
    if (row) return row.id;
    // App user not mirrored yet (signed up since the last sync): mirror on the spot so the click lands on them.
    const user = await db.user.findUnique({
      where: { id: token.slice(2) },
      select: { id: true, email: true, firstName: true, createdAt: true, signupSource: true, utmSource: true, utmMedium: true, utmCampaign: true, utmTerm: true, utmContent: true, referrer: true, landingPath: true },
    });
    if (!user) return null;
    return upsertSubscriber(db, { email: user.email, firstName: user.firstName, source: "app", createdAt: user.createdAt, attribution: attributionFromUser(user), columns: { userId: user.id, appCreatedAt: user.createdAt } });
  }
  const where = channel === "beehiiv_si" ? { beehiivSiId: token } : channel === "beehiiv_fsa" ? { beehiivFsaId: token } : null;
  if (where) {
    const row = await db.subscriber.findUnique({ where, select: { id: true } });
    if (row) return row.id;
  }
  const any = await db.subscriber.findFirst({ where: { OR: [{ beehiivFsaId: token }, { beehiivSiId: token }] }, select: { id: true } });
  return any?.id ?? null;
}

export interface RecordClickInput {
  adId: string;
  adValueCents: number;
  channel: ClickChannel;
  token: string | null;
  ipHash: string;
  userAgent: string | null;
  now?: Date;
}

/**
 * Write the click. Counted when it is not a bot and the same identity has no
 * counted click on this ad in the last 24 hours. The identity is the resolved
 * subscriber, else the IP: a token that does not resolve is never its own
 * identity, so fabricated tokens cannot mint unlimited counted clicks. Value
 * is credited (countedClicks and clickValueCents) only to a resolved
 * subscriber from an alert email: newsletter clicks are counted by Beehiiv
 * and synced separately, so a snippet click must not be credited twice.
 */
export async function recordClick(db: PrismaClient, input: RecordClickInput) {
  const now = input.now ?? new Date();
  const subscriberId = await resolveSubscriber(db, input.token, input.channel);
  let counted = !isBotUserAgent(input.userAgent);
  if (counted) {
    const since = new Date(now.getTime() - DEDUPE_WINDOW_MS);
    const identity = subscriberId ? { subscriberId } : { ipHash: input.ipHash };
    const dup = await db.emailAdClick.findFirst({ where: { adId: input.adId, counted: true, ts: { gte: since }, ...identity }, select: { id: true } });
    if (dup) counted = false;
  }
  const credit = counted && input.channel === "alert" && !!subscriberId;
  const valueCents = credit ? input.adValueCents : 0;
  await db.$transaction([
    db.emailAdClick.create({ data: { adId: input.adId, ts: now, ipHash: input.ipHash, userAgent: input.userAgent, counted, channel: input.channel, token: input.token, subscriberId, valueCents } }),
    ...(counted ? [db.emailAd.update({ where: { id: input.adId }, data: { clicks: { increment: 1 } } })] : []),
    ...(credit
      ? [db.subscriber.update({ where: { id: subscriberId }, data: { countedClicks: { increment: 1 }, clickValueCents: { increment: valueCents }, lastClickAt: now } })]
      : []),
  ]);
  return { counted, credited: credit, subscriberId, valueCents };
}
