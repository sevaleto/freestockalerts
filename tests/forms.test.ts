import { test } from "node:test";
import assert from "node:assert/strict";
import { advertiserRecipients, parseAdvertiserInquiry, renderInquiryEmail } from "../lib/forms/advertiserInquiry";
import { parsePrivacyRequest, privacyAlertRecipients, renderPrivacyAlert } from "../lib/forms/privacyRequest";
import { escapeHtml, hashIp, addressList } from "../lib/forms/shared";

test("advertiser inquiry: required fields, normalization, and limits", () => {
  const bad = parseAdvertiserInquiry({ name: "  ", email: "nope", company: "" });
  assert.equal(bad.ok, false);
  assert.match((bad as { error: string }).error, /your name, a company name, a valid work email address/);
  const good = parseAdvertiserInquiry({ name: " Jane Doe ", email: "Jane@Example.com ", company: "Acme", website: "https://acme.test", phone: "", message: "x".repeat(3000), fax: "" });
  assert.equal(good.ok, true);
  const data = (good as unknown as { data: Record<string, unknown> }).data;
  assert.equal(data.name, "Jane Doe");
  assert.equal(data.email, "jane@example.com");
  assert.equal(data.phone, null);
  assert.equal((data.message as string).length, 2000);
  assert.equal(parseAdvertiserInquiry({ name: 42, email: ["a@b.co"], company: {} }).ok, false, "non-string values are not trusted");
});

test("advertiser inquiry: a filled honeypot is a silent accept", () => {
  const r = parseAdvertiserInquiry({ fax: "555-0100", name: "Bot", email: "bot@example.com", company: "Bots Inc" });
  assert.deepEqual(r, { ok: true, honeypot: true });
});

test("privacy request: required fields, agent flag, optional address, honeypot", () => {
  const bad = parsePrivacyRequest({ firstName: "", lastName: "", email: "x" });
  assert.equal(bad.ok, false);
  assert.match((bad as { error: string }).error, /first name, last name, a valid email address/);
  const good = parsePrivacyRequest({ firstName: "Jane", lastName: "Doe", email: "JANE@example.com", requesterType: "agent", zip: "90245", country: "United States of America (the)" });
  assert.equal(good.ok, true);
  const data = (good as unknown as { data: Record<string, unknown> }).data;
  assert.equal(data.requesterType, "agent");
  assert.equal(data.phone, "", "phone stays a string because the column is non-null");
  assert.equal(data.street, null);
  assert.equal(data.zip, "90245");
  assert.equal(parsePrivacyRequest({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", requesterType: "hacker" }).ok && (parsePrivacyRequest({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", requesterType: "hacker" }) as { data: { requesterType: string } }).data.requesterType, "consumer");
  assert.deepEqual(parsePrivacyRequest({ company: "Bots Inc", firstName: "Bot", lastName: "Bot", email: "bot@example.com" }), { ok: true, honeypot: true });
});

test("notification emails escape untrusted text and carry every field", () => {
  const inquiry = renderInquiryEmail({ id: "abc", name: "<b>Jane</b>", email: "jane@example.com", company: "Acme & Co", website: null, phone: null, message: "line1\nline2", receivedAt: new Date("2026-09-05T20:00:00Z") });
  assert.equal(inquiry.subject, "New advertiser inquiry — Acme & Co");
  assert.ok(inquiry.html.includes("&lt;b&gt;Jane&lt;/b&gt;"));
  assert.ok(!inquiry.html.includes("<b>Jane</b>"));
  assert.ok(inquiry.html.includes("line1<br>line2"));
  assert.ok(inquiry.text.includes("Website: (not provided)"));
  const alert = renderPrivacyAlert({ id: "def", requesterType: "agent", firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "", street: "1 Main St", city: "Long Beach", state: "CA", zip: "90802", country: "United States of America (the)", details: null, receivedAt: new Date("2026-09-05T20:00:00Z") });
  assert.equal(alert.subject, "Do Not Sell request — Jane Doe");
  assert.ok(alert.text.includes("Filed by: Consumer's Authorized Agent"));
  assert.ok(alert.text.includes("Address: 1 Main St, Long Beach, CA, 90802, United States of America (the)"));
  assert.ok(alert.text.includes("45 days"));
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("recipients default to staff and accept env overrides; IP is stored hashed", () => {
  const saved = { to: process.env.ADVERTISER_INQUIRY_TO, bcc: process.env.ADVERTISER_INQUIRY_BCC, privacy: process.env.PRIVACY_ALERT_EMAILS };
  delete process.env.ADVERTISER_INQUIRY_TO;
  delete process.env.ADVERTISER_INQUIRY_BCC;
  delete process.env.PRIVACY_ALERT_EMAILS;
  assert.deepEqual(advertiserRecipients(), { to: ["chelsie@trading-tips.us"], bcc: ["manuel@tradingtips.com"] });
  assert.deepEqual(privacyAlertRecipients(), ["manuel@tradingtips.com", "chelsie@trading-tips.us", "nicole@trading-tips.us"]);
  process.env.ADVERTISER_INQUIRY_TO = "sales@example.com, not-an-email";
  process.env.PRIVACY_ALERT_EMAILS = "privacy@example.com";
  assert.deepEqual(advertiserRecipients().to, ["sales@example.com"]);
  assert.deepEqual(privacyAlertRecipients(), ["privacy@example.com"]);
  assert.deepEqual(addressList(" a@b.co ,,bad, c@d.org"), ["a@b.co", "c@d.org"]);
  process.env.ADVERTISER_INQUIRY_TO = saved.to;
  process.env.ADVERTISER_INQUIRY_BCC = saved.bcc;
  process.env.PRIVACY_ALERT_EMAILS = saved.privacy;
  if (saved.to === undefined) delete process.env.ADVERTISER_INQUIRY_TO;
  if (saved.bcc === undefined) delete process.env.ADVERTISER_INQUIRY_BCC;
  if (saved.privacy === undefined) delete process.env.PRIVACY_ALERT_EMAILS;
  assert.match(hashIp("203.0.113.5"), /^[0-9a-f]{64}$/);
  assert.notEqual(hashIp("203.0.113.5"), "203.0.113.5");
});
