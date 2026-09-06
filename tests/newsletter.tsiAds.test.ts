/** Smart Investor title parsing, post picking, and ad-slot extraction. Pure. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { advertiserLabel, collectTsiAds, extractTsiAds, isHouseAd, isTrackingWrapped, parseTsiTitle, pickTsiPostsForDate, sanitizeAdHtml } from "../lib/newsletter/tsiAds";
import type { BeehiivPost } from "../lib/beehiiv/client";

const STYLE_BLOCK = `<style>
          .msg-body p { margin: 18px 0; line-height: 1.5; }
          .msg-body p:first-child { margin-top: 0; }
        </style>`;

/** Ad slot #1 as the Hermes template renders it: wrapper table, msg-body cell, a nested inner table. */
const AD1 = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #E5E0D5; background-color:#FAF8F3;">
  <tbody>
  <tr>
    <td class="msg-body" style="padding:20px 22px 24px 22px;">
        ${STYLE_BLOCK}
      <p style="margin:0 0 14px 0; font-family:Helvetica, Arial, sans-serif; font-size:12px; color:#333333; text-align:center;"><em>A Message from MarketBeat Media, LLC.</em></p>
      <p style="margin:0 0 12px 0; font-family:Georgia, 'Times New Roman', serif; font-size:16px; line-height:25px; color:#333333;">Dear Investor,</p>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" align="left">
      <tbody><tr><td><img src="https://cdn.example.com/hero.jpg?a=1&b=2" width="200" alt="" style="display:block; width:100%; max-width:200px; height:auto; border:0;"></td></tr></tbody>
      </table>
      <p style="margin:0;"><a href="https://track.example.com/go?cid=123&v=7" style="color:#1F3352;">Read the full story</a></p>
    </td>
  </tr>
  </tbody>
  </table>`;

const AD2 = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #E5E0D5; background-color:#FAF8F3;">
  <tbody>
  <tr>
    <td class="msg-body" style="padding:18px 22px;">
        ${STYLE_BLOCK}
      <p style="margin:0 0 10px 0; font-family:Helvetica, Arial, sans-serif; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#999999;">Sponsored</p>
      <p style="margin:0 0 12px 0; font-family:Georgia, 'Times New Roman', serif; font-size:17px; line-height:26px; color:#333333;"><strong>Sponsor headline.</strong> One sentence of copy.</p>
      <p style="margin:0;"><a href="https://sponsor.example.com/offer" style="display:inline-block; background-color:#1F3352; color:#ffffff;">LEARN MORE &rarr;</a></p>
    </td>
  </tr>
  </tbody>
  </table>`;

const EMPTY_AD = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #E5E0D5; background-color:#FAF8F3;"><tbody><tr><td class="msg-body" style="padding:18px 22px;">${STYLE_BLOCK}
<!-- ===== AD #2 PLACEHOLDER — PASTE YOUR SHORT SPONSOR HTML BLOCK HERE ===== -->
</td></tr></tbody></table>`;

const HOUSE_AD = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #E5E0D5; background-color:#FAF8F3;"><tbody><tr><td><a href="https://www.freestockalerts.ai/api/ads/click/abc?c=si&amp;s=sub_1">Our own snippet</a></td></tr></tbody></table>`;

const issue = (ad1: string, ad2: string) => `<table width="100%" role="presentation" style="width:100%; max-width:600px;"><tbody>
<!-- ===================== 2. HEADLINE ===================== -->
<tr><td style="padding:0 24px;"><h1>Headline</h1><p>Good morning, investor.</p></td></tr>
<!-- ===================== 3. AD SLOT #1 (FULL / SPONSOR FORMAT) ===================== -->
<tr><td style="padding:0 24px 28px 24px;">${ad1}</td></tr>
<tr><td><table width="100%" style="background-color:#F4F1E8; border-top:1px solid #E2DCCB;"><tr><td>Key points panel, not an ad</td></tr></table><p>Article body.</p></td></tr>
<!-- ===================== 5. AD SLOT #2 (SHORT FORMAT) ===================== -->
<tr><td style="padding:0 24px 28px 24px;">${ad2}</td></tr>
</tbody></table>`;

