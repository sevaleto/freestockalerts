/**
 * Smoke test for the template catalog against a running server.
 *   npm run smoke                 # http://localhost:3000
 *   SMOKE_BASE_URL=https://www.freestockalerts.ai npm run smoke
 *
 * Read-only: no sign-in, no activation, no emails. It checks that every
 * strategy page renders its required sections, that old slugs redirect,
 * that unauthenticated activation is refused, and that the signup route
 * still validates input.
 */
import { STRATEGIES } from "../lib/templates/catalog";
import { LEGACY_TEMPLATE_SLUGS } from "../lib/templates/redirects";
import { LP_SLUGS } from "../lib/lp/pages";

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let failures = 0;

const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "  ok " : "  FAIL"} ${msg}`);
  if (!cond) failures++;
};
const get = (path: string, init?: RequestInit) => fetch(`${BASE}${path}`, { redirect: "manual", ...init });
const unescape = (html: string) => html.replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

const REQUIRED_SECTIONS = [
  "What this strategy watches",
  "How companies qualify",
  "What triggers the alert",
  "Current alert list",
  "Last refreshed",
  "Refresh cadence",
  "Why investors watch this setup",
  "When this signal can fail",
  "How the list is built",
  "Educational information only",
  "Illustrative example of an alert email",
];

async function main() {
  console.log(`smoke: ${BASE}`);

  console.log("\nindex");
  const index = await get("/templates");
  const indexHtml = unescape(await index.text());
  ok(index.status === 200, "GET /templates → 200");
  for (const label of ["Idea Discovery", "Entry Timing", "Market and Portfolio Monitoring"]) ok(indexHtml.includes(label), `index shows section "${label}"`);
  for (const s of STRATEGIES) ok(indexHtml.includes(s.name), `index lists ${s.name}`);
  ok(indexHtml.includes("Preview strategy"), 'index uses "Preview strategy"');
  ok(!/Preview →/.test(indexHtml), 'index no longer uses bare "Preview →"');
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(indexHtml), "index has no emoji");
  ok(/<link rel="canonical" href="[^"]*\/templates"/.test(indexHtml), "index has a canonical link");

  console.log("\nstrategy pages");
  for (const s of STRATEGIES) {
    const res = await get(`/templates/${s.slug}`);
    const html = unescape(await res.text());
    ok(res.status === 200, `GET /templates/${s.slug} → 200`);
    ok(html.includes(`<title>${s.seo.title.replace(/&/g, "&amp;")} | FreeStockAlerts.AI</title>`) || html.includes(`<title>${s.seo.title} | FreeStockAlerts.AI</title>`), `${s.slug}: unique title tag`);
    ok(html.includes(`content="${s.seo.description.replace(/"/g, "&quot;")}"`) || html.includes(s.seo.description), `${s.slug}: meta description`);
    ok(new RegExp(`<link rel="canonical" href="[^"]*/templates/${s.slug}"`).test(html), `${s.slug}: canonical`);
    ok(html.includes('property="og:title"'), `${s.slug}: open graph`);
    ok(html.includes(s.landing.headline.replace(/&/g, "&amp;")) || html.includes(s.landing.headline), `${s.slug}: headline`);
    ok(html.includes(s.landing.cta), `${s.slug}: CTA "${s.landing.cta}"`);
    for (const section of REQUIRED_SECTIONS) {
      const alt = s.kind === "signal" ? section.replace("Last refreshed", "Last scan").replace("Refresh cadence", "Scan cadence") : section;
      ok(html.includes(alt), `${s.slug}: "${alt}"`);
    }
    if (s.kind === "signal") {
      ok(html.includes("Recent confirmed signals"), `${s.slug}: shows recent signals section`);
      ok(html.includes("Live output of the daily scan"), `${s.slug}: labels live output`);
      ok(!/\b0 alerts\b/.test(html), `${s.slug}: no "0 alerts" label`);
    } else {
      ok(html.includes(`${s.items.length} alert`), `${s.slug}: shows ${s.items.length} alerts`);
      for (const item of s.items.slice(0, 3)) ok(html.includes(item.ticker.replace("^", "^")), `${s.slug}: lists ${item.ticker}`);
    }
    for (const r of s.related) ok(html.includes(`/templates/${r}`), `${s.slug}: links to ${r}`);
  }

  console.log("\nredirects");
  for (const [legacy, target] of Object.entries(LEGACY_TEMPLATE_SLUGS)) {
    const page = await get(`/templates/${legacy}`);
    ok([301, 308].includes(page.status) && (page.headers.get("location") ?? "").endsWith(`/templates/${target}`), `/templates/${legacy} → /templates/${target} (${page.status})`);
    const welcome = await get(`/welcome/${legacy}`);
    ok([301, 308].includes(welcome.status) && (welcome.headers.get("location") ?? "").endsWith(`/welcome/${target}`), `/welcome/${legacy} → /welcome/${target} (${welcome.status})`);
    const api = await get(`/api/templates/${legacy}`);
    const body = await api.json().catch(() => ({}));
    ok(api.status === 200 && body?.data?.slug === target && body?.redirectedFrom === legacy, `/api/templates/${legacy} resolves to ${target}`);
  }
  const missing = await get("/templates/not-a-strategy");
  ok(missing.status === 404, "unknown strategy → 404");

  console.log("\nauth and activation");
  for (const s of STRATEGIES.slice(0, 2)) {
    const welcome = await get(`/welcome/${s.slug}`);
    ok([302, 303, 307].includes(welcome.status) && (welcome.headers.get("location") ?? "").includes("/login?next="), `/welcome/${s.slug} unauthenticated → login (${welcome.status})`);
    const activate = await get(`/api/templates/${s.slug}/activate`, { method: "POST" });
    ok(activate.status === 401, `POST /api/templates/${s.slug}/activate unauthenticated → 401`);
  }
  const login = await get("/login");
  ok(login.status === 200, "GET /login → 200");
  const badEmail = await get("/api/auth/magic-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "not-an-email", source: "login" }) });
  ok(badEmail.status === 400, "POST /api/auth/magic-link rejects an invalid address (400)");
  const list = await get("/api/templates");
  const listBody = await list.json().catch(() => ({}));
  const slugs: string[] = (listBody?.data ?? []).map((t: { slug: string }) => t.slug);
  ok(list.status === 200 && slugs.length === STRATEGIES.length && STRATEGIES.every((s) => slugs.includes(s.slug)), `/api/templates returns the ${STRATEGIES.length} active strategies (got ${slugs.length})`);
  ok((listBody?.data ?? []).every((t: { section?: string }) => t.section), "/api/templates rows carry a section");

  console.log("\nad landing pages");
  for (const slug of LP_SLUGS) {
    const res = await get(`/go/${slug}`);
    const html = await res.text();
    ok(res.status === 200 && html.includes("Illustrative example"), `GET /go/${slug} → 200 with labeled example`);
    ok((res.headers.get("set-cookie") ?? "").includes("fsa_bucket="), `/go/${slug} stamps the split-test bucket cookie`);
    if (slug === "insiders" || slug === "upgrades") ok(html.includes("Latest confirmed signals"), `/go/${slug} shows live signal block`);
  }
  const forced = await get("/go/radar?v=A");
  ok(forced.status === 200, "GET /go/radar?v=A (forced variant) → 200");
  const draftPreview = await get("/go/radar?preview=1");
  ok(draftPreview.status === 200, "GET /go/radar?preview=1 unauthenticated still serves the live page (200)");
  ok((await get("/go/does-not-exist")).status === 404, "GET /go/does-not-exist → 404");
  ok((await get("/go/Bad_Slug")).status === 404, "GET /go/Bad_Slug → 404");
  const beacon = await get("/api/ab/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tag: "nope" }) });
  ok(beacon.status === 204, "POST /api/ab/view with a bogus tag → 204");
  const homeRes = await get("/");
  ok(homeRes.status === 200 && (homeRes.headers.get("set-cookie") ?? "").includes("fsa_bucket="), "GET / → 200 and stamps the bucket cookie");
  ok((await get("/api/admin/pages")).status === 403, "GET /api/admin/pages unauthenticated → 403");
  const scan = await get("/api/strategies/scan?dryRun=1", { headers: { authorization: "Bearer definitely-wrong" } });
  ok(scan.status === 401 || scan.status === 200, `/api/strategies/scan responds (${scan.status}; 401 when CRON_SECRET is set)`);

  console.log("\npublic forms");
  for (const p of ["/advertise", "/do-not-sell"]) {
    const res = await get(p);
    const html = unescape(await res.text());
    ok(res.status === 200, `GET ${p} → 200`);
    ok(new RegExp(`<link rel="canonical" href="[^"]*${p}"`).test(html), `${p}: canonical`);
  }
  ok(unescape(await (await get("/advertise")).text()).includes("Request rates & media kit"), "/advertise has the inquiry form");
  ok(unescape(await (await get("/do-not-sell")).text()).includes("Opt-Out Request Form"), "/do-not-sell has the request form");
  const badInquiry = await get("/api/advertiser-inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "", email: "x", company: "" }) });
  ok(badInquiry.status === 400, "POST /api/advertiser-inquiry rejects an empty inquiry (400)");
  const botInquiry = await get("/api/advertiser-inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fax: "1", name: "Bot", email: "bot@example.com", company: "Bots" }) });
  ok(botInquiry.status === 200, "POST /api/advertiser-inquiry honeypot is a silent accept (200)");
  const badPrivacy = await get("/api/privacy-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "", lastName: "", email: "" }) });
  ok(badPrivacy.status === 400, "POST /api/privacy-request rejects an empty request (400)");
  const footer = unescape(await (await get("/templates")).text());
  ok(footer.includes('href="/advertise"') && footer.includes('href="/do-not-sell"'), "footer links to /advertise and /do-not-sell");

  console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
