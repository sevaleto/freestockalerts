/** Helpers shared by the public form handlers. */
import { createHash } from "node:crypto";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed string from untrusted JSON, capped in length; "" for anything else. */
export function str(v: unknown, limit = 200): string {
  return typeof v === "string" ? v.trim().slice(0, limit) : "";
}

/** Everything in these emails is attacker-controlled free text from a public form; render it inert. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** sha256(salt + ip). Stores no raw address; IP_HASH_SALT is optional and only makes the hash non-reversible for IPv4. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "freestockalerts";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export function addressList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter((a) => EMAIL_PATTERN.test(a));
}

export const siteUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://www.freestockalerts.ai";

/** Address the legal pages publish for anything that could not be recorded. */
export const SUPPORT_EMAIL = "support@freestockalerts.ai";
