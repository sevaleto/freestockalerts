# FreeStockAlerts.AI

Free stock alert platform with AI-written context. Users sign up (magic link or
Google), create alerts on any ticker, and get an email when the alert fires.

- **Live:** https://www.freestockalerts.ai
- **Hosting:** Vercel project `freestockalerts` (Pro), auto-deploys from `main`
- **Repo:** https://github.com/sevaleto/freestockalerts

## Tech stack

- Next.js 14 (App Router) + TypeScript, Tailwind + shadcn/ui
- Prisma on Supabase Postgres (pooled via pgbouncer)
- Supabase Auth (magic link + Google OAuth)
- Financial Modeling Prep (quotes, search, RSI/SMA indicators, earnings calendar), Alpha Vantage as quote fallback
- OpenAI `gpt-4o-mini` for the one-paragraph alert summary
- Resend for alert emails, Supabase auth emails, and the broadcast audience
- Meta Pixel + Conversions API, TikTok pixel, cookie consent

## How signup works

Passwordless. Every form (`Hero`, `FinalCTA`, `TemplatePreview`, `/login`) posts to
`POST /api/auth/magic-link`, which:

1. Rate-limits to one email per address per 60 s (`User.lastLinkSentAt`).
2. Mints a token with the Supabase **admin** API (`auth.admin.generateLink`, service-role key).
   This creates the auth user on first contact.
3. **Captures the lead immediately**: upserts the Prisma `User` (with `signupSource` and the
   A/B variant) and adds them to the Resend audience, before any click.
4. Sends a branded email via Resend (`lib/email/magicLinkEmail.tsx`) containing a
   token-hash link and a one-time code.

The link hits `GET /api/auth/callback?token_hash=…&type=…`, verified server-side with
`verifyOtp`, so it works in any browser or device (ad traffic often signs up inside the
Facebook in-app browser and opens the email elsewhere). The one-time code is verified in the
browser with `verifyOtp({ email, token, type: "email" })` and then `POST /api/auth/activated`.
Google OAuth still lands on the callback with `?code=` (PKCE). Both paths run
`lib/auth/completeSignIn.ts` (mark verified, audience, Meta CAPI CompleteRegistration).

Supabase's own email templates are no longer used. Supabase dashboard requirements:
Site URL `https://www.freestockalerts.ai`; Redirect URLs include
`https://www.freestockalerts.ai/api/auth/callback` and `http://localhost:3000/api/auth/callback`.

Resend webhook (`/api/webhooks/resend`) must be subscribed to `email.bounced` and
`email.complained` so bad addresses are suppressed from broadcasts.

## How the alert loop works

1. `vercel.json` schedules `GET /api/alerts/check` every 5 minutes, 13:00–21:59 UTC, Mon–Fri.
2. The route exits early outside 9:30–16:00 ET.
3. It loads every `Alert` with `isActive = true`, fetches one quote per distinct ticker,
   and fetches RSI / SMA / earnings data only for tickers that have alerts of those types
   (`lib/alerts/evaluator.ts`).
4. Triggered alerts get an AI summary, an email (if the user's `emailAlerts` preference
   is on), an `AlertHistory` row with `emailSent`/`emailSentAt`, and a cooldown.
5. **One-shot types** (price above/below, 52-week high/low, RSI, SMA cross, earnings
   reminder) deactivate after firing. Editing the trigger re-arms them.
   **Recurring types** (daily % change, volume spike) stay active but notify at most
   once per trading day (US market time). `cooldownMinutes` is still honoured but is
   no longer exposed in the UI.

### Alert type support

| Type | Data source | Semantics |
|---|---|---|
| PRICE_ABOVE / PRICE_BELOW / PRICE_RECOVERY | FMP quote | price vs threshold |
| PERCENT_CHANGE_DAY / _CUSTOM | FMP quote | abs(day change %) ≥ threshold |
| VOLUME_SPIKE | FMP quote | volume / avgVolume ≥ multiplier (skips if avgVolume missing) |
| FIFTY_TWO_WEEK_HIGH / _LOW | FMP quote | price ≥ yearHigh / ≤ yearLow |
| RSI_OVERBOUGHT / RSI_OVERSOLD | FMP `technical-indicators/rsi` (14, 1day) | RSI ≥ / ≤ threshold |
| SMA_CROSS_ABOVE / _BELOW | FMP `technical-indicators/sma` (period = triggerValue) | prior close on the other side of SMA and price now across it |
| EARNINGS_REMINDER | FMP `earnings` | next earnings date within `triggerValue` days |

## Local development

```bash
npm install
vercel link --project freestockalerts   # once
vercel env pull .env.local              # pulls the "development" env
npm run dev                             # http://localhost:3000
```

`npm run build` runs `prisma generate` then `next build`. See `.env.example` for every
variable and what it does.

> The Vercel development environment uses the **production** database. Local dev
> reads and writes live user data.

## Operations

**Preview what the cron would do right now (no emails, no writes, ignores market hours):**

```bash
curl -s "https://www.freestockalerts.ai/api/alerts/check?dryRun=1" | jq '.wouldFire'
```

**Lock the cron route.** Add `CRON_SECRET` in Vercel → Settings → Environment Variables.
Vercel then sends `Authorization: Bearer <CRON_SECRET>` on every cron call and the
route rejects anything else. Until it is set, the route is open (legacy behaviour).
For manual calls once it is set:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://www.freestockalerts.ai/api/alerts/check?dryRun=1"
```

**Check health quickly:**

```bash
curl -s https://www.freestockalerts.ai/api/quotes/AAPL      # FMP key + route
curl -s https://www.freestockalerts.ai/api/templates | head  # database
```

**Seed alert templates** (idempotent by slug):

```bash
npm run prisma:seed
```

**Schema changes:** there is no migrations directory; the schema is pushed directly.
Edit `prisma/schema.prisma`, then:

```bash
set -a; source .env.local; set +a
DIRECT_URL="$(echo "$DATABASE_URL" | sed -E 's/:6543\//:5432\//; s/\?.*$//')" npx prisma db push
```

The `DIRECT_URL` stored in Vercel points at `db.<ref>.supabase.co`, which is **IPv6-only**
and unreachable from most home networks (`P1001: Can't reach database server`). The
session-mode pooler (same host as `DATABASE_URL`, port 5432, no `pgbouncer` params) is
IPv4 and works for `db push`. Push additive changes **before** merging code that depends
on them.

## Known gaps

- Users who signed up before Sept 2026 and never clicked their link exist only in
  Supabase Auth (no `User` row). Since then the row is created at submit.
- "Delete account" removes the Prisma record but not the Supabase Auth user.
- Template subscriber counts on the dashboard are hardcoded.
- No rate limiting on `/api/quotes/*` or `/api/ai/summary`.
- Next.js 14 has open advisories that are only patched in 15.x; upgrading is a major
  version bump (async `cookies()`/`params`, etc.).

See `BUILD_SPEC.md` for the original build specification and `LAUNCH-READINESS.md` /
`QA-REPORT.md` / `FIX-LOG.md` for the Feb 2026 QA history.