const post = (id: string, title: string, email?: string, web?: string): BeehiivPost => ({ id, title, status: "confirmed", publish_date: 1_757_000_000, content: { free: { email, web } } });

test("parseTsiTitle handles newsletter, dedicated, multi-advertiser and non-campaign titles", () => {
  assert.deepEqual(parseTsiTitle("09/05/2026 - #1 - Investors Alley (New Freedom / 1946)"), { dateKey: "2026-09-05", kind: "newsletter", number: 1, advertisers: [{ name: "Investors Alley", creative: "New Freedom / 1946" }] });
  const two = parseTsiTitle("08/16/2026 - #2 - Investpub (Day Trader Cheat Sheet / V11) & Millionaire Pub (Tim Sykes' / Weekend Trader / V42)");
  assert.equal(two?.number, 2);
  assert.equal(two?.advertisers.length, 2);
  assert.equal(advertiserLabel(two!), "Investpub (Day Trader Cheat Sheet / V11) & Millionaire Pub (Tim Sykes' / Weekend Trader / V42)");
  assert.equal(parseTsiTitle("08/18/2026 - Dedicated 1 - Wyatt (Quantum / V3)")?.kind, "dedicated");
  assert.equal(parseTsiTitle("08/22/2026 - Dedicated #1 - Priority Gold (Trump Gold Reset / 458)")?.number, 1);
  assert.deepEqual(parseTsiTitle("9/5/2026 - #1 - Wyatt")?.advertisers, [{ name: "Wyatt", creative: null }]);
  assert.equal(parseTsiTitle("The Smart Investor - HD (Home Depot): The Retailer's Quiet Barbell Bet"), null);
  assert.equal(parseTsiTitle("13/40/2026 - #1 - X"), null);
  assert.equal(parseTsiTitle(""), null);
  assert.equal(parseTsiTitle(undefined), null);
});

test("pickTsiPostsForDate uses the title date, ignores dedicated sends and other days, first match wins", () => {
  const posts = [
    post("d1", "09/05/2026 - Dedicated 1 - Wyatt (Gold / V3)"),
    post("n2", "09/05/2026 - #2 - Sponsor B (Creative)"),
    post("n1b", "09/05/2026 - #1 - Sponsor A (later duplicate)"),
    post("n1", "09/05/2026 - #1 - Sponsor A (Creative)"),
    post("old", "09/04/2026 - #1 - Sponsor Z (Creative)"),
    post("art", "Home Depot: The Retailer's Quiet Barbell Bet"),
  ];
  const picked = pickTsiPostsForDate(posts, "2026-09-05");
  assert.equal(picked.get(1)?.id, "n1b", "document order wins; Beehiiv lists newest first so the caller gets the latest re-send");
  assert.equal(picked.get(2)?.id, "n2");
  assert.equal(pickTsiPostsForDate(posts, "2026-09-06").size, 0);
});

test("extractTsiAds finds both wrapper tables with nested tables intact and skips the key-points panel", () => {
  const ads = extractTsiAds(issue(AD1, AD2));
  assert.equal(ads.length, 2);
  assert.equal(ads[0].index, 1);
  assert.match(ads[0].html, /MarketBeat Media/);
  assert.match(ads[0].html, /<table width="100%" border="0" cellspacing="0" cellpadding="0" align="left">/, "nested table kept");
  assert.equal((ads[0].html.match(/<table\b/gi) ?? []).length, 2);
  assert.equal((ads[0].html.match(/<\/table>/gi) ?? []).length, 2);
  assert.match(ads[1].html, /Sponsor headline/);
  assert.doesNotMatch(ads[0].html + ads[1].html, /<style/i, "style blocks stripped");
  assert.doesNotMatch(ads[0].html, /class="msg-body"/);
  assert.doesNotMatch(ads[0].html + ads[1].html, /Key points/);
  assert.equal(ads[0].linkCount, 1);
  assert.equal(ads[0].isHouseAd, false);
  assert.equal(ads[0].empty, false);
});

