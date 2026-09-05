/**
 * Regenerate lib/email/disposableDomains.ts from the community blocklist.
 *   npm run update:disposable
 */
import { writeFileSync } from "fs";
import { join } from "path";

const SOURCE = "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  const domains = [...new Set(text.split("\n").map((d) => d.trim().toLowerCase()).filter((d) => d && !d.startsWith("#")))].sort();
  const out = `/**
 * Disposable / throwaway email domains. GENERATED FILE, do not edit by hand.
 * Source: https://github.com/disposable-email-domains/disposable-email-domains
 * Refresh with: npm run update:disposable
 * Domains: ${domains.length}
 */
const RAW = \`${domains.join("\n")}\`;

let cache: Set<string> | null = null;

export function disposableDomains(): Set<string> {
  if (!cache) cache = new Set(RAW.split("\\n"));
  return cache;
}

/** True when the domain, or any parent domain, is a known throwaway provider. */
export function isDisposableDomain(domain: string): boolean {
  const set = disposableDomains();
  const parts = domain.toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (set.has(parts.slice(i).join("."))) return true;
  }
  return false;
}
`;
  writeFileSync(join(__dirname, "..", "lib", "email", "disposableDomains.ts"), out);
  console.log(`wrote ${domains.length} domains`);
}

main().catch((e) => { console.error(e); process.exit(1); });
