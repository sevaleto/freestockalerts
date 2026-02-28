# Launch Readiness Report — FreeStockAlerts.AI

**Date:** 2026-02-27 19:30 PST  
**Auditor:** Claudius (full QA audit)  
**Repo:** `/Users/claudius/.openclaw/workspace/freestockalerts/`  
**Live URL:** https://www.freestockalerts.ai  

---

## 🟡 CONDITIONAL GO

The app is functionally complete for a soft launch with **2 blockers that must be fixed first** (both are quick fixes, ~15 min total). Once those are resolved, the core flow — sign up → create alert → get email notification — works end to end.

---

## 🚫 LAUNCH BLOCKERS — Must Fix Before Driving Traffic

### B1. Cron route only accepts POST — Vercel crons send GET (CRITICAL)
**File:** `app/api/alerts/check/route.ts`  
**Impact:** Alert checking will NEVER fire automatically. The entire core feature (automated alert checking + email notifications) is dead.

Vercel Cron Jobs always send `GET` requests. The route only exports `POST`. Every cron invocation gets **405 Method Not Allowed**.

**Fix:** Add a `GET` export that calls the same logic, or rename `POST` to `GET`.

```typescript
// Add this at the top of the existing POST function, or rename:
export async function GET() {
  return handleAlertCheck();
}
export async function POST() {
  return handleAlertCheck();
}
```

**Verified:** `curl -X GET https://www.freestockalerts.ai/api/alerts/check` → 405 ❌  
**Verified:** `curl -X POST https://www.freestockalerts.ai/api/alerts/check` → 200 ✅

### B2. No Prisma User record created on signup — alert creation may fail
**File:** `app/api/auth/callback/route.ts`  
**Impact:** The `Alert` model has a foreign key to `User`. If no `User` record exists in the Prisma DB for a new signup, `prisma.alert.create()` will throw a FK constraint error. Additionally, the cron checker calls `prisma.user.findUnique()` to get the email for notifications — it will return null and skip sending.

**No `prisma.user.create()` or `prisma.user.upsert()` exists anywhere in the codebase.** The auth callback only exchanges the code for a session.

