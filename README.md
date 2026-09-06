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
- Anthropic Claude (`claude-haiku-4-5`) for the two-paragraph context in alert and signal emails
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

### Google sign-in

Google OAuth is handled by Supabase Auth (`signInWithOAuth({ provider: "google" })` in
`components/auth/GoogleSignInButton.tsx`); nothing Google-specific lives in this repo or in
env vars. The pieces, in case they need to be recreated:

- **Google Cloud project `free-stock-alerts`** (Google Auth Platform). Consent screen
  ("Branding") is app name `FreeStockAlerts`, audience **External**, publishing status
  **In production**. Scopes: `openid`, `userinfo.email`, `userinfo.profile` only (all
  non-sensitive, so no verification review). Do not add a logo without planning for
  Google's brand verification. An **Internal** audience limits sign-in to one Google
  Workspace domain, which is exactly the bug this replaced.
- **OAuth client** `FreeStockAlerts Web (Supabase)`, type Web application. Authorized
  JavaScript origins: `https://www.freestockalerts.ai`, `https://auth.freestockalerts.ai`.
  Authorized redirect URIs: `https://auth.freestockalerts.ai/auth/v1/callback` (the Supabase
  custom auth domain, which is what Supabase actually sends) plus
  `https://wcskxdgcnkhnxkqqtcif.supabase.co/auth/v1/callback` as a fallback.
- **Supabase → Authentication → Sign In / Providers → Google**: enabled, Client IDs = the
  client ID above, Client Secret = the secret Google shows once at creation. "Skip nonce
  checks" stays off.

If the button ever shows "Google sign-in isn't available right now", Supabase refused to
start the redirect (provider disabled or bad credentials); the underlying error is logged to
the browser console.

Resend webhook (`/api/webhooks/resend`) must be subscribed to `email.bounced` and
`email.complained` so bad addresses are suppressed from broadcasts.

## Facebook ad landing pages (`/go/<slug>`) and headline split tests

One page per ad angle, each backed by an alert template. Pages are rows in the
`LandingPage` table, managed at `/admin/pages` (admins only): pick a slug and a strategy,
write one or more headline + subheadline variants, publish. Pages have no site navigation,
show the template's alerts as proof, and send signups to `/welcome/<template-slug>`,
which activates the template on arrival so the visitor lands with the alerts live.
The homepage hero is the row with slug `home`; only its variants are used.

`lib/lp/pages.ts` holds the original seven pages as seed data (`npm run prisma:seed`
creates missing rows and never overwrites admin edits) and as the fallback if the
database read fails. Copy fields left blank in the admin fall back to the strategy's
own landing copy and sample alert.

Split tests: the middleware stamps a random `fsa_bucket` cookie once per browser;
`lib/ab/pick.ts` maps it onto the page's active variants by weight, so assignment is
sticky per visitor and page and the first render already shows the right headline.
The page writes `fsa_var=<slug>:<key>`, which the auth routes store on
`User.signupVariant` at signup (first write wins). Views come from a browser beacon
(`POST /api/ab/view`, bots ignored). The admin shows views, leads, confirmed signups,
lead rate and a two-proportion z-test against variant A. `?v=B` forces a variant
(not counted); `?preview=1` lets admins view draft pages. Page copy and the watchlist
quotes are cached for an hour (`unstable_cache`, tags `lp:<slug>`); admin saves
invalidate the page tag immediately.

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

## Public forms: /advertise and /do-not-sell

Both pages mirror research.tradingtips.com. `/advertise` is the advertiser pitch (no audience
figures, no rates, no named staff in the prose) ending in an inquiry form; `/do-not-sell` is the
CCPA/CPRA opt-out page with the request form and a link that opens the site's privacy-choices
panel for the cookie half. The forms post JSON to `/api/advertiser-inquiry` and
`/api/privacy-request`: per-IP rate limit, honeypot, Turnstile (when configured), then the row is
written (`AdvertiserInquiry`, `PrivacyRequest`) before staff are emailed in `after()`. The email
outcome is written back to the row (`emailStatus` / `notifyStatus`), so an undelivered request is
visible. There is no admin page; the tables are the record:

