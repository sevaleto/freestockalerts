# QA Audit Report — FreeStockAlerts.AI Dashboard

**Date:** 2026-02-27  
**Auditor:** Claudius (automated QA)  
**Stack:** Next.js 14.2 · Supabase Auth · Prisma ORM · Tailwind CSS  
**Live URL:** https://www.freestockalerts.ai  

---

## Executive Summary

The app's core happy path works: login → create alert → view dashboard. Live API endpoints (quotes, templates, search) are functional. The Sign Out and Create Alert buttons have been correctly wired up (commits `b1b00f8` and `0c62756`). However, the Settings page is completely non-functional, the Alert History page has dummy filters/pagination, the AlertTable Edit/Delete buttons are stubs, and several API routes lack authentication and error handling.

---

## 🔴 CRITICAL — Needs Immediate Fix

### C1. Settings page is entirely non-functional
**File:** `app/dashboard/settings/page.tsx`

Every element on this page is a dummy:
- **Email field** is hardcoded to `"trader@freestockalerts.ai"` with `readOnly` — never fetches the actual user's email
- **First name input** — no `value` state, no `onChange` persistence, no API call
- **Timezone select** — has `defaultValue` but no save mechanism
- **Notification switches** (email alerts, daily digest, market open/close reminders) — toggle visually but never persist to `UserPreferences` table
- **Digest time input** — renders conditionally but never saves
- **No "Save" button** exists anywhere on the page
- **Delete Account dialog** — both Cancel and Delete buttons have **no onClick handlers**. The destructive `<Button variant="destructive">Delete</Button>` literally does nothing.

**Impact:** Users cannot manage any settings. The delete account flow is broken.

### C2. AlertTable Edit and Delete buttons are dummy stubs
**File:** `components/dashboard/AlertTable.tsx` (lines ~67-72)

```tsx
<Button variant="ghost" size="sm">Edit</Button>
<Button variant="ghost" size="sm">Delete</Button>
```

No `onClick` handlers. No API calls. Users see Edit/Delete on every alert row but clicking does nothing.

**Impact:** Users cannot edit or delete alerts from the alerts list.

### C3. No authentication on alert API routes
**Files:** `app/api/alerts/route.ts`, `app/api/alerts/[id]/route.ts`

- `POST /api/alerts` accepts a `userId` in the request body without verifying the caller's identity. **Any unauthenticated request can create alerts for any user.**
- `GET /PUT /DELETE /api/alerts/[id]` have zero auth checks — anyone who knows an alert ID can read, modify, or delete it.
- `GET /api/alerts?userId=xxx` returns alerts for any user without auth.

**Impact:** Complete authorization bypass. This is a security vulnerability.

### C4. Middleware does not protect dashboard routes
**Files:** `middleware.ts`, `lib/supabase/middleware.ts`

The `updateSession()` function only refreshes the Supabase cookie — it **does not** check authentication state or redirect unauthenticated users. Visiting `/dashboard` while logged out shows an empty dashboard (empty alerts array) rather than redirecting to `/login`.

**Impact:** Unauthenticated users see a confusing empty state instead of being directed to log in.

---

## 🟠 HIGH — Important Issues

### H1. Alert History page filters are non-functional
**File:** `app/dashboard/history/page.tsx`

Three filter controls exist but are completely dummy:
- **Ticker filter `<Input>`** — no `value` state, no `onChange`, no filtering logic
- **Alert type `<Select>`** — no `value` state, no `onValueChange`, no filtering logic
- **Date `<Input type="date">`** — no `value` state, no `onChange`, no filtering logic

All filtering happens server-side with no filter params — every history item is always shown.

### H2. Alert History pagination is non-functional
**File:** `app/dashboard/history/page.tsx` (bottom)

```tsx
<button className="rounded-full border border-border px-4 py-2">Previous</button>
<button className="rounded-full border border-border px-4 py-2">Next</button>
```

Plain `<button>` elements with no `onClick`. The "Showing 1-20 of N" text is hardcoded to cap at 20 but all items render. No actual pagination logic exists.

### H3. Template toggle doesn't persist subscriptions
**File:** `app/dashboard/templates/page.tsx`

The `onToggle` callback on `TemplateCard` only updates local React state (`activeTemplates` Set). It never calls:
- `POST /api/templates/[slug]/subscribe`
- `POST /api/templates/[slug]/unsubscribe`

**Impact:** Toggling a template on/off resets on page reload. Subscriptions are never saved.

### H4. API routes missing error handling (no try/catch around Prisma)

| Route | Method | Issue |
|-------|--------|-------|
| `/api/alerts` | GET | No try/catch around `prisma.alert.findMany()` — unhandled DB errors return 500 with stack trace |
| `/api/alerts` | POST | No try/catch around `prisma.alert.create()` — invalid enum values, constraint violations crash |
| `/api/templates` | GET | No try/catch around `prisma.alertTemplate.findMany()` |
| `/api/quotes/search` | GET | No try/catch around `searchTickers()` |
| `/api/quotes/[ticker]` | GET | No try/catch around `getQuote()` — returns null/undefined for unknown tickers |

