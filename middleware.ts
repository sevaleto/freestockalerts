import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { REGION_COOKIE, REGION_COOKIE_MAX_AGE, regionFromHeaders } from "@/lib/cookies/region";
import { LEGACY_TEMPLATE_SLUGS } from "@/lib/templates/redirects";

/** /templates/<old-slug> and /welcome/<old-slug> → the strategy that replaced it (real 308, before auth). */
function legacyTemplateRedirect(request: NextRequest): NextResponse | null {
  const match = /^\/(templates|welcome)\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (!match) return null;
  const target = Object.prototype.hasOwnProperty.call(LEGACY_TEMPLATE_SLUGS, match[2]) ? LEGACY_TEMPLATE_SLUGS[match[2]] : null;
  if (!target) return null;
  const url = request.nextUrl.clone();
  url.pathname = `/${match[1]}/${target}`;
  return NextResponse.redirect(url, 308);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacy = legacyTemplateRedirect(request);
  if (legacy) return legacy;

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
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/auth/magic-link|api/webhooks|api/email|api/alerts/check|api/ads/click|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