```sql
SELECT ts, name, company, email, "emailStatus", "handledAt" FROM "AdvertiserInquiry" ORDER BY ts DESC;
SELECT ts, "firstName", "lastName", email, "notifyStatus", "handledAt" FROM "PrivacyRequest" ORDER BY ts DESC;
```

Recipients are env-overridable (`ADVERTISER_INQUIRY_TO`, `ADVERTISER_INQUIRY_BCC`,
`PRIVACY_ALERT_EMAILS`); see `.env.example`. A privacy request has a 45-day statutory clock.

## Email ads (sponsored snippet in every alert)

Every alert and signal email ends with one sponsored snippet, styled like the Trading Tips Email
Ops banners (lead-in line, headline with an "(Ad)" tag, body, underlined link, optional 230px
image). Admins create and manage them at `/admin/ads`; the link shows in the dashboard sidebar for
admins only. There is no admin password: a person signs in normally (magic link or Google) and the
server checks the address against `ADMIN_EMAILS`. Defaults in `lib/auth/admin.ts` are Manny's two
addresses plus chelsie@trading-tips.us and nicole@trading-tips.us; setting the variable replaces
that list. Everyone else gets a 404 from `/admin` and a 403 from `/api/admin/ads`.

- **Model:** `EmailAd` (copy, `status` active/paused, `weight`, optional `startAt`/`endAt`,
  `impressions`, `clicks`, `lastShownAt`) and `EmailAdClick` (one row per click, hashed IP,
  `counted` false for link scanners). Additive tables: `prisma db push` before deploy.
- **Rotation:** `lib/ads/rotation.ts` picks the servable ad with the fewest impressions per unit of
  weight (ties go to the least recently shown), so a weight-2 ad gets twice the share and nothing
  is starved. `serveEmailAd()` in `lib/ads/serve.ts` picks, increments the impression, and returns
  the HTML; `sendAlertEmail` and `sendSignalEmail` call it per recipient. It never throws: with no
  active ad, or on a DB error, the email simply has no sponsored section.
- **HTML:** `renderAdHtml()` in `lib/ads/template.ts` is the single source of the snippet (table
  layout, inline styles, MSO ghost tables, stacks on phones). The admin editor's live preview and
  the tests render through the same function. All advertiser text is escaped.
- **Clicks:** every link in the snippet goes through `/api/ads/click/<id>`, which 302s to the CTA
  URL and logs the click afterwards. Bot-looking user agents are logged but not counted.
- **Preview:** `/dev/emails` shows an image ad, a text-only ad, and an email with no ad.
- **Compliance:** the snippet is labeled "Sponsored" and "(Ad)". Ad copy is subject to the same
  rules as the rest of the site: no guarantees, no "risk-free" or "secret", hedge performance
  claims, and "Past performance does not guarantee future results" on any performance data.

## Subscribers, ad clicks and cohorts

The tracked population is everyone who signed up on the FreeStockAlerts website (the app's
`User` rows). Each of them is looked up by email in both Beehiiv newsletters (FreeStockAlerts.AI
and The Smart Investor); a click by one of them in either newsletter counts. `/admin/subscribers`
lists them with their clicks, `/admin/cohorts` groups them by the UTM source, medium and campaign
that brought them with the click revenue credited to each cohort. Code lives in
`lib/subscribers/` and `lib/beehiiv/`.

- **Sync.** `/api/subscribers/sync` runs hourly (vercel.json): mirror app users into
  `Subscriber`, look each tracked subscriber up by email in both publications
  (`findSubscriptionByEmail`, exact match confirmed client-side), and refresh the latest issues'
  link stats. A few dozen API calls per run. `npm run sync:subscribers` does the same from a
  laptop; `npm run sync:subscribers -- --full si` mirrors a whole list (`syncBeehiivPublication`,
  cursor-based and resumable) if that is ever wanted. `BEEHIIV_API_KEY` is only read from the
  environment.
- **Tracking starts when a subscriber is first seen.** Beehiiv's click counts are lifetime
  totals, so the first sync freezes them as a baseline (`beehiiv*ClicksBaseline`,
  `trackingStartedAt`) and only the increase since then is credited. An old Smart Investor
  reader who signs up for alerts today starts at zero.
