import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { completeSignIn } from "@/lib/auth/completeSignIn";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/activated
 *
 * Called by the browser right after it verifies a one-time code with
 * supabase.auth.verifyOtp(). The session cookie exists at that point; this
 * runs the same post-auth work the link callback does and hands back the
 * CAPI event id for pixel dedup.
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const capiEventId = await completeSignIn({
    user,
    request,
    origin,
    abVariant: cookies().get("ab_hero_headline")?.value ?? null,
  });
  return NextResponse.json({ ok: true, capiEventId });
}
