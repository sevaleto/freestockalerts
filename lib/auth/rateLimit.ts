import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

/**
 * Per-IP rate limit for the signup route, backed by Postgres so it holds
 * across serverless instances and regions.
 *
 * The site is proxied through Cloudflare, so the visitor's real address is
 * in `cf-connecting-ip`; `x-forwarded-for` would be a Cloudflare edge IP.
 *
 * If the SignupRateLimit table does not exist yet (schema not pushed), the
 * limiter logs once and allows the request, so a deploy never breaks signup.
 */
const WINDOW_SEC = 60;
const LIMIT = 10;
let warnedMissingTable = false;

export function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function checkSignupRateLimit(ip: string): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (WINDOW_SEC * 1000)) * WINDOW_SEC * 1000);
  const retryAfterSec = Math.ceil((windowStart.getTime() + WINDOW_SEC * 1000 - now.getTime()) / 1000);

  try {
    // One upsert per request: increment the counter for this ip+window.
    const row = await prisma.signupRateLimit.upsert({
      where: { ip_windowStart: { ip, windowStart } },
      create: { ip, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    // Opportunistic cleanup of old windows (cheap, no-op most of the time).
    if (row.count === 1 && Math.random() < 0.05) {
      prisma.signupRateLimit
        .deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 15 * 60 * 1000) } } })
        .catch(() => {});
    }

    return { allowed: row.count <= LIMIT, remaining: Math.max(0, LIMIT - row.count), retryAfterSec };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      if (!warnedMissingTable) {
        console.warn("[rate-limit] SignupRateLimit table missing — run `prisma db push`; allowing requests until then");
        warnedMissingTable = true;
      }
      return { allowed: true, remaining: LIMIT, retryAfterSec: 0 };
    }
    console.error("[rate-limit] error:", err);
    return { allowed: true, remaining: LIMIT, retryAfterSec: 0 };
  }
}
