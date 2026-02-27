# FIX-LOG — QA Report Fixes

**Date:** 2026-02-27
**All fixes pushed to `origin main`**

---

## Critical Fixes

### C3+H7: Add auth to all alert API routes + rename PUT to PATCH
**Commit:** `e20e354`

- Added `getAuthUser()` helper to `lib/supabase/server.ts`
- `POST /api/alerts` — userId from session (not request body), reject unauthenticated
- `GET /api/alerts` — only returns alerts for authenticated user (removed `userId` query param)
- `GET /api/alerts/[id]` — verifies alert belongs to authenticated user
- `PUT` renamed to `PATCH /api/alerts/[id]` — verifies ownership
- `DELETE /api/alerts/[id]` — verifies ownership
- All routes wrapped in try/catch with proper error responses

### C4: Add auth guard to middleware
**Commit:** `b7986ba`

- After `supabase.auth.getUser()`, checks if path starts with `/dashboard`
- Redirects unauthenticated users to `/login`
- Public routes (/, /login, /templates, /about, /api, etc.) unaffected

### C1: Wire up Settings page
**Commit:** `b085663`

- Fetches real user email from Supabase auth on mount
- All notification toggles (email alerts, daily digest, market reminders) wired to state
- Timezone and digest time are editable and persistent
- "Save Settings" button calls `PATCH /api/user/preferences`
- Delete Account dialog: Cancel uses DialogClose, Delete calls `DELETE /api/user/delete`
- Created `GET/PATCH /api/user/preferences` routes (upsert pattern)
- Created `DELETE /api/user/delete` route

### C2: Wire up AlertTable Edit/Delete buttons
**Commit:** `74ff197`

- Delete button: `window.confirm()` → `DELETE /api/alerts/[id]` → `router.refresh()`
- Edit button: disabled with "Coming soon" tooltip (full edit page deferred)
- AlertTable converted to client component

---

## High Fixes

### H1/H2: Wire up history filters and pagination
**Commit:** `b9d6d03`

- Converted history page to client component
- Ticker filter: case-insensitive contains search
- Alert type filter: dropdown with all AlertType enum values
- Date filter: filters by triggeredAt date
- Pagination: 20 per page, working Previous/Next with disabled states
- Resets to page 1 when filters change

### H3: Persist template toggle subscriptions
**Commit:** `9aaa3b0`

- Fetches user's subscriptions on mount via `GET /api/user/subscriptions`
- Toggle calls `POST /api/templates/[slug]/subscribe` or `/unsubscribe`
- Optimistic UI update with revert on failure
- Created `GET /api/user/subscriptions` route

### H4: Add try/catch error handling to all API routes
**Commit:** `4660d56`

- `/api/templates` — wrapped Prisma call
- `/api/quotes/search` — wrapped searchTickers call, also added `?q=` param support
- `/api/quotes/[ticker]` — wrapped getQuote call
- All return JSON error with 500 status on failure

### H5: Implement full alert evaluator
**Commit:** `8c6238d`

- `PRICE_ABOVE` / `PRICE_BELOW` — price vs triggerValue
- `PRICE_RECOVERY` — same as PRICE_ABOVE
- `PERCENT_CHANGE_DAY` / `PERCENT_CHANGE_CUSTOM` — dayChangePercent vs triggerValue
- `VOLUME_SPIKE` — volume/avgVolume ratio vs triggerValue (safe when avgVolume=0)
- `FIFTY_TWO_WEEK_HIGH` / `FIFTY_TWO_WEEK_LOW` — price vs yearHigh/yearLow from FMP
- `RSI_OVERBOUGHT` / `RSI_OVERSOLD` — returns `triggered: false` (data not available)
- `SMA_CROSS_ABOVE` / `SMA_CROSS_BELOW` — returns `triggered: false` (data not available)
- `EARNINGS_REMINDER` — returns `triggered: false` (needs calendar integration)
- Unknown types: never false-trigger

### H6: Include emailEnabled in create alert POST body
**Commit:** `fdd16a2`

- `emailEnabled` toggle state now included in the POST body to `/api/alerts`

### H7: Change PUT to PATCH
Included in C3 commit (`e20e354`) — exported function renamed from `PUT` to `PATCH`

---

## New API Routes Created

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/user/preferences` | GET | Fetch user notification preferences (upsert) |
| `/api/user/preferences` | PATCH | Update user notification preferences |
| `/api/user/delete` | DELETE | Delete user account and data |
| `/api/user/subscriptions` | GET | Fetch user's template subscriptions |

## Build Status

✅ `npm run build` passes with zero errors after all fixes.
