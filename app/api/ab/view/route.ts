import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { parseVariantTag } from "@/lib/cookies/bucket";
import { isBotUserAgent } from "@/lib/subscribers/clicks";

export const dynamic = "force-dynamic";

/**
 * POST /api/ab/view  { tag: "<page slug>:<key>" }
 *
 * View beacon from components/ab/HeadlineExposure.tsx. Increments the
 * variant's view counter; bots and malformed tags are ignored. Always 204 so
 * the browser never surfaces an error for analytics.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tag?: unknown } | null;
  const parsed = parseVariantTag(body?.tag);
  if (!parsed || isBotUserAgent(request.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });
  try {
    await prisma.headlineVariant.updateMany({ where: { key: parsed.key, page: { slug: parsed.slug } }, data: { views: { increment: 1 } } });
  } catch (err) {
    console.error("[ab/view] increment failed:", err);
  }
  return new NextResponse(null, { status: 204 });
}
