/**
 * From an article and two copied ads to a Beehiiv Create Post body. Native
 * blocks for the article so it stays editable in the Beehiiv editor; `html`
 * blocks only for the ads, which must land pixel-identical to the source.
 * `renderMode: "html"` is the escape hatch: one `body_content` document.
 */
import type { BeehiivBlock, CreatePostBody } from "@/lib/beehiiv/client";
import { escapeHtml } from "@/lib/ads/template";
import type { Article } from "./article";
import type { IssueKind, Slot } from "./config";
import { longDate, toMMDDYYYY, type DateKey } from "./dates";

export type RenderMode = "blocks" | "html";

export interface RenderInput {
  dateKey: DateKey;
  slot: Slot;
  kind: IssueKind;
  article: Article;
  /** Set when the compliance check failed twice; the draft carries an editor note. */
  reviewReason: string | null;
  ads: {
    /** Sanitized HTML of the source issue's slot #1 and #2 ads, or null when missing. */
    first: string | null;
    second: string | null;
    /** The Smart Investor issue date the ads came from. */
    tsiDateKey: DateKey;
  };
  renderMode?: RenderMode;
}

const INTRO: Record<IssueKind, (dateKey: DateKey) => string> = {
  morning: (d) => `Good morning. Here is what to watch before the bell on ${longDate(d)}.`,
  closing: (d) => `The closing bell has rung on ${longDate(d)}. Here are the five stories that mattered, and why.`,
};

export const FOOTER_DISCLAIMER =
  "FreeStockAlerts.AI is for informational and educational purposes only and is not investment, financial, or legal advice. This issue summarizes market data and third-party reporting; we do not recommend buying or selling any security. Investing involves risk, including the possible loss of principal. Past performance does not guarantee future results. Sponsored messages are paid placements from third parties; we do not endorse and are not responsible for their content.";

export const editorNote = (reason: string) => `EDITOR NOTE (delete before sending): the automated check flagged this issue: ${reason}. Review the text before sending.`;

export const adPlaceholderText = (position: 1 | 2, tsiDateKey: DateKey) =>
  `[AD SLOT ${position}: no Smart Investor ad found for ${toMMDDYYYY(tsiDateKey)}. Paste one here or delete this line.]`;

const FONT = "Georgia, 'Times New Roman', serif";

/** "Sources: Reuters, CNBC" as one inline-styled line with links. */
export function sourcesHtml(sources: Article["sources"]): string {
  const links = sources.map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" style="color:#0F8075; text-decoration:underline;">${escapeHtml(s.outlet)}</a>`).join(", ");
  return `<p style="margin:0; font-family:Helvetica, Arial, sans-serif; font-size:13px; line-height:20px; color:#5B6B7F;">Sources: ${links}</p>`;
}

/** The post body as Beehiiv blocks, in send order. */
export function buildBlocks(input: RenderInput): BeehiivBlock[] {
  const { article, ads } = input;
  const blocks: BeehiivBlock[] = [];
  if (input.reviewReason) blocks.push({ type: "paragraph", formattedText: [{ text: editorNote(input.reviewReason), styling: ["bold"], text_color: "#B91C1C" }] });
  blocks.push({ type: "paragraph", plaintext: INTRO[input.kind](input.dateKey) });
  blocks.push(ads.first ? { type: "html", html: ads.first } : { type: "paragraph", formattedText: [{ text: adPlaceholderText(1, ads.tsiDateKey), styling: ["italic"], text_color: "#B91C1C" }] });
  blocks.push({ type: "heading", level: 1, text: article.headline, anchorHeader: false, anchorIncludeInToc: false });
  if (article.subtitle) blocks.push({ type: "paragraph", formattedText: [{ text: article.subtitle, styling: ["italic"] }] });
  for (const p of article.paragraphs) {
    const m = /^(\d{1,2}[.)])\s+(.+)$/.exec(p);
    // Numbered items (the morning brief) get a bold number so the list scans.
    blocks.push(m ? { type: "paragraph", formattedText: [{ text: `${m[1]} `, styling: ["bold"] }, { text: m[2] }] } : { type: "paragraph", plaintext: p });
  }
  if (article.sources.length) blocks.push({ type: "html", html: sourcesHtml(article.sources) });
  blocks.push(ads.second ? { type: "html", html: ads.second } : { type: "paragraph", formattedText: [{ text: adPlaceholderText(2, ads.tsiDateKey), styling: ["italic"], text_color: "#B91C1C" }] });
  blocks.push({ type: "paragraph", formattedText: [{ text: FOOTER_DISCLAIMER, text_color: "#5B6B7F" }] });
  return blocks;
}

