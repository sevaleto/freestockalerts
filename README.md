# FreeStockAlerts.AI

Free stock alert platform with AI-written context. Users sign up (magic link or
Google), create alerts on any ticker, and get an email when the alert fires.

- **Live:** https://www.freestockalerts.ai
- **Hosting:** Vercel project `freestockalerts` (Pro), auto-deploys from `main`
- **Repo:** https://github.com/sevaleto/freestockalerts

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript, Tailwind + shadcn/ui
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

## Facebook ad landing pages (`/go/<slug>`)

One page per ad angle, each backed by an alert template. Defined in `lib/lp/pages.ts`;
adding a page is one config entry (copy + template slug). Pages have no site navigation,
show the template's alerts as proof, and send signups to `/welcome/<template-slug>`,
which activates the template on arrival so the visitor lands with the alerts live.

Live pages: `/go/breakouts`, `/go/radar`, `/go/turnarounds`, `/go/oversold`, `/go/sectors`.

Attribution: `User.signupSource` is `lp:<slug>` for email signups and (via the `fsa_src`
cookie) Google signups from a page. Meta pixel `ViewContent` and `Lead` carry
`content_name = lp_<slug>`. Per-page signups:

```sql
SELECT "signupSource", count(*) FROM "User" GROUP BY 1 ORDER BY 2 DESC;
```

## Strategy catalog (`/templates`)

Ten alert templates, each a defined setup, grouped into three sections: Idea Discovery,
Entry Timing, and Market and Portfolio Monitoring. Everything lives under `lib/templates/`:

| File | What it holds |
|---|---|
| `catalog.ts` | The ten strategies: copy, universe, trigger rules, cadence, sample alert, SEO, fixed alert lists |
| `screens.ts` | Qualification rules for the seven data-driven lists (one source of truth for the page, the refresh script and the tests) |
| `screened.json` | Output of the refresh script: the current constituents plus the point-in-time snapshot each one was judged on |
| `redirects.ts` | Retired slugs → their replacements |
| `seed.ts` | Idempotent upsert of the catalog into `AlertTemplate` / `TemplateItem`; retires legacy rows without deleting them |
| `activate.ts` | One-click activation (resolves legacy slugs, seeds a missing template on the spot, never duplicates a user's alerts) |

**Refreshing the screened lists** (weekly for the two weekly strategies, monthly otherwise;
each page shows its cadence and last-refresh date and flags itself when overdue):

```bash
set -a; source .env.local; set +a
npm run refresh:strategies                 # rebuilds every screened list from FMP (read-only, ~5 min)
npm run refresh:strategies -- --only leader-pullback-and-reclaim,200-day-comeback-watchlist
git diff lib/templates/screened.json       # review the new names
npm test                                   # re-checks every constituent against the rules
npm run prisma:seed                        # pushes the lists to the database
```

The script ranks qualifying names and takes the top 10; a company appears in one list only.
Rationales are generated from the stored numbers, so nothing on a page is hand-written about
a specific company. Company guidance is not available from FMP and is not part of any screen.

**Retired templates** (`earnings-season-alerts`, `buffett-style-value-watchlist`,
`momentum-breakout-alerts`, `dividend-income-watchlist`, `market-fear-greed-signals`,
`turnaround-signals`, `oversold-bounce-leaders`, `sector-rotation-radar`) stay in the
table with `isActive = false`, `retiredAt` and `replacedBySlug` set. Existing user alerts keep
their reference. `/templates/<old>`, `/welcome/<old>` and `/api/templates/<old>/*` redirect or
resolve to the replacement.

**Deploying a catalog change:** push the schema first (additive columns on `AlertTemplate`),
deploy, then seed. Activation also seeds a missing template on demand, so a deploy that lands
before the seed still works.

```bash
set -a; source .env.local; set +a
DIRECT_URL="$(echo "$DATABASE_URL" | sed -E 's/:6543\//:5432\//; s/\?.*$//')" npx prisma db push
npm run prisma:seed
```

## Event strategies (insider purchases, analyst clusters)

Two strategies have no fixed list. A daily scan (`/api/strategies/scan`, scheduled in
`vercel.json` at 21:40 UTC on weekdays, `CRON_SECRET`-protected like the alert check)
pulls the source feeds from FMP server-side, normalizes them, applies the rules, and
emails everyone subscribed to the strategy's template one message per confirmed signal.

| Piece | Where |
|---|---|
| Thresholds | `lib/strategies/config.ts` (`UNIVERSE`, `INSIDER`, `ANALYST`) |
| Normalization | `lib/strategies/insider/normalize.ts`, `lib/strategies/analyst/normalize.ts` |
| Rules and scoring | `lib/strategies/insider/evaluate.ts`, `lib/strategies/analyst/evaluate.ts` (pure, tested) |
| Scan, idempotency, delivery | `lib/strategies/scan.ts`, `lib/strategies/deliver.ts` |
| Alert presentation | `lib/strategies/present.ts` (email and pages share it), `lib/email/signalEmail.tsx` |
| Tables | `InsiderTransaction`, `AnalystAction` (normalized source rows with the raw record), `StrategySignal` (unique `signalKey`), `SignalDelivery` (unique per signal + user), `StrategyScanRun` |

Idempotency: source rows are keyed on the filing accession plus transaction details (insider)
or symbol + firm + date + grades (analyst); a signal is keyed on the exact event; a symbol gets
at most one signal per cooldown window; a delivery row is claimed before the email is sent.
Re-running the scan on the same data creates and sends nothing.

```bash
set -a; source .env.local; set +a
npm run scan:strategies -- --dry-run          # evaluate and print, no writes, no email
npm run scan:strategies -- --only analyst     # one strategy
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://www.freestockalerts.ai/api/strategies/scan?dryRun=1" | jq '.summaries[] | {strategySlug, candidates, qualified, wouldCreate}'
```

Subscribing (`/welcome/<slug>`, the Activate button, or the dashboard toggle) creates the
`TemplateSubscription`; activation creates no per-user alerts for these two templates.
Users with `emailAlerts` off, or an `INVALID`/`SUPPRESSED` address, are skipped.

## How the alert loop works

1. `vercel.json` schedules `GET /api/alerts/check` every 5 minutes, 13:00–21:59 UTC, Mon–Fri.
2. The route exits early outside 9:30–16:00 ET.
3. It loads every `Alert` with `isActive = true`, fetches one quote per distinct ticker,
   and fetches RSI / SMA / earnings data only for tickers that have alerts of those types
   (`lib/alerts/evaluator.ts`).
4. Triggered alerts get descriptive context (`lib/alerts/context.ts`: position vs the 50- and
   200-day averages, volume vs the 30-session average, and for the sector ETFs the 21-session
   return vs SPY), a two-sentence AI summary built on that context, an email (if the user's
   `emailAlerts` preference is on), an `AlertHistory` row with `emailSent`/`emailSentAt`, and a cooldown.
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
| VOLUME_SPIKE | FMP quote + 30-session average from `historical-price-eod/light` | volume / avgVolume ≥ multiplier |
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

### Validation

```bash
npm run typecheck          # tsc --noEmit
npx eslint . --ext .ts,.tsx
npm test                   # catalog, screens, redirects, alert context, insider and analyst rules (no database)
npm run test:db            # seed, activation, signal idempotency against a local throwaway Postgres (tests/db.*.test.ts)
npm run build
npm run smoke              # every template page, redirects, auth gates, against http://localhost:3000
```

For `test:db`: `createdb freestockalerts_test`, then
`DATABASE_URL=postgresql://$USER@localhost:5432/freestockalerts_test DIRECT_URL=$DATABASE_URL npx prisma db push`
(set `TEST_DATABASE_URL` if your local Postgres needs different credentials).
The `next-dev-testdb` entry in `.claude/launch.json` runs the dev server against that database so
nothing local touches production data.

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

## Cookie consent by region

No banner for US traffic. The middleware stamps a `fsa_region` cookie from Cloudflare's
`cf-ipcountry` (fallback `x-vercel-ip-country`): `optin` for the EEA, UK, and Switzerland,
`optout` for everyone else, and `optin` when the country is unknown (local dev, Tor).

- `optin`: the banner shows until the visitor chooses; no analytics or marketing tags
  before that. Reject and Accept carry equal weight.
- `optout`: no banner. Analytics and marketing are on by default and **no cookie is
  written** until the visitor changes something from the footer ("Cookie Settings" or
  "Do Not Sell or Share My Personal Information"). A Global Privacy Control signal
  (`navigator.globalPrivacyControl`, `Sec-GPC: 1`) turns marketing off automatically.
- Server-side Meta CAPI sends (`/api/tracking/lead`, sign-in) go through
  `marketingAllowed()` in `lib/cookies/serverConsent.ts` and use the same precedence:
  explicit choice → GPC → region default.

Country lists and helpers live in `lib/cookies/region.ts`. To test the other regime
locally: `document.cookie = "fsa_region=optin; path=/"` (or `optout`), then reload.

## Email verification and lead gating

Signup stays passwordless, but every address gets a deliverability verdict
(`User.emailStatus`) that decides where it can go:

| Status | Set by | Resend audience | Newsletter export | Lead sharing |
|---|---|---|---|---|
| `PENDING` | default; Email Oversight Retry/Unknown | no | no | no |
| `VALID` | Email Oversight "Verified", or the user confirmed (magic link, code, Google) | yes | yes | yes |
| `ACCEPT_ALL` | Email Oversight "Catch All" | yes | yes | no |
| `RISKY` | Email Oversight "Role", or still unknown after 3 attempts | no | no | no |
| `INVALID` | Undeliverable / Malformed / Disposable / Bot, or a Resend hard bounce | no | no | no |
| `SUPPRESSED` | SpamTrap / Complainer / Seed / Suppressed, or a Resend complaint | no | no | no |

Flow: `POST /api/auth/magic-link` rejects disposable domains (`lib/email/disposableDomains.ts`,
refresh with `npm run update:disposable`) and domains with no MX/A record, sends the link,
then calls Email Oversight after the response (`after()`), storing the verdict. A confirmed
sign-in marks the user `VALID` regardless of the verdict (except `SUPPRESSED`). The hourly
cron `/api/email/verify-pending` retries anything still `PENDING`. The Resend webhook
records complaints as `SUPPRESSED` and bounces as `INVALID`. The one filter every export
must use is `leadWhere(purpose)` in `lib/email/verification.ts`.

Set `EMAIL_OVERSIGHT_API_TOKEN` and `EMAIL_OVERSIGHT_LIST_ID`. Email Oversight whitelists
callers by IP; Vercel has no fixed egress IP, so the whitelist must be off for the account
or every call returns ResultId 12 and addresses stay `PENDING`.

```bash
npm run emails:verify -- --status                 # counts per status
npm run emails:verify -- --confirmed              # confirmed users → VALID (no API calls)
npm run emails:verify -- --pending --limit 100    # verify PENDING users (1 credit each)
npm run leads:export -- --purpose newsletter      # CSV of VALID + ACCEPT_ALL
npm run leads:export -- --purpose lead-share      # CSV of VALID only
```

## Known gaps

- Users who signed up before Sept 2026 and never clicked their link exist only in
  Supabase Auth (no `User` row). Since then the row is created at submit.
- "Delete account" removes the Prisma record but not the Supabase Auth user.
- No rate limiting on `/api/quotes/*` or `/api/ai/summary`.

See `BUILD_SPEC.md` for the original build specification and `LAUNCH-READINESS.md` /
`QA-REPORT.md` / `FIX-LOG.md` for the Feb 2026 QA history.