- **First-touch attribution.** Beehiiv provides UTM fields and the referring landing page per
  subscription. For app signups, `lib/tracking/attribution.ts` reads the UTM parameters and
  `fbclid` from the landing URL (kept in sessionStorage for the tab, no cookie) and the signup
  request stores them on `User`. When one email exists in several sources, the earliest signup
  that actually carries tags wins (`mergeAttribution` in `lib/subscribers/cohort.ts`). A cohort is
  `source|medium|campaign`, lowercased.
- **Newsletter clicks come from Beehiiv.** Every link in every issue is already tracked by
  Beehiiv; the sync copies each subscription's lifetime `total_clicked` / `total_unique_clicked`
  onto the subscriber (`beehiivSiUniqueClicks` etc.) and each sent issue's per-link stats into
  `NewsletterPost` / `NewsletterLink` (`/admin/newsletters` shows which link in an issue earned
  the clicks across all readers, with Beehiiv's human-verified subset next to the raw count).
  Nothing has to be created in the app for a newsletter ad to count. Unique clicks above the
  baseline are priced at the "newsletter value per unique click" setting on `/admin/cohorts`
  (`AppSetting`, default $2.50, computed at report time so changing it re-prices everything).
- **Alert-email clicks come from our redirect.** Every ad link in an alert email is
  `/api/ads/click/<adId>?c=alert&s=u_<userId>`. A click is counted when it is not a bot and the
  same subscriber (or IP, when unknown) has no counted click on that ad in the last 24 hours; it
  is stamped with the ad's value per click (default $2.50, editable per ad) and credited to the
  subscriber. The optional Beehiiv snippet buttons on the ad editor produce the same card with
  `c=fsa|si&s={{api_subscription_id}}` links; those clicks count for the ad but are not credited
  to the subscriber, because Beehiiv already counted them.
- **Cohort cost.** On `/admin/cohorts`, pick a month and type the spend per cohort; the return
  column is revenue ÷ cost. Costs are stored in `CohortCost` per cohort and month.
- **Schema.** `Subscriber` (with Beehiiv click counts), `CohortCost`, `SubscriberSyncRun`,
  `AppSetting`, `NewsletterPost`, `NewsletterLink`, new columns on `User` (utm*, fbclid,
  landingPath, referrer), `EmailAd.valueCents`, and `EmailAdClick` identity columns. All
  additive: `prisma db push` before deploy.

## Daily newsletter drafts (Beehiiv)

Every day at 11:00 UTC (4 AM PDT / 3 AM PST) `/api/newsletter/build` creates **two drafts** in
the FreeStockAlerts.AI Beehiiv publication so the morning job is opening Beehiiv and clicking Send.
Code lives in `lib/newsletter/`; the log is the `NewsletterIssue` table, shown at `/admin/issues`.

Each draft is one article plus copied ads:

- **Topic.** `topics.ts` pulls the latest stock-tagged headlines from FMP (`/news/stock-latest`),
  groups them by ticker inside a 30-hour window (72 on Mondays), drops press-release wires and
  law-firm solicitations, removes tickers covered in the last 14 days, and asks Claude
  (`claude-sonnet-5`) to pick one event per slot. The answer is re-checked in code (`checkPicks`)
  and the model gets one retry. Events from the last 60 days are shown to it as "already covered".
- **Article.** `article.ts` has Claude write a 350–500 word recap of what major outlets reported,
  with the `web_search` server tool so it reads the coverage, in a delimited text format
  (`HEADLINE:`, `SUBJECT:`, `SOURCE:` lines, `BODY:`). `validateArticle` enforces length,
  paragraphs of at most three sentences, two named sources, no markdown, and the compliance list
  (no "guaranteed", "risk-free", "secret", buy/sell advice, price predictions). One retry with the
  reason; a second failure still creates the draft, titled `[REVIEW] …` with an editor note on
  top, and the row is `needs_review`. Only a hard model failure leaves a slot `failed`.
- **Ads.** `tsiAds.ts` reads yesterday's two Smart Investor issues from the Beehiiv API
  (`expand[]=free_email_content`), matched by the date in their titles
  (`09/05/2026 - #1 - Advertiser (Creative)`; dedicated sends are ignored), and extracts the two
  sponsor tables (`border:1px solid #E5E0D5; background-color:#FAF8F3`) as-is, minus `<style>`
  tags and classes. Draft 1 gets issue #1's ads, draft 2 gets issue #2's. A missing issue or ad
  becomes a red placeholder line in the draft and a warning in the report; ads are never borrowed
  from the other slot. Our own `/admin/ads` snippets are skipped.
- **Draft.** `render.ts` builds native Beehiiv blocks (editable in the editor) for the article and
  `html` blocks for the ads: intro → ad 1 → headline → paragraphs → sources → ad 2 → disclaimer.
  `status: "draft"`, subject line and preview text set, tags `[TICKER, daily-brief]`.
  `renderMode: "html"` (`--html` in the script) sends one `body_content` document instead.
- **Report.** `report.ts` emails the run summary (drafts, Beehiiv links, ads found, review reasons,
  cost) to `NEWSLETTER_REPORT_TO`. Subject starts with `ACTION NEEDED` when a slot is flagged.

Operations:

```bash
set -a; source .env.local; set +a
npm run newsletter:build -- --spike          # inspect yesterday's Smart Investor HTML + create one throwaway draft
npm run newsletter:build -- --dry            # full pipeline, no Beehiiv write and no NewsletterIssue rows; previews in .newsletter-out/<date>/
npm run newsletter:build -- --live --force   # create today's drafts from a laptop
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.freestockalerts.ai/api/newsletter/build?dry=1"
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.freestockalerts.ai/api/newsletter/build?force=1&slot=2"
```

A slot that already has a draft is skipped unless `force=1` (the old draft stays in Beehiiv; the
report lists the new id). `/admin/issues` has Rebuild per row, Build today, and a pause toggle
(`AppSetting.newsletterBuildPaused`). Needs `BEEHIIV_API_KEY` with posts read + write (Create Post
is a Max/Enterprise feature), `ANTHROPIC_API_KEY` and `FMP_API_KEY`; the route returns 503
otherwise. Typical cost is a few cents per draft (`costUsd` on each row).

## How the alert loop works

1. `vercel.json` schedules `GET /api/alerts/check` every 5 minutes, 13:00–21:59 UTC, Mon–Fri.
2. The route exits early outside 9:30–16:00 ET.
3. It loads every `Alert` with `isActive = true`, fetches one quote per distinct ticker,
   and fetches RSI / SMA / earnings data only for tickers that have alerts of those types
   (`lib/alerts/evaluator.ts`).
4. Triggered alerts get descriptive context (`lib/alerts/context.ts`: position vs the 50- and
   200-day averages, volume vs the 30-session average, and for the sector ETFs the 21-session
   return vs SPY), a two-paragraph AI context (see below), an email (if the user's
   `emailAlerts` preference is on), an `AlertHistory` row with `emailSent`/`emailSentAt`, and a cooldown.

### AI context paragraphs

`lib/ai/alertContext.ts` gathers facts in code (the quote, the context lines, the strategy that
created the alert, and four cached FMP calls: recent headlines, analyst consensus, price-target
consensus, next and last earnings), renders them into a prompt, and asks Claude for exactly two
paragraphs of 120 to 180 words. The model is told to use only the facts given; output without a
paragraph break, under 60 words, or containing a banned phrase is replaced by a deterministic
fallback built from the same facts. No email is ever blocked on the model. Model, length targets
and prices live in `lib/ai/config.ts`. Signals from the daily scan get the same paragraphs, stored
in `StrategySignal.payload.aiContext`.

Cost at Haiku 4.5 list prices is about $0.003 per alert (about 1,300 input and 350 output
tokens); each call logs `[ai-context] TICKER model in= out= cost=`. To tune the prompt against
real output:

```bash
set -a; source .env.local; set +a
npm run preview:context -- NVDA "hits a new 52-week high" quality-breakout-radar
```

`ANTHROPIC_API_KEY` is required in Vercel for the model path; `OPENAI_API_KEY` is no longer read
and can be removed.
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
The `next-dev-testdb` entry in `.claude/launch.json` runs the dev server against that database, with
the Turnstile keys blanked and the form-notification recipients pointed at Resend's test sink
(`delivered@resend.dev`), so submissions are stored and the email path runs without a bot check and
without reaching a staff inbox; nothing local touches production data.

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