### H5. Alert evaluator is a stub — only handles PRICE_ABOVE/BELOW
**File:** `lib/alerts/evaluator.ts`

Contains `// TODO: Replace with full evaluation logic across alert types.` The evaluator only does simple price comparison (`quote.price > triggerValue` / `quote.price < triggerValue`). These alert types are **not implemented**:
- `VOLUME_SPIKE` — needs volume vs. avg volume comparison
- `RSI_OVERBOUGHT` / `RSI_OVERSOLD` — needs RSI calculation (no RSI data fetched)
- `SMA_CROSS_ABOVE` / `SMA_CROSS_BELOW` — needs SMA calculation (no historical data fetched)
- `FIFTY_TWO_WEEK_HIGH` / `FIFTY_TWO_WEEK_LOW` — needs 52-week range comparison
- `EARNINGS_REMINDER` — needs earnings date tracking
- `PERCENT_CHANGE_DAY` / `PERCENT_CHANGE_CUSTOM` — needs % change comparison, not price comparison

**Impact:** The cron alert checker (`/api/alerts/check`) will produce incorrect results for most alert types.

### H6. `emailEnabled` toggle in Create Alert form is not sent to API
**File:** `app/dashboard/alerts/new/page.tsx`

The `emailEnabled` state (controlled by a Switch) is never included in the `fetch("/api/alerts", { body: JSON.stringify({...}) })` call. Users who toggle email off still receive emails.

### H7. Alert `[id]` route exports PUT, not PATCH
**File:** `app/api/alerts/[id]/route.ts`

The exported function is `PUT` but partial updates are being applied (only changed fields). The task spec and REST convention suggest this should be `PATCH`. Any client sending `PATCH` will get a 405.

---

## 🟡 MEDIUM — Improvements

### M1. TickerSearch fires 12 parallel quote API calls
**File:** `components/dashboard/TickerSearch.tsx`

On every search result update, `useEffect` fires `fetch(/api/quotes/${ticker})` for all 12 visible results simultaneously. This rapidly consumes FMP API quota and causes a burst of requests on each keystroke (after 150ms debounce).

**Suggestion:** Remove the per-ticker quote fetching from search results. Only fetch a quote when the user selects a ticker (which already happens in `NewAlertPage`).

### M2. Hardcoded subscriber count on template cards
**File:** `app/dashboard/templates/page.tsx` (line ~49)

```tsx
subscribers={1250}
```

Every template shows "1,250 subscribers" regardless of actual subscription count. Should query `TemplateSubscription` count from DB.

### M3. Search param name discrepancy
**File:** `app/api/quotes/search/route.ts`

The route reads `searchParams.get("query")` but the task spec tests with `?q=apple` (which returns empty `[]`). Consumers need to use `?query=apple`. Consider supporting both params or documenting the correct one.

### M4. `.env.local` has direct DB connection (port 5432)
**File:** `.env.local`

Local `.env.local` still has `db.wcskxdgcnkhnxkqqtcif.supabase.co:5432`. Commit `4254b50` added `directUrl` to schema, so production should be fine if Vercel env vars are set correctly with port 6543. But local dev should also use pooler for consistency.

### M5. Mock data fallback in production
**Files:** `lib/api/quotes.ts`, `components/dashboard/TickerSearch.tsx`

When API calls fail, the code silently falls back to `mockQuoteMap` / `mockTickers`. In production this means users could see stale/fake prices without any indication. Consider showing a "quote unavailable" state instead.

### M6. No rate limiting on public API routes
All API routes (`/api/alerts`, `/api/quotes/*`, `/api/templates/*`, `/api/ai/summary`) have no rate limiting. The quotes and AI summary endpoints especially could be abused.

### M7. OpenAI API key fallback to empty string
**Files:** `app/api/alerts/check/route.ts`, `app/api/ai/summary/route.ts`

```tsx
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
```

If the key is missing, this will make API calls with an empty key, which silently fails. Should validate key presence and return a meaningful error.

---

## ✅ Verified Fixes

| Issue | Status | Commit |
|-------|--------|--------|
| Create Alert button wired up | ✅ Working — full form with validation, API call, success redirect | `0c62756` |
| Sign Out button functional | ✅ Working — calls `supabase.auth.signOut()` then `router.push("/")` | `b1b00f8` |
| DB connection pooler | ✅ Schema has `directUrl` — production should use pooler on port 6543 | `4254b50` |
| Auth callback route | ✅ Exchanges code for session, redirects to `/dashboard` | — |
| Login page with error handling | ✅ Shows URL errors, hash errors, expired link messages | `bb77bec` |

---

