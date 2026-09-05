import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { REGION_COOKIE, REGION_COOKIE_MAX_AGE, regionFromHeaders } from "@/lib/cookies/region";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ad landing pages are ISR and never need a session; skip the Supabase round trip.
  const response = pathname.startsWith("/go/")
    ? NextResponse.next({ request: { headers: request.headers } })
    : await updateSession(request);

  // Stamp the consent region once per browser so the client knows whether to
  // show the opt-in banner (EEA/UK/CH) or run the opt-out model (US, rest).
  if (!pathname.startsWith("/api/") && !request.cookies.get(REGION_COOKIE)) {
    response.cookies.set({
      name: REGION_COOKIE,
      value: regionFromHeaders(request.headers),
      path: "/",
      maxAge: REGION_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // All paths except static files and the API routes that never need a session refresh.
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/auth/magic-link|api/webhooks|api/email|api/alerts/check|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
