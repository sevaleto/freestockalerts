/**
 * Only allow same-origin relative paths as post-login destinations.
 * Pure — safe in middleware (edge), server routes, and the browser.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/dashboard";
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    raw.startsWith("/api/")
  ) {
    return "/dashboard";
  }
  return raw;
}