**Fix:** In the auth callback, after `exchangeCodeForSession`, upsert a User record:

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email! },
    update: { email: user.email! },
  });
}
```

**Note:** If a Supabase database trigger already creates User records (common pattern), this may not be an issue. **Verify by signing up a fresh email and attempting to create an alert.**

---

## ⚠️ LAUNCH WARNINGS — Fix Soon, Won't Break the App

### W1. Privacy Policy and Terms of Service are placeholder text
**Files:** `app/privacy/page.tsx`, `app/terms/page.tsx`  
Both pages contain: *"This is a placeholder privacy policy/terms page. We will update it before launch."*  
**Risk:** Legally required pages are visibly unfinished. Not a hard blocker for soft launch, but should be real before any marketing push.

### W2. `emailEnabled` toggle in Create Alert is cosmetic
**File:** `app/dashboard/alerts/new/page.tsx`, `prisma/schema.prisma`  
The form sends `emailEnabled` in the POST body, but:
- The `Alert` model has **no `emailEnabled` column** in the Prisma schema
- The API destructures it but never passes it to `prisma.alert.create()`
- Users who toggle off email will still receive email alerts

**Fix:** Either add `emailEnabled Boolean @default(true)` to the Alert model and use it in the cron, or remove the toggle from the UI.

### W3. OPENAI_API_KEY may be missing in production
**File:** `.env.local` shows `ANTHROPIC_API_KEY=""` (empty)  
The cron uses `openai` (gpt-4o-mini) for AI summaries. If `OPENAI_API_KEY` is not set in Vercel env vars, all AI summaries will use the fallback text: *"$TICKER crossed $X, now trading at $Y. Monitor for follow-through."*  
**Impact:** The headline feature ("AI-powered context") degrades to a simple price statement.  
**Verify:** Check Vercel dashboard → Settings → Environment Variables for `OPENAI_API_KEY`.

### W4. Delete Account doesn't delete Supabase auth user
**File:** `app/api/user/delete/route.ts`  
Only deletes the Prisma `User` record (with cascade to alerts/history/prefs). The Supabase Auth user remains — meaning the user can still log in with their magic link and see an empty dashboard.  
**Fix:** Use Supabase Admin API to delete the auth user: `supabase.auth.admin.deleteUser(user.id)`

### W5. Hardcoded subscriber count on template cards
**File:** `app/dashboard/templates/page.tsx` (line 146)  
Every template shows **"1,250 subscribers"** regardless of actual count.  
**Fix:** Query `TemplateSubscription` count from DB or remove the display.

### W6. Mock data fallback in production
**Files:** `lib/api/quotes.ts`, `components/dashboard/TickerSearch.tsx`  
When FMP/Alpha Vantage APIs fail, the app silently falls back to `mockQuoteMap`/`mockTickers`. Users could see stale/fake prices with no indication.  
**Fix:** Show a "Quote unavailable" state instead of mock data.

### W7. No rate limiting on public API routes
All API routes (`/api/quotes/*`, `/api/templates/*`, `/api/ai/summary`) have no rate limiting. The quotes and AI summary endpoints could be abused.

---

## ✅ VERIFIED WORKING — Confirmed Functional

### Code Fixes Verified (all from FIX-LOG.md)

| Fix | Status | Details |
|-----|--------|---------|
| C3: Auth on alert API routes | ✅ Verified | `getAuthUser()` helper in `lib/supabase/server.ts`, all routes use it |
| C3: No userId from request body | ✅ Verified | POST uses `user.id` from session, not request body |
| H7: PATCH not PUT | ✅ Verified | `app/api/alerts/[id]/route.ts` exports `PATCH` |
| C3: Ownership checks | ✅ Verified | GET/PATCH/DELETE all verify `alert.userId === user.id`, return 403 |
| C4: Middleware auth guard | ✅ Verified | `lib/supabase/middleware.ts` redirects `/dashboard` → `/login` when no user |
| C1: Settings page | ✅ Verified | Real email from Supabase, all preferences wired to state, Save button calls PATCH, Delete dialog functional |
| C2: AlertTable Delete | ✅ Verified | `window.confirm()` → `DELETE /api/alerts/[id]` → `router.refresh()` |
| C2: AlertTable Edit | ✅ Verified | Disabled with "Coming soon" tooltip (intentional deferral) |
| H1: History filters | ✅ Verified | Ticker (case-insensitive), alert type dropdown (13 types), date picker — all wired with state |
| H2: History pagination | ✅ Verified | 20/page, Previous/Next with disabled states, resets on filter change |
| H3: Template subscriptions | ✅ Verified | Fetches subs on mount, toggle calls subscribe/unsubscribe API, optimistic UI with revert on failure |
| H4: Try/catch on all routes | ✅ Verified | Templates, quotes/search, quotes/[ticker] all wrapped |
| H5: Alert evaluator | ✅ Verified | All 13 types handled: price, %, volume, 52-week via FMP data; RSI/SMA/earnings gracefully skip |
| H6: emailEnabled in form | ⚠️ Partial | Form sends it, but no DB column (see W2) |

### Live Endpoint Tests

| Endpoint | Result | Details |
|----------|--------|---------|
| `GET /` (homepage) | ✅ 200 | All sections render |
| `GET /api/templates` | ✅ 200 | Returns 5 templates with items |
| `GET /api/quotes/AAPL` | ✅ 200 | Live quote: $265.48, includes volume, 52-week range, earnings date |
| `GET /api/quotes/search?query=tesla` | ✅ 200 | Returns 6+ results (TSLA + international) |
| `GET /api/quotes/search?q=tesla` | ✅ 200 | Both `query` and `q` params supported |
| `GET /dashboard` (no auth) | ✅ 307 → /login | Middleware redirect working |
| `POST /api/alerts` (no auth) | ✅ 401 | Returns `{"error":"Unauthorized"}` |
| `POST /api/alerts/check` | ✅ 200 | Returns `{"message":"No active alerts",...}` |
| `GET /about` | ✅ 200 | |
| `GET /blog` | ✅ 200 | |
| `GET /contact` | ✅ 200 | |
| `GET /privacy` | ✅ 200 | (placeholder content) |
| `GET /terms` | ✅ 200 | (placeholder content) |

### Infrastructure

| Check | Result |
|-------|--------|
| Vercel deployment | ✅ Latest: 6h ago, status "Ready", production |
| Resend domain (freestockalerts.ai) | ✅ Verified, sending enabled |
| Cron config (vercel.json) | ✅ `*/5 13-21 * * 1-5` (every 5 min, market hours M-F) |
| OG image | ✅ `/public/og-image.png` (23KB) |
| Favicon | ✅ `/public/favicon.ico` |
| SEO metadata | ✅ Title, description, OG tags in `app/layout.tsx` |
| Font loading | ✅ Inter + JetBrains Mono via `next/font` |

### Feature Verification

| Feature | Status |
|---------|--------|
| Hero signup form | ✅ Triggers real Supabase magic link |
| Footer CTA form | ✅ Same — real auth flow |
| Login page | ✅ Error handling for expired links, auth failures |
| Auth callback | ✅ Exchanges code, redirects to /dashboard |
| Dashboard stats | ✅ Real Prisma queries |
| Create alert flow | ✅ Full form with validation, 13 alert types, ticker search |
| Alert list with delete | ✅ Confirm dialog → API → refresh |
| Alert history with filters | ✅ 3 filter types + pagination |
| Template subscriptions | ✅ Optimistic toggle with API persistence |
| Settings preferences | ✅ CRUD with save/error states |
| Delete account | ⚠️ Partial (see W4 — Prisma only, not Supabase auth) |
| Comparison table (vs StockAlarm) | ✅ Clean, no fake testimonials |
| Responsive classes | ✅ Grid breakpoints (md, lg, xl) throughout |
| Loading states | ✅ Settings, history pages show loading text |

---

## 💡 NICE TO HAVE — Polish for Later

1. **RSI/SMA/Earnings alert implementations** — Currently gracefully skip with "data not available". Need technical indicator API integration.
2. **Mobile hamburger menu** — Homepage nav links are `hidden md:flex`. No mobile menu trigger.
3. **Real subscriber counts** — Replace hardcoded 1,250 with actual DB query.
4. **First name persistence** — Settings page has first name input but it's not saved to the API (preferences route doesn't handle it).
5. **Alert edit page** — Currently disabled with "Coming soon". Full edit form would be nice.
6. **TickerSearch optimization** — Fires quote API calls for all 12 visible search results simultaneously. Should only fetch on selection.
7. **Rate limiting** — Especially on `/api/quotes/*` and `/api/ai/summary`.
8. **Loading skeletons** — Replace "Loading..." text with proper skeleton components.
9. **Toast notifications** — Toaster component is included in layout but not used for alert CRUD actions.
10. **SMS/Push alerts** — Listed as "Coming soon" in comparison table.

---

## Summary

| Category | Count |
|----------|-------|
| 🚫 Launch Blockers | 2 |
| ⚠️ Launch Warnings | 7 |
| ✅ Verified Working | 25+ features |
| 💡 Nice to Have | 10 |

**Estimated time to fix blockers:** ~15-30 minutes (B1 is a one-line fix, B2 is ~10 lines in auth callback).

**Recommendation:** Fix B1 and B2, verify with a fresh signup + alert creation + cron trigger, then **GO for soft launch**.
