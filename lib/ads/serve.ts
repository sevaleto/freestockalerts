/**
 * Pick the next ad for an outgoing email and count the impression. Server only.
 * Returns null when nothing is servable, in which case the email simply has no
 * sponsored section. Never throws: an ad failure must not block an alert.
 */
import { prisma } from "@/lib/prisma/client";
import { pickNextAd } from "./rotation";
import { adClickUrl, renderAdHtml } from "./template";

export interface ServedAd {
  id: string;
  name: string;
  html: string;
}

export { adClickUrl, beehiivSnippetHtml } from "./template";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://www.freestockalerts.ai";

export async function serveEmailAd(opts: { userId?: string | null; now?: Date } = {}): Promise<ServedAd | null> {
  const now = opts.now ?? new Date();
  try {
    const ads = await prisma.emailAd.findMany({ where: { status: "active" } });
    const ad = pickNextAd(ads, now);
    if (!ad) return null;
    await prisma.emailAd.update({ where: { id: ad.id }, data: { impressions: { increment: 1 }, lastShownAt: now } });
    return { id: ad.id, name: ad.name, html: renderAdHtml(ad, adClickUrl(ad.id, { channel: "alert", token: opts.userId ? `u_${opts.userId}` : null, appUrl: APP_URL() })) };
  } catch (err) {
    console.error("[ads] serve failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
