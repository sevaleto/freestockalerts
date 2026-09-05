/**
 * Lightweight "did you mean" for email domains. Catches the typos that
 * actually show up in ad traffic (hotmdil.com, yaho.com, gmail.con) with no
 * dependency. Cannot catch typos in the part before the @.
 */
const DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com"];
const TLD_FIX: Record<string, string> = { con: "com", cmo: "com", vom: "com", ocm: "com", comm: "com", co: "com", cm: "com" };

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain.includes(".")) return null;
  if (DOMAINS.includes(domain)) return null;

  let best: { domain: string; dist: number } | null = null;
  for (const d of DOMAINS) {
    const dist = editDistance(domain, d);
    if (dist <= 2 && (!best || dist < best.dist)) best = { domain: d, dist };
  }

  if (!best) {
    const parts = domain.split(".");
    if (parts.length === 2) {
      const [name, tld] = parts;
      const fixed = TLD_FIX[tld] ? `${name}.${TLD_FIX[tld]}` : null;
      if (fixed && DOMAINS.includes(fixed)) best = { domain: fixed, dist: 1 };
    }
  }

  return best ? `${local}@${best.domain}` : null;
}
