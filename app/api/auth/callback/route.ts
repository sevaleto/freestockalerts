import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import {
  sendCAPIEvent,
  extractFbCookies,
  generateEventId,
} from "@/lib/tracking/meta-capi";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete(name);
          },
        },
      }
    );

    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Upsert User record in Prisma so FK constraints work
      if (data.user) {
        try {
          await prisma.user.upsert({
            where: { id: data.user.id },
            create: {
              id: data.user.id,
              email: data.user.email ?? "",
              emailVerified: !!data.user.email_confirmed_at,
            },
            update: {
              email: data.user.email ?? "",
              emailVerified: !!data.user.email_confirmed_at,
            },
          });
        } catch (e) {
          console.error("Failed to upsert user record:", e);
        }
      }
      // Fire CompleteRegistration via CAPI (server-side)
      const eventId = generateEventId();
      const cookieHeader = request.headers.get("cookie");
      const { fbc, fbp } = extractFbCookies(cookieHeader);

      // Fire async — don't block the redirect
      sendCAPIEvent({
        eventName: "CompleteRegistration",
        eventId,
        eventSourceUrl: `${origin}/api/auth/callback`,
        userData: {
          email: data.user?.email || undefined,
          ip:
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            "",
          userAgent: request.headers.get("user-agent") || "",
          fbc,
          fbp,
        },
        customData: { content_name: "dashboard" },
      }).catch((err) => console.error("[CAPI] CompleteRegistration error:", err));

      // Pass event_id to dashboard for browser pixel dedup
      const redirectUrl = new URL(`${origin}${next}`);
      redirectUrl.searchParams.set("capi_eid", eventId);
      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