## ✅ Live Endpoint Tests

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /api/templates` | ✅ 200 OK | Returns 5 templates with all items from DB |
| `GET /api/quotes/AAPL` | ✅ 200 OK | Live quote: $265.48 (-2.74%) |
| `GET /api/quotes/search?query=apple` | ✅ 200 OK | Returns 10 results (AAPL + international exchanges) |
| `GET /api/quotes/search?q=apple` | ⚠️ Returns `[]` | Route reads `query` param, not `q` |

---

## Files Audited

### Dashboard Pages
| File | Status | Issues Found |
|------|--------|-------------|
| `app/dashboard/page.tsx` | ✅ Functional | Server component, real Prisma queries, proper stats |
| `app/dashboard/alerts/page.tsx` | ⚠️ Partial | Lists alerts correctly but Edit/Delete in table are stubs |
| `app/dashboard/alerts/new/page.tsx` | ✅ Functional | Full form flow, validation, API call, redirect |
| `app/dashboard/history/page.tsx` | ⚠️ Mostly stub | Data renders but filters and pagination are dummy |
| `app/dashboard/settings/page.tsx` | 🔴 Entirely dummy | No form submission, hardcoded email, no API calls |
| `app/dashboard/templates/page.tsx` | ⚠️ Partial | Renders templates, toggle doesn't persist |
| `app/dashboard/layout.tsx` | ✅ Clean | Sidebar + main content wrapper |

### Dashboard Components
| File | Status | Issues Found |
|------|--------|-------------|
| `components/dashboard/Sidebar.tsx` | ✅ Functional | Nav links work, Sign Out wired up |
| `components/dashboard/AlertCard.tsx` | ✅ Presentational | Display-only, no interactive elements |
| `components/dashboard/AlertHistoryItem.tsx` | ✅ Presentational | Display-only, no interactive elements |
| `components/dashboard/AlertTable.tsx` | 🔴 Has stubs | Edit and Delete buttons have no handlers |
| `components/dashboard/AlertTypeSelector.tsx` | ✅ Functional | onClick wired, state flows to parent |
| `components/dashboard/StatsRow.tsx` | ✅ Presentational | Display-only |
| `components/dashboard/TemplateCard.tsx` | ✅ Component OK | Component is fine; parent doesn't persist toggle |
| `components/dashboard/ThresholdForm.tsx` | ✅ Functional | All alert types handled with proper inputs |
| `components/dashboard/TickerSearch.tsx` | ⚠️ Functional but wasteful | Works but fires too many API calls |

### API Routes
| File | Status | Issues Found |
|------|--------|-------------|
| `app/api/alerts/route.ts` | ⚠️ Missing auth + error handling | No auth check on GET/POST, no try/catch on Prisma |
| `app/api/alerts/[id]/route.ts` | ⚠️ Missing auth + exports PUT not PATCH | No ownership verification, wrong HTTP method |
| `app/api/alerts/check/route.ts` | ⚠️ Evaluator is stub | AI summary + email work, but evaluation logic is incomplete |
| `app/api/auth/callback/route.ts` | ✅ Functional | Exchanges code, redirects, handles errors |
| `app/api/quotes/[ticker]/route.ts` | ⚠️ No error handling | No try/catch around getQuote() |
| `app/api/quotes/search/route.ts` | ⚠️ No error handling | No try/catch, param name is `query` not `q` |
| `app/api/templates/route.ts` | ⚠️ No error handling | No try/catch around Prisma call |
| `app/api/templates/[slug]/route.ts` | ✅ Handles 404 | Proper not-found handling |
| `app/api/templates/[slug]/subscribe/route.ts` | ✅ Functional | Validates input, upserts subscription |
| `app/api/templates/[slug]/unsubscribe/route.ts` | ✅ Functional | Validates input, handles not-found |
| `app/api/ai/summary/route.ts` | ✅ Functional | Graceful fallback on OpenAI failure |

### Auth & Middleware
| File | Status | Issues Found |
|------|--------|-------------|
| `middleware.ts` | ⚠️ Incomplete | Only refreshes session, doesn't redirect unauth users |
| `lib/supabase/middleware.ts` | ⚠️ No auth guard | `updateSession()` doesn't check if user exists |
| `app/login/page.tsx` | ✅ Functional | Magic link flow with error handling |

### Library Files
| File | Status | Issues Found |
|------|--------|-------------|
| `lib/prisma/client.ts` | ✅ Clean | Singleton pattern, uses DATABASE_URL |
| `lib/api/quotes.ts` | ✅ Functional | FMP primary, Alpha Vantage fallback, mock fallback, 60s cache |
| `lib/alerts/evaluator.ts` | 🔴 Stub | Only handles PRICE_ABOVE/BELOW, TODO comment |
| `lib/email/sendAlertEmail.ts` | ✅ Functional | Uses Resend, proper from/to |
| `lib/mock/templates.ts` | ✅ Reference data | Used as fallback, matches DB seed |

---

## Priority Fix Order

1. **C3** — Add auth to all alert API routes (security vulnerability)
2. **C4** — Add auth guard to middleware (redirect unauth → /login)
3. **C1** — Wire up Settings page (fetch user data, save preferences, delete account)
4. **C2** — Wire up AlertTable Edit/Delete buttons
5. **H3** — Persist template toggle subscriptions
6. **H1/H2** — Wire up history filters and pagination
7. **H5** — Implement full alert evaluator for all alert types
8. **H4** — Add try/catch error handling to all API routes
9. **H6** — Include emailEnabled in create alert API call
10. **H7** — Change PUT to PATCH on alert [id] route
