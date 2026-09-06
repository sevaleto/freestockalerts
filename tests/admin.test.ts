/** The admin email gate shared by /admin pages and /api/admin routes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { adminEmails, isAdminEmail } from "../lib/auth/admin";

const withEnv = (v: string | undefined, fn: () => void) => {
  const prev = process.env.ADMIN_EMAILS;
  if (v === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = v;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  }
};

test("adminEmails uses the defaults only when nothing usable is configured", () => {
  withEnv(undefined, () => assert.ok(adminEmails().includes("sevaleto@gmail.com")));
  withEnv(" A@B.com , ,c@d.com ", () => assert.deepEqual(adminEmails(), ["a@b.com", "c@d.com"]));
  withEnv("x@y.com", () => assert.equal(isAdminEmail("sevaleto@gmail.com"), false, "a configured list replaces the defaults"));
  withEnv(",", () => assert.ok(adminEmails().includes("sevaleto@gmail.com"), "an all-blank value falls back to the defaults"));
});

test("isAdminEmail is case-insensitive, trims, and rejects empty input", () => {
  withEnv("Manny@TradingTips.com", () => {
    assert.equal(isAdminEmail("  manny@tradingtips.com "), true);
    assert.equal(isAdminEmail("someone@else.com"), false);
    assert.equal(isAdminEmail(null), false);
    assert.equal(isAdminEmail(undefined), false);
    assert.equal(isAdminEmail(""), false);
  });
});
