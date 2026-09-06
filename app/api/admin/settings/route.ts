import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { NEWSLETTER_CLICK_VALUE_KEY, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const EDITABLE: Record<string, (v: unknown) => string | null> = {
  [NEWSLETTER_CLICK_VALUE_KEY]: (v) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100_000 ? String(v) : null),
};

/** POST { key, value } — write one admin setting. Only whitelisted keys, each with its own validation. */
export async function POST(request: Request) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = ((await request.json().catch(() => null)) ?? {}) as { key?: unknown; value?: unknown };
  const key = typeof body.key === "string" ? body.key : "";
  const validate = Object.hasOwn(EDITABLE, key) ? EDITABLE[key] : undefined;
  if (!validate) return NextResponse.json({ error: "Unknown setting" }, { status: 400 });
  const value = validate(body.value);
  if (value === null) return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  await setSetting(key, value);
  return NextResponse.json({ ok: true, key, value });
}
