/**
 * When CRON_SECRET is set, only requests carrying `Authorization: Bearer <CRON_SECRET>`
 * are accepted (Vercel adds the header to cron invocations). Unset = open, matching
 * the legacy behaviour of /api/alerts/check.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
