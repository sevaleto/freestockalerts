/** Beehiiv block assembly for a draft. Pure. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { adPlaceholderText, blocksToHtml, buildBlocks, buildCreatePostBody, FOOTER_DISCLAIMER, type RenderInput } from "../lib/newsletter/render";

const article = {
  headline: "Nvidia Clears the Bar Again",
  subtitle: "Another record quarter.",
  subjectLine: "Nvidia beat again",
  previewText: "Record revenue and a China-shaped hole.",
  paragraphs: ["Para one about Nvidia.", "Para two, Reuters said.", "Para three, per CNBC."],
  sources: [
    { outlet: "Reuters", url: "https://www.reuters.com/a?x=1&y=2" },
    { outlet: "CNBC", url: "https://www.cnbc.com/b" },
  ],
};
const AD = `<table style="border:1px solid #E5E0D5; background-color:#FAF8F3;"><tr><td>Sponsor</td></tr></table>`;
const base: RenderInput = { dateKey: "2026-09-08", slot: 1, kind: "morning", article, reviewReason: null, ads: { first: AD, second: `${AD}<!-- 2 -->`, tsiDateKey: "2026-09-07" } };

test("blocks come in send order: intro, ad 1, heading, deck, paragraphs, sources, ad 2, disclaimer", () => {
  const blocks = buildBlocks(base);
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["paragraph", "html", "heading", "paragraph", "paragraph", "paragraph", "paragraph", "html", "html", "paragraph"]
  );
  assert.equal(blocks[1].type === "html" && blocks[1].html, AD);
  assert.equal(blocks[2].type === "heading" && blocks[2].text, article.headline);
  const sources = blocks[7];
  assert.ok(sources.type === "html" && /Sources: <a href="https:\/\/www\.reuters\.com\/a\?x=1&amp;y=2"/.test(sources.html));
  const footer = blocks[9];
  assert.ok(footer.type === "paragraph" && footer.formattedText?.[0].text === FOOTER_DISCLAIMER);
  assert.match(FOOTER_DISCLAIMER, /Past performance does not guarantee future results/);
  assert.match(FOOTER_DISCLAIMER, /not investment/);
  assert.match(FOOTER_DISCLAIMER, /Sponsored messages are paid placements/);
  assert.ok(blocks.every((b) => b.type !== "html" || !/<style/i.test(b.html)));
});

test("missing ads become visible placeholders naming the Smart Investor date; nothing is borrowed", () => {
  const blocks = buildBlocks({ ...base, ads: { first: null, second: null, tsiDateKey: "2026-09-07" } });
  assert.equal(blocks.filter((b) => b.type === "html").length, 1, "only the sources line is html");
  const texts = blocks.flatMap((b) => (b.type === "paragraph" ? b.formattedText?.map((t) => t.text) ?? [] : []));
  assert.ok(texts.includes(adPlaceholderText(1, "2026-09-07")));
  assert.ok(texts.includes(adPlaceholderText(2, "2026-09-07")));
  assert.match(adPlaceholderText(1, "2026-09-07"), /09\/07\/2026/);
});

test("review reason prefixes the title and prepends an editor note", () => {
  const body = buildCreatePostBody({ ...base, reviewReason: "banned phrase \"secret\"" });
  assert.equal(body.title, "[REVIEW] Nvidia Clears the Bar Again");
  const first = body.blocks![0];
  assert.ok(first.type === "paragraph" && /EDITOR NOTE.*banned phrase/.test(first.formattedText![0].text));
  assert.equal(buildCreatePostBody(base).title, "Nvidia Clears the Bar Again");
});

test("create body is a draft with subject, preview, tags; html mode uses body_content only", () => {
  const body = buildCreatePostBody(base);
  assert.equal(body.status, "draft");
  assert.equal(body.email_settings?.email_subject_line, "Nvidia beat again");
  assert.equal(body.email_settings?.email_preview_text, article.previewText);
  assert.deepEqual(body.content_tags, ["morning-brief"]);
  assert.deepEqual(buildCreatePostBody({ ...base, slot: 2, kind: "closing" }).content_tags, ["closing-recap"]);
  assert.ok(body.blocks && !body.body_content);
  const html = buildCreatePostBody({ ...base, renderMode: "html" });
  assert.ok(!html.blocks && html.body_content);
  assert.match(html.body_content!, /max-width:600px/);
  assert.doesNotMatch(html.body_content!, /(?<!max-)width:600px/);
  assert.match(html.body_content!, /<h1[^>]*>Nvidia Clears the Bar Again<\/h1>/);
  assert.match(html.body_content!, /Para one about Nvidia\./);
  assert.match(blocksToHtml(buildBlocks({ ...base, reviewReason: "x" })), /<strong>.*EDITOR NOTE/);
});

test("each kind gets its own dated intro line, and numbered items get a bold number", () => {
  const b1 = buildBlocks(base)[0];
  const b2 = buildBlocks({ ...base, slot: 2, kind: "closing" })[0];
  assert.ok(b1.type === "paragraph" && b2.type === "paragraph" && b1.plaintext !== b2.plaintext);
  assert.match((b1 as { plaintext: string }).plaintext, /before the bell on Tuesday, September 8/);
  assert.match((b2 as { plaintext: string }).plaintext, /closing bell has rung on Tuesday, September 8/);
  const numbered = buildBlocks({ ...base, article: { ...article, paragraphs: ["1. First item about Nvidia.", "2. Second item."] } });
  const first = numbered[4]; // intro, ad 1, heading, deck, then the first item
  assert.ok(first.type === "paragraph" && first.formattedText?.[0].text === "1. " && first.formattedText[0].styling?.includes("bold") && first.formattedText[1].text === "First item about Nvidia.");
});
