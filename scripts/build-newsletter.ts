/**
 * The daily newsletter pipeline from the command line.
 *
 *   set -a; source .env.local; set +a
 *   npm run newsletter:build -- --spike             # fetch yesterday's Smart Investor posts, report what the extractor sees,
 *                                                   #   create ONE throwaway FSA draft with an extracted ad (delete it in Beehiiv)
 *   npm run newsletter:build -- --dry [--date YYYY-MM-DD] [--slot 1|2]
 *                                                   # full pipeline (FMP + Claude), no Beehiiv write; previews in .newsletter-out/<date>/
 *   npm run newsletter:build -- --live [--force] [--date ...] [--slot ...]
 *                                                   # creates the drafts, records the rows, no report email
 *   npm run newsletter:build -- --html              # use one body_content HTML document instead of blocks
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createPost, listPosts } from "../lib/beehiiv/client";
import { publicationByKey } from "../lib/beehiiv/config";
import { buildDailyIssues } from "../lib/newsletter/build";
import { NEWSLETTER, type Slot } from "../lib/newsletter/config";
import { isDateKey, pacificDateKey, yesterdayPacific } from "../lib/newsletter/dates";
import { blocksToHtml, previewDocument } from "../lib/newsletter/render";
import { collectTsiAds, extractTsiAds, isTrackingWrapped, parseTsiTitle } from "../lib/newsletter/tsiAds";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (name: string) => process.argv.includes(name);

async function spike() {
  const si = publicationByKey("si")!;
  const fsa = publicationByKey("fsa")!;
  const yesterday = arg("--date") ?? yesterdayPacific(new Date());
  console.log(`Fetching The Smart Investor posts (looking for ${yesterday})…`);
  const page = await listPosts(si.id, { limit: 30, status: "confirmed", expand: ["stats", "free_email_content", "free_web_content"] });
  const outDir = join(process.cwd(), ".newsletter-out", "spike");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "si-posts.json"), JSON.stringify(page.data, null, 2));
  console.log(`${page.data.length} posts saved to ${outDir}/si-posts.json`);
  for (const p of page.data.slice(0, 12)) {
    const t = parseTsiTitle(p.title);
    const email = p.content?.free?.email ?? "";
    const web = p.content?.free?.web ?? "";
    const ads = email ? extractTsiAds(email) : [];
    console.log(
      `- ${p.id} "${p.title}" → ${t ? `${t.dateKey} ${t.kind} #${t.number}` : "not a campaign title"} | email ${email.length}B web ${web.length}B | ad tables ${ads.length}${ads.length ? ` (links ${ads.map((a) => a.linkCount).join("/")}, empty ${ads.filter((a) => a.empty).length}, house ${ads.filter((a) => a.isHouseAd).length})` : ""} | style tags ${(email.match(/<style/gi) ?? []).length} | tracking links ${isTrackingWrapped(email) ? "YES" : "no"} | web_url ${p.web_url ?? "-"}`
    );
  }
  const collected = collectTsiAds(page.data, yesterday);
  for (const w of collected.warnings) console.log(`warning: ${w}`);
  const sample = [...collected.bySlot.values()].flatMap((s) => s.ads)[0];
  for (const [n, s] of collected.bySlot) {
    s.ads.forEach((a, i) => writeFileSync(join(outDir, `si-${yesterday}-${n}-ad${i + 1}.html`), previewDocument(`ad ${i + 1}`, a.html)));
  }
  if (!sample) {
    console.log("No sponsor block extracted; nothing to push. Inspect si-posts.json and adjust extractTsiAds before going further.");
    return;
  }
  if (has("--no-draft")) return;
  console.log("Creating one throwaway FreeStockAlerts draft with the first extracted ad…");
  const created = await createPost(fsa.id, {
    title: `[SPIKE ${pacificDateKey(new Date())}] delete me`,
    status: "draft",
    blocks: [
      { type: "paragraph", plaintext: "Spike: a native paragraph block above a copied Smart Investor ad. Delete this draft." },
      { type: "html", html: sample.html },
      { type: "heading", level: 1, text: "A native heading block", anchorHeader: false, anchorIncludeInToc: false },
      { type: "paragraph", plaintext: "If the ad above looks like it did in The Smart Investor, the extractor and the html block path are good." },
    ],
    email_settings: { email_subject_line: "spike subject", email_preview_text: "spike preview" },
  });
  console.log(`Draft created: id=${created.id} preview=${created.previewUrl ?? "-"} edit=https://app.beehiiv.com/posts/${created.id}/edit`);
}

async function run(mode: "dry" | "live") {
  const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  console.log(`database: ${(process.env.DATABASE_URL ?? "").replace(/:\/\/.*@/, "://***@")}`);
  const date = arg("--date");
  if (date && !isDateKey(date)) throw new Error("--date must be YYYY-MM-DD");
  const slotArg = arg("--slot");
  const slots = slotArg ? ([Number(slotArg)] as Slot[]) : undefined;
  if (slots && !NEWSLETTER.slots.includes(slots[0])) throw new Error("--slot must be 1 or 2");
  const result = await buildDailyIssues({ dateKey: date, slots, force: has("--force") }, { db, dry: mode === "dry", renderMode: has("--html") ? "html" : "blocks", log: (m) => console.log(`  ${m}`) });
  const outDir = join(process.cwd(), ".newsletter-out", result.dateKey);
  mkdirSync(outDir, { recursive: true });
  for (const s of result.slots) {
    const { body, ...rest } = s;
    writeFileSync(join(outDir, `slot-${s.slot}.json`), JSON.stringify({ ...rest, body }, null, 2));
    if (body) {
      const html = body.blocks ? blocksToHtml(body.blocks) : body.body_content ?? "";
      writeFileSync(join(outDir, `slot-${s.slot}.preview.html`), previewDocument(body.title, html));
    }
  }
  console.log(JSON.stringify({ ...result, slots: result.slots.map(({ body: _b, ...s }) => s) }, null, 2));
  console.log(`previews in ${outDir}`);
  await db.$disconnect();
}

async function main() {
  if (has("--spike")) return spike();
  if (has("--live")) return run("live");
  return run("dry");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