test("sanitizeAdHtml escapes bare ampersands in URLs only, and leaves entities alone", () => {
  const ads = extractTsiAds(issue(AD1, AD2));
  assert.match(ads[0].html, /href="https:\/\/track\.example\.com\/go\?cid=123&amp;v=7"/);
  assert.match(ads[0].html, /src="https:\/\/cdn\.example\.com\/hero\.jpg\?a=1&amp;b=2"/);
  assert.match(ads[1].html, /LEARN MORE &rarr;/, "text entities untouched");
  assert.equal(sanitizeAdHtml(`<a href="https://x.co/?a=1&amp;b=2&c=3">x</a>`), `<a href="https://x.co/?a=1&amp;b=2&amp;c=3">x</a>`);
  assert.equal(sanitizeAdHtml(`<!-- c --><p class="msg-body">hi</p>`), `<p>hi</p>`);
});

test("empty placeholder wrappers and house snippets are flagged so the caller can skip them", () => {
  const ads = extractTsiAds(issue(HOUSE_AD, EMPTY_AD));
  assert.equal(ads.length, 2);
  assert.equal(ads[0].isHouseAd, true);
  assert.equal(ads[1].empty, true);
  assert.equal(isHouseAd("<a href='/api/ads/click/x'>"), true);
  assert.equal(isHouseAd(AD2), false);
});

test("isTrackingWrapped spots Beehiiv redirect links", () => {
  assert.equal(isTrackingWrapped(`<a href="https://link.mail.beehiiv.com/ss/c/u001.abc">x</a>`), true);
  assert.equal(isTrackingWrapped(`<a href="https://mail.example.com/ss/c/abc">x</a>`), true);
  assert.equal(isTrackingWrapped(AD2), false);
});

test("collectTsiAds maps issue #1 and #2 to slots, prefers clean email HTML, falls back to web, and warns", () => {
  const wrapped = issue(AD1, AD2).replace(/https:\/\/sponsor\.example\.com\/offer/g, "https://link.mail.beehiiv.com/ss/c/u001.xyz");
  const posts = [
    post("n1", "09/05/2026 - #1 - Sponsor A (Creative)", issue(AD1, AD2)),
    post("n2", "09/05/2026 - #2 - Sponsor B (Creative)", wrapped, issue(HOUSE_AD, AD2)),
    post("d1", "09/05/2026 - Dedicated 1 - Wyatt (Gold / V3)", AD1),
  ];
  const r = collectTsiAds(posts, "2026-09-05");
  assert.equal(r.bySlot.get(1)?.ads.length, 2);
  assert.equal(r.bySlot.get(1)?.contentSource, "email");
  assert.equal(r.bySlot.get(2)?.contentSource, "web");
  assert.equal(r.bySlot.get(2)?.ads.length, 1, "house ad skipped, one sponsor block left");
  assert.equal(r.bySlot.get(1)?.title.advertisers[0].name, "Sponsor A");
  assert.ok(r.warnings.some((w) => /tracking links/.test(w)));
  assert.ok(r.warnings.some((w) => /house ad/.test(w)));
  assert.ok(r.warnings.some((w) => /found 1 of 2/.test(w)));

  const none = collectTsiAds(posts, "2026-09-06");
  assert.equal(none.bySlot.size, 0);
  assert.equal(none.warnings.length, 2);
  const noContent = collectTsiAds([post("n1", "09/05/2026 - #1 - A (B)")], "2026-09-05");
  assert.equal(noContent.bySlot.get(1)?.contentSource, "none");
  assert.ok(noContent.warnings.some((w) => /no content returned/.test(w)));
});
