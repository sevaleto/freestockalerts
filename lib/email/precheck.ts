import { promises as dns } from "dns";
import { isDisposableDomain } from "@/lib/email/disposableDomains";

/**
 * Cheap checks that run at form submit, before we mint a magic link:
 *   1. disposable-domain blocklist (throwaway inboxes never become readers)
 *   2. MX lookup (typos like gmial.com, or domains that simply don't take mail)
 *
 * Both are fail-open: a DNS timeout or a resolver error lets the signup
 * through, because Email Oversight verifies the address properly afterwards.
 */

export type PrecheckReason = "disposable" | "no-mx";
export type PrecheckResult = { ok: true } | { ok: false; reason: PrecheckReason; message: string };

const DNS_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Big providers: skip the lookup entirely. */
const KNOWN_GOOD = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "comcast.net", "att.net", "verizon.net", "sbcglobal.net",
  "protonmail.com", "proton.me", "cox.net", "charter.net",
]);

const mxCache = new Map<string, { ok: boolean; exp: number }>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("dns-timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const NXDOMAIN_CODES = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

/**
 * Does this domain accept mail? True on MX records (ignoring the RFC 7505
 * "null MX"), or on an A/AAAA record when no MX exists (implicit MX).
 * Returns null when DNS could not answer (timeout, SERVFAIL): caller fails open.
 */
export async function domainAcceptsMail(domain: string): Promise<boolean | null> {
  const cached = mxCache.get(domain);
  if (cached && cached.exp > Date.now()) return cached.ok;

  let ok: boolean | null = null;
  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    const usable = mx.filter((r) => r.exchange && r.exchange !== "." && r.exchange !== "");
    ok = usable.length > 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code ?? "";
    if (!NXDOMAIN_CODES.has(code)) return null; // timeout / servfail: unknown
    // No MX record: fall back to A/AAAA (RFC 5321 implicit MX)
    try {
      const a = await withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS);
      ok = a.length > 0;
    } catch (err4) {
      const code4 = (err4 as NodeJS.ErrnoException)?.code ?? "";
      if (!NXDOMAIN_CODES.has(code4)) return null;
      try {
        const aaaa = await withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS);
        ok = aaaa.length > 0;
      } catch (err6) {
        const code6 = (err6 as NodeJS.ErrnoException)?.code ?? "";
        if (!NXDOMAIN_CODES.has(code6)) return null;
        ok = false;
      }
    }
  }
  mxCache.set(domain, { ok, exp: Date.now() + CACHE_TTL_MS });
  return ok;
}

export async function precheckEmail(email: string): Promise<PrecheckResult> {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return { ok: true };

  if (isDisposableDomain(domain)) {
    return { ok: false, reason: "disposable", message: "Please use a permanent email address. Temporary inboxes can't receive your alerts." };
  }

  if (KNOWN_GOOD.has(domain)) return { ok: true };

  const accepts = await domainAcceptsMail(domain);
  if (accepts === false) {
    return { ok: false, reason: "no-mx", message: `We can't find a mail server for "${domain}". Check the spelling and try again.` };
  }
  return { ok: true };
}