const para = (text: string, style = "") => `<p style="margin:0 0 18px 0; font-family:${FONT}; font-size:17px; line-height:27px; color:#071B3C;${style}">${escapeHtml(text)}</p>`;

/** Same content as inline-styled HTML: the `html` render mode and the local preview. */
export function blocksToHtml(blocks: BeehiivBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "html") parts.push(`<div style="margin:0 0 22px 0;">${b.html}</div>`);
    else if (b.type === "heading") parts.push(`<h${b.level} style="margin:0 0 14px 0; font-family:${FONT}; font-size:${b.level === 1 ? 28 : 23}px; line-height:1.25; color:#071B3C;">${escapeHtml(b.text ?? b.formattedText?.map((t) => t.text).join("") ?? "")}</h${b.level}>`);
    else if (b.type === "button") parts.push(`<p style="margin:0 0 18px 0;"><a href="${escapeHtml(b.href)}" style="display:inline-block; background:#0F8075; color:#ffffff; padding:11px 22px; text-decoration:none; font-family:Helvetica, Arial, sans-serif; font-weight:bold;">${escapeHtml(b.text)}</a></p>`);
    else if (b.plaintext !== undefined) parts.push(para(b.plaintext));
    else {
      const runs = (b.formattedText ?? [])
        .map((t) => {
          let s = escapeHtml(t.text);
          if (t.styling?.includes("bold")) s = `<strong>${s}</strong>`;
          if (t.styling?.includes("italic")) s = `<em>${s}</em>`;
          if (t.text_color) s = `<span style="color:${t.text_color};">${s}</span>`;
          if (t.link) s = `<a href="${escapeHtml(t.link.href)}" style="color:#0F8075;">${s}</a>`;
          return s;
        })
        .join("");
      parts.push(`<p style="margin:0 0 18px 0; font-family:${FONT}; font-size:17px; line-height:27px; color:#071B3C;">${runs}</p>`);
    }
  }
  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="width:100%; max-width:600px; margin:0 auto; background-color:#ffffff;"><tr><td style="padding:0 0 18px 0;">\n${parts.join("\n")}\n</td></tr></table>`;
}

/** A full standalone page for the --dry preview files. */
export const previewDocument = (title: string, bodyHtml: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0; padding:24px; background:#FBFAF6;">${bodyHtml}</body></html>`;

export const draftTitle = (input: Pick<RenderInput, "article" | "reviewReason">) => `${input.reviewReason ? "[REVIEW] " : ""}${input.article.headline}`;

export function buildCreatePostBody(input: RenderInput): CreatePostBody {
  const blocks = buildBlocks(input);
  const mode = input.renderMode ?? "blocks";
  return {
    title: draftTitle(input),
    subtitle: input.article.subtitle || undefined,
    status: "draft",
    ...(mode === "blocks" ? { blocks } : { body_content: blocksToHtml(blocks) }),
    email_settings: {
      email_subject_line: input.article.subjectLine || input.article.headline,
      email_preview_text: input.article.previewText || input.article.subtitle || undefined,
      display_subtitle_in_email: false,
    },
    content_tags: [input.kind === "morning" ? "morning-brief" : "closing-recap"],
  };
}
