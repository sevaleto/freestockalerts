# FreeStockAlerts.AI — Full Build Instructions for Claudius

## PROJECT OVERVIEW

Build a complete, deployable web application for **FreeStockAlerts.AI** — a 100% free stock alerts platform. Users sign up with just an email address and get access to real-time stock price alerts with AI-powered context. No credit card. No paid tiers. No upsells. The business model is lead generation (we monetize the email list separately through newsletter sponsorships), so the product itself must be genuinely free and genuinely good.

**The competitor we're improving on:** https://stockalarm.io/ — a paid stock alerts platform with 295K+ users. They charge for premium features. We don't. They offer blank-canvas alert creation. We also offer curated "Alert Templates" that users can activate with one click. They send raw price notifications. We send AI-enhanced alerts with plain-English context explaining WHY the alert matters.

---

## TECH STACK

Use the following stack. Do not deviate unless you hit a blocking issue, in which case document why you switched.

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 14+ (App Router) | Full-stack React, API routes, SSR, easy deployment |
| **Language** | TypeScript | Type safety across frontend and backend |
| **Styling** | Tailwind CSS | Fast UI development, consistent design |
| **Database** | PostgreSQL via Supabase | Free tier is generous, built-in auth, real-time subscriptions |
| **ORM** | Prisma | Type-safe database queries |
| **Auth** | Supabase Auth (email magic link) | No passwords to manage, frictionless signup |
| **Stock Data API** | Financial Modeling Prep (FMP) API | Free tier: 250 req/day. Covers quotes, earnings calendar, technicals |
| **Backup Data API** | Alpha Vantage (free tier) | 25 req/day fallback for when FMP quota is hit |
| **Alert Delivery** | Email via Resend (free tier: 100 emails/day for dev) | Clean API, great deliverability |
| **AI Summaries** | Anthropic Claude API (claude-sonnet-4-5-20250929) | Generate plain-English alert context |
| **Job Scheduling** | node-cron (in-process) or Vercel Cron | Price checking loops and alert evaluation |
| **Deployment** | Vercel | Free tier, automatic from GitHub, edge functions |
| **Domain** | FreeStockAlerts.AI | Already purchased |

### API Keys You'll Need (use environment variables)

```env
# .env.local template
DATABASE_URL=                      # Supabase PostgreSQL connection string
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase public anon key
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service role key (server-side only)
FMP_API_KEY=                       # Financial Modeling Prep API key
ALPHA_VANTAGE_API_KEY=             # Alpha Vantage API key (backup)
ANTHROPIC_API_KEY=                 # Claude API key for AI summaries
RESEND_API_KEY=                    # Resend email API key
NEXT_PUBLIC_APP_URL=               # https://freestockalerts.ai
```

**NOTE:** For the initial build, stub out all API integrations with mock data so the full UI and flow works end-to-end. Use clearly marked `// TODO: Replace with live API call` comments. This lets us test the complete UX before wiring up paid APIs.

---

## DATABASE SCHEMA

Create the following Prisma schema. This is the core data model — do not skip any table.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  firstName       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  emailVerified   Boolean   @default(false)
  alertsCount     Int       @default(0)   // denormalized for quick checks
  maxAlerts       Int       @default(50)  // generous free limit
  alerts          Alert[]
  templateSubs    TemplateSubscription[]
  preferences     UserPreferences?
}

model UserPreferences {
  id                  String   @id @default(cuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  emailAlerts         Boolean  @default(true)
  dailyDigest         Boolean  @default(false)
  digestTime          String   @default("08:00")  // HH:MM in user's timezone
  timezone            String   @default("America/New_York")
  marketOpenReminder  Boolean  @default(false)
  marketCloseReminder Boolean  @default(false)
}

model Alert {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  ticker          String      // e.g., "AAPL"
  companyName     String?     // e.g., "Apple Inc."
  alertType       AlertType
  triggerValue    Float       // the threshold value
  triggerDirection TriggerDirection  // ABOVE or BELOW
  currentPrice    Float?      // last known price (updated on check)
  isActive        Boolean     @default(true)
  isTriggered     Boolean     @default(false)
  triggeredAt     DateTime?
  lastCheckedAt   DateTime?
  cooldownMinutes Int         @default(20)  // don't re-alert within this window
  note            String?     // user's personal note
  templateId      String?     // if created from a template
  template        AlertTemplate? @relation(fields: [templateId], references: [id])
  history         AlertHistory[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([userId, isActive])
  @@index([ticker, isActive])
  @@index([isActive, isTriggered])
}

model AlertHistory {
  id              String    @id @default(cuid())
  alertId         String
  alert           Alert     @relation(fields: [alertId], references: [id], onDelete: Cascade)
  triggeredAt     DateTime  @default(now())
  priceAtTrigger  Float
  aiSummary       String?   // AI-generated context (2-3 sentences)
  emailSent       Boolean   @default(false)
  emailSentAt     DateTime?
}

model AlertTemplate {
  id              String    @id @default(cuid())
  name            String    // e.g., "Earnings Season Alerts"
  slug            String    @unique  // URL-friendly name
  description     String    // what this template does
  longDescription String?   // detailed explanation for template detail page
  category        TemplateCategory
  iconEmoji       String    @default("📊")
  isActive        Boolean   @default(true)
  isFeatured      Boolean   @default(false)
  sortOrder       Int       @default(0)
  alerts          Alert[]
  items           TemplateItem[]
  subscriptions   TemplateSubscription[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model TemplateItem {
  id              String        @id @default(cuid())
  templateId      String
  template        AlertTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  ticker          String
  companyName     String?
  alertType       AlertType
  triggerValue    Float
  triggerDirection TriggerDirection
  rationale       String?       // why this alert is in the template
  sortOrder       Int           @default(0)
}

model TemplateSubscription {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  templateId    String
  template      AlertTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  isActive      Boolean       @default(true)
  subscribedAt  DateTime      @default(now())

  @@unique([userId, templateId])
}

enum AlertType {
  PRICE_ABOVE          // price crosses above target
  PRICE_BELOW          // price crosses below target
  PERCENT_CHANGE_DAY   // % change from open exceeds threshold
  PERCENT_CHANGE_CUSTOM // % change from alert creation price
  VOLUME_SPIKE         // volume exceeds X times 20-day avg
  RSI_OVERBOUGHT       // RSI crosses above threshold (default 70)
  RSI_OVERSOLD         // RSI crosses below threshold (default 30)
  SMA_CROSS_ABOVE      // price crosses above SMA
  SMA_CROSS_BELOW      // price crosses below SMA
  FIFTY_TWO_WEEK_HIGH  // new 52-week high
  FIFTY_TWO_WEEK_LOW   // new 52-week low
  EARNINGS_REMINDER    // X days before earnings
  PRICE_RECOVERY       // price returns to level after dropping X%
}

enum TriggerDirection {
  ABOVE
  BELOW
  BOTH
}

enum TemplateCategory {
  EARNINGS
  VALUE_INVESTING
  MOMENTUM
  DIVIDEND
  MACRO
  AI_PICKS
}
```

---

## PAGE STRUCTURE & ROUTES

Build these pages using Next.js App Router (`/app` directory):

### Public Pages (no auth required)

```
/                       → Landing page / homepage
/login                  → Email login / signup (magic link)
/about                  → About page (brief, builds trust)
/templates              → Browse all alert templates (public preview)
/templates/[slug]       → Individual template detail page (public preview)
/blog                   → Blog listing (placeholder for now, just create the page structure)
```

### Protected Pages (auth required)

```
/dashboard              → Main dashboard — active alerts, triggered alerts, quick stats
/dashboard/alerts       → Full alert management — create, edit, delete, view history
/dashboard/alerts/new   → Create new custom alert form
/dashboard/templates    → Browse & subscribe to alert templates
/dashboard/history      → Full alert trigger history with AI summaries
/dashboard/settings     → Account settings, notification preferences, timezone
```

### API Routes

```
/api/auth/callback      → Supabase auth callback handler
/api/alerts             → CRUD for user alerts (GET, POST)
/api/alerts/[id]        → Individual alert (GET, PUT, DELETE)
/api/alerts/check       → Cron endpoint: check all active alerts against current prices
/api/templates          → GET all active templates
/api/templates/[slug]   → GET template details with items
/api/templates/[slug]/subscribe → POST to subscribe (creates alerts from template items)
/api/templates/[slug]/unsubscribe → POST to unsubscribe (deactivates template alerts)
/api/quotes/[ticker]    → GET current quote for a ticker (proxies to FMP)
/api/quotes/search      → GET ticker search/autocomplete
/api/ai/summary         → POST generate AI summary for a triggered alert
```

---

## DETAILED PAGE SPECIFICATIONS

### 1. Landing Page (`/`)

This is the most important page. It must convert visitors to signups. Design it as a modern, clean, single-page marketing site.

**Hero Section:**
- Headline: "Free Stock Alerts. Forever." (large, bold)
- Subheadline: "Get real-time price alerts with AI-powered insights delivered to your inbox. No credit card. No paid tiers. Just sign up and go."
- Single email input field with "Get Started Free →" button
- Below the input: "Join [X] traders already using FreeStockAlerts" (use 0 for now, we'll update)
- Background: subtle animated gradient or stock chart pattern (keep it clean, not busy)

**"How It Works" Section (3 steps):**
1. "Sign up with your email" — icon: envelope
2. "Set alerts or activate a template" — icon: bell with plus
3. "Get notified with AI-powered context" — icon: brain/sparkle

**Feature Highlights Section:**
- "125+ Alert Types" — Price, %, SMA, EMA, RSI, MACD, Volume, Earnings, 52-week highs/lows
- "AI-Powered Summaries" — Every alert comes with a plain-English explanation of why it matters
- "One-Click Templates" — Pre-built alert strategies: Earnings Season, Value Investing, Momentum, Dividends, Market Macro
- "Actually Free" — No trials. No freemium bait. No credit card. Free forever.

**Template Preview Section:**
- Show 3-4 featured templates as cards with name, emoji, description, and "Preview →" link
- Each card should look activatable/clickable

**Social Proof Section:**
- Placeholder for testimonials (use 3 placeholder cards for now)
- Design them to match the style of StockAlarm's testimonial carousel but with our branding

**Final CTA Section:**
- "Ready to stop missing trades?" 
- Another email signup form
- "Free forever. Unsubscribe anytime."

**Footer:**
- Links: About, Templates, Blog, Contact, Privacy Policy, Terms of Service
- "© 2026 FreeStockAlerts.AI — Built for traders, by traders."
- Social links (placeholder hrefs)

### 2. Login / Signup Page (`/login`)

- Clean, centered card layout
- "Welcome to FreeStockAlerts" heading
- Email input + "Send Magic Link" button
- After submission: "Check your inbox! We sent you a login link."
- Small text: "No password needed. We'll email you a secure login link every time."
- Link back to homepage

### 3. Dashboard (`/dashboard`)

This is where users spend most of their time. Use a sidebar layout.

**Sidebar Navigation:**
- FreeStockAlerts.AI logo at top
- Dashboard (home icon)
- My Alerts (bell icon)
- Templates (grid icon)
- Alert History (clock icon)
- Settings (gear icon)
- Divider
- "Sign Out" at bottom

**Dashboard Main Content:**
- **Stats Row** (4 cards):
  - Active Alerts: [count] / [max]
  - Triggered Today: [count]
  - Templates Active: [count]
  - Alerts Fired (All Time): [count]

- **Recent Triggered Alerts** (last 5):
  - Each shows: ticker, company name, alert type, trigger price, current price, time triggered, and the AI summary snippet (truncated to 2 lines)
  - "View All →" link to history page

- **Quick Actions:**
  - "Create New Alert" button (primary)
  - "Browse Templates" button (secondary)

- **Your Active Alerts** (compact table/list, first 10):
  - Ticker | Type | Target | Current Price | Status | Actions (edit/delete/pause)
  - "View All Alerts →" link

### 4. Create Alert Page (`/dashboard/alerts/new`)

This is the core interaction. Make it intuitive.

**Step 1: Ticker Search**
- Large search input with autocomplete
- As user types, show matching tickers with company name and current price
- Use the `/api/quotes/search` endpoint
- On selection, show a mini quote card: ticker, company name, current price, day change, day % change

**Step 2: Choose Alert Type**
- Categorized grid of alert types (show as selectable cards, not a dropdown):
  - **Price Alerts:** Price Above, Price Below
  - **Change Alerts:** % Change (Day), % Change (Custom)
  - **Technical:** RSI Overbought, RSI Oversold, SMA Cross Above, SMA Cross Below
  - **Volume:** Volume Spike
  - **Milestones:** 52-Week High, 52-Week Low
  - **Events:** Earnings Reminder
- Each card has: icon, name, 1-line description

**Step 3: Set Threshold**
- Dynamic form based on alert type selected
- For price alerts: simple number input with current price shown for reference
- For % change: percentage input with slider
- For RSI: number input (default 70 for overbought, 30 for oversold), show current RSI value
- For SMA: period selector (20, 50, 100, 200 day), show current SMA value
- For volume: multiplier input (default 2x), show current avg volume
- For earnings: days-before selector (1, 3, 5, 7, 14 days)

**Step 4: Notification Settings**
- Email notification toggle (default ON)
- Cooldown period selector: 20 min, 1 hour, 4 hours, 1 day
- Optional note field: "Add a personal note (e.g., 'Buy zone' or 'Take profits here')"

**Step 5: Review & Create**
- Summary card showing all selections
- "Create Alert" button
- After creation: success toast + redirect to dashboard

### 5. Templates Page (`/dashboard/templates`)

- Grid of template cards (2-3 columns)
- Each card shows: emoji icon, template name, description, number of alerts in template, number of users subscribed (placeholder), and "Activate" / "Deactivate" toggle
- Clicking card name opens template detail modal or page showing all individual alerts in the template with their rationale

### 6. Alert History Page (`/dashboard/history`)

- Chronological list (newest first) of all triggered alerts
- Each entry: date/time, ticker, alert type, trigger price, price at trigger, and full AI summary
- Filter by: ticker, alert type, date range
- Pagination (20 per page)

### 7. Settings Page (`/dashboard/settings`)

- Email address (read-only, shown for reference)
- First name (editable)
- Timezone selector (dropdown of common US timezones + UTC)
- Notification preferences:
  - Email alerts: on/off
  - Daily digest: on/off (if on, show time picker)
  - Market open reminder: on/off
  - Market close reminder: on/off
- "Delete Account" button (with confirmation modal)

---

## SEED DATA FOR TEMPLATES

Pre-populate the database with these 5 templates. Create a seed script (`prisma/seed.ts`).

### Template 1: "Earnings Season Alerts" 🎯

**Category:** EARNINGS
**Description:** "Get alerted before and during earnings for the market's most-watched stocks. Never get blindsided by an earnings surprise again."

**Items (seed with current approximate prices — we'll update live):**

| Ticker | Alert Type | Direction | Value | Rationale |
|--------|-----------|-----------|-------|-----------|
| AAPL | EARNINGS_REMINDER | BOTH | 3 | "3 days before Apple earnings — review your position" |
| NVDA | EARNINGS_REMINDER | BOTH | 3 | "3 days before NVIDIA earnings — the most-watched AI stock" |
| TSLA | EARNINGS_REMINDER | BOTH | 3 | "3 days before Tesla earnings — expect volatility" |
| META | EARNINGS_REMINDER | BOTH | 3 | "3 days before Meta earnings — ad revenue is key metric" |
| AMZN | EARNINGS_REMINDER | BOTH | 3 | "3 days before Amazon earnings — watch AWS growth" |
| MSFT | EARNINGS_REMINDER | BOTH | 3 | "3 days before Microsoft earnings — Azure and AI focus" |
| GOOGL | EARNINGS_REMINDER | BOTH | 3 | "3 days before Alphabet earnings — search and cloud" |
| AAPL | PERCENT_CHANGE_DAY | BOTH | 5 | "AAPL moves 5%+ on earnings day — big move alert" |
| NVDA | PERCENT_CHANGE_DAY | BOTH | 7 | "NVDA moves 7%+ on earnings day — big move alert" |
| TSLA | PERCENT_CHANGE_DAY | BOTH | 7 | "TSLA moves 7%+ on earnings day — big move alert" |

### Template 2: "Buffett-Style Value Watchlist" 💰

**Category:** VALUE_INVESTING
**Description:** "Alerts set at historically attractive entry points for high-quality blue chip companies. Inspired by Warren Buffett's value investing principles."

**Items:**

| Ticker | Alert Type | Direction | Value | Rationale |
|--------|-----------|-----------|-------|-----------|
| BRK-B | PRICE_BELOW | BELOW | 480 | "Berkshire below $480 — historically attractive P/B ratio" |
| AAPL | PRICE_BELOW | BELOW | 200 | "Apple below $200 — potential value zone based on earnings yield" |
| KO | PRICE_BELOW | BELOW | 58 | "Coca-Cola below $58 — dividend yield crosses above 3.2%" |
| JNJ | PRICE_BELOW | BELOW | 148 | "J&J below $148 — quality healthcare at a discount" |
| PG | PRICE_BELOW | BELOW | 160 | "P&G below $160 — defensive staple at attractive yield" |
| JPM | PRICE_BELOW | BELOW | 230 | "JPMorgan below $230 — bank leader at value pricing" |
| V | PRICE_BELOW | BELOW | 290 | "Visa below $290 — payments duopoly at a reasonable multiple" |
| OXY | PRICE_BELOW | BELOW | 48 | "Occidental below $48 — Buffett's been buying aggressively" |
| AMZN | PRICE_BELOW | BELOW | 190 | "Amazon below $190 — AWS margin expansion story at a discount" |
| BAC | PRICE_BELOW | BELOW | 38 | "Bank of America below $38 — Buffett's largest bank position" |

### Template 3: "Momentum Breakout Alerts" 🚀

**Category:** MOMENTUM
**Description:** "Catch stocks breaking to new highs with strong volume. Designed for swing traders who want to ride momentum."

**Items:**

| Ticker | Alert Type | Direction | Value | Rationale |
|--------|-----------|-----------|-------|-----------|
| NVDA | FIFTY_TWO_WEEK_HIGH | ABOVE | 0 | "NVDA hits new 52-week high — AI momentum continues" |
| META | FIFTY_TWO_WEEK_HIGH | ABOVE | 0 | "META breaks out to new high — ad business firing" |
| NFLX | FIFTY_TWO_WEEK_HIGH | ABOVE | 0 | "Netflix at new highs — streaming dominance" |
| AMZN | FIFTY_TWO_WEEK_HIGH | ABOVE | 0 | "Amazon breaks out — watch for continuation" |
| TSLA | VOLUME_SPIKE | ABOVE | 2 | "Tesla volume 2x+ average — something is happening" |
| NVDA | VOLUME_SPIKE | ABOVE | 2.5 | "NVDA volume 2.5x+ average — institutional interest" |
| AAPL | RSI_OVERSOLD | BELOW | 30 | "Apple RSI below 30 — oversold bounce opportunity" |
| MSFT | RSI_OVERSOLD | BELOW | 30 | "Microsoft RSI below 30 — potential bottom" |
| AMD | FIFTY_TWO_WEEK_HIGH | ABOVE | 0 | "AMD new 52-week high — chip sector strength" |
| AVGO | FIFTY_TWO_WEEK_HIGH | ABOVE | 0 | "Broadcom breakout — AI infrastructure play" |

### Template 4: "Dividend Income Watchlist" 📈

**Category:** DIVIDEND
**Description:** "Track high-quality dividend stocks. Get alerted when prices drop to levels where yield becomes extra attractive."

**Items:**

| Ticker | Alert Type | Direction | Value | Rationale |
|--------|-----------|-----------|-------|-----------|
| O | PRICE_BELOW | BELOW | 52 | "Realty Income below $52 — monthly dividend yield above 6%" |
| VZ | PRICE_BELOW | BELOW | 38 | "Verizon below $38 — yield crosses above 7%" |
| T | PRICE_BELOW | BELOW | 22 | "AT&T below $22 — yield above 5% after restructuring" |
| ABBV | PRICE_BELOW | BELOW | 170 | "AbbVie below $170 — pharma cash cow at attractive yield" |
| XOM | PRICE_BELOW | BELOW | 105 | "ExxonMobil below $105 — energy dividend champion" |
| SCHD | PRICE_BELOW | BELOW | 26 | "Schwab Dividend ETF below $26 — diversified income at a discount" |
| PEP | PRICE_BELOW | BELOW | 155 | "PepsiCo below $155 — 51-year dividend growth streak" |
| MO | PRICE_BELOW | BELOW | 52 | "Altria below $52 — high yield defensive stock" |
| KO | SMA_CROSS_BELOW | BELOW | 50 | "Coca-Cola drops below 50-day SMA — potential buying opportunity" |
| JNJ | SMA_CROSS_BELOW | BELOW | 200 | "J&J below 200-day SMA — rare long-term entry signal" |

### Template 5: "Market Fear & Greed Signals" 🌡️

**Category:** MACRO
**Description:** "Macro-level alerts that tell you when something big is happening in the market. Essential for any investor."

**Items:**

| Ticker | Alert Type | Direction | Value | Rationale |
|--------|-----------|-----------|-------|-----------|
| VIX | PRICE_ABOVE | ABOVE | 25 | "VIX above 25 — fear is elevated, markets are nervous" |
| VIX | PRICE_ABOVE | ABOVE | 35 | "VIX above 35 — extreme fear, historically a buying opportunity" |
| VIX | PRICE_BELOW | BELOW | 13 | "VIX below 13 — extreme complacency, consider hedging" |
| SPY | PERCENT_CHANGE_DAY | BOTH | 2 | "S&P 500 moves 2%+ in a day — significant market event" |
| QQQ | PERCENT_CHANGE_DAY | BOTH | 3 | "Nasdaq moves 3%+ in a day — tech sector volatility" |
| TLT | PERCENT_CHANGE_DAY | BOTH | 2 | "Long-term bonds move 2%+ — interest rate shock" |
| GLD | FIFTY_TWO_WEEK_HIGH | ABOVE | 0 | "Gold hits new 52-week high — flight to safety signal" |
| DXY | PRICE_ABOVE | ABOVE | 110 | "Dollar index above 110 — strong dollar stress" |
| IWM | SMA_CROSS_BELOW | BELOW | 200 | "Russell 2000 below 200-day SMA — small caps in trouble" |
| SPY | SMA_CROSS_BELOW | BELOW | 200 | "S&P 500 below 200-day SMA — major bearish signal" |

---

## AI SUMMARY SYSTEM

When an alert triggers, generate a 2-3 sentence plain-English context summary. This is our killer differentiator.

### Implementation

Create a utility function at `lib/ai/generateAlertSummary.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

interface AlertContext {
  ticker: string;
  companyName: string;
  alertType: string;
  triggerValue: number;
  currentPrice: number;
  priceAtTrigger: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  nextEarningsDate?: string;
  dayChangePercent: number;
}

export async function generateAlertSummary(context: AlertContext): Promise<string> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 200,
    system: `You are a concise stock market analyst writing alert notifications for retail traders. 
Write exactly 2-3 sentences explaining why this alert matters. Be factual, specific, and actionable. 
Never give buy/sell recommendations. Never use phrases like "This could mean" or hedge excessively. 
Just state what happened, add relevant context (volume, proximity to 52-week range, upcoming events), 
and note what experienced traders typically watch for in this situation. 
Keep it under 50 words.`,
    messages: [
      {
        role: "user",
        content: `Alert triggered for ${context.ticker} (${context.companyName}):
- Alert type: ${context.alertType}
- Trigger value: $${context.triggerValue}
- Price at trigger: $${context.priceAtTrigger}
- Today's range: $${context.dayLow} - $${context.dayHigh} (opened at $${context.dayOpen})
- Day change: ${context.dayChangePercent > 0 ? "+" : ""}${context.dayChangePercent.toFixed(2)}%
- Volume: ${context.volume.toLocaleString()} (avg: ${context.avgVolume.toLocaleString()})
- 52-week range: $${context.fiftyTwoWeekLow} - $${context.fiftyTwoWeekHigh}
${context.nextEarningsDate ? `- Next earnings: ${context.nextEarningsDate}` : ""}

Write 2-3 sentences of context for this alert.`,
      },
    ],
  });

  // Extract text from response
  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock?.text ?? "Alert triggered. Check current market conditions for context.";
}
```

### Example Output

For an alert "AAPL crossed above $230":

> "AAPL broke above $230 on 1.6x average volume, now trading within 3% of its 52-week high of $237. Earnings are 18 days away. Traders typically watch whether breakouts near all-time highs hold into earnings or fade on profit-taking."

---

## ALERT EMAIL TEMPLATE

When an alert fires, send an email via Resend. Create the email template at `lib/email/alertEmail.tsx` using React Email (Resend supports it):

**Subject line format:** `🔔 {TICKER} Alert: {alert type description}`

**Email body structure:**
1. FreeStockAlerts.AI logo/text header
2. Alert headline: "{TICKER} — {Alert Type} Triggered"
3. Key data: Current price, trigger price, day change %, volume
4. AI Summary section (boxed/highlighted): The generated 2-3 sentence context
5. "View Alert Details →" button linking to /dashboard/history
6. Mini-footer: "You're receiving this because you set an alert for {TICKER} on FreeStockAlerts.AI. Manage your alerts: {link}"

Keep the email clean, fast-loading, and mobile-responsive. Use a maximum of 2 colors (dark text + one accent color, use #2563EB blue).

---

## DESIGN SYSTEM

### Colors

```
Primary:         #2563EB (blue-600)
Primary Hover:   #1D4ED8 (blue-700)
Success:         #16A34A (green-600)
Warning:         #D97706 (amber-600)
Danger:          #DC2626 (red-600)
Background:      #FFFFFF (white)
Surface:         #F8FAFC (slate-50)
Border:          #E2E8F0 (slate-200)
Text Primary:    #0F172A (slate-900)
Text Secondary:  #64748B (slate-500)
Text Muted:      #94A3B8 (slate-400)
```

### Typography

- Headings: Inter (or system font stack as fallback)
- Body: Inter
- Monospace (for prices/numbers): JetBrains Mono or monospace

### Design Principles

1. **Clean and minimal** — lots of whitespace, no clutter
2. **Data-forward** — prices, changes, and percentages should be prominent
3. **Color-coded changes** — green for up, red for down, always
4. **Mobile-first** — dashboard must work perfectly on phones
5. **Fast** — no heavy animations, no unnecessary images
6. **Trust signals** — emphasize "Free forever" and "No credit card" throughout

### Component Library

Use shadcn/ui components where possible. Install the following at minimum:
- Button, Input, Card, Badge, Dialog, Dropdown Menu, Table, Tabs, Toast, Tooltip, Avatar, Separator, Sheet (for mobile sidebar), Command (for ticker search autocomplete), Select, Switch, Skeleton (for loading states)

---

## CRITICAL IMPLEMENTATION DETAILS

### Ticker Search Autocomplete

The alert creation form needs a fast ticker search. Use FMP's search endpoint:
`https://financialmodelingprep.com/api/v3/search?query={query}&limit=10&apikey={key}`

For the mock/development version, create a local JSON file with the top 500 US stocks (ticker + company name) and filter client-side.

### Price Checking Logic

Create a cron job (`/api/alerts/check`) that:
1. Fetches all unique tickers from active alerts
2. Batch-fetches current prices (FMP batch quote endpoint)
3. Evaluates each alert against current price
4. For triggered alerts: marks as triggered, generates AI summary, sends email
5. Respects cooldown period (don't re-trigger within cooldown window)

For development, this should be callable manually via a button in the UI or via direct API call.

### Rate Limiting Considerations

FMP free tier is 250 requests/day. Optimize by:
- Batching ticker lookups (up to 5 tickers per request with FMP)
- Caching prices for 60 seconds
- Only checking during market hours (9:30 AM - 4:00 PM ET, Monday-Friday)
- Using Alpha Vantage as fallback when FMP quota is hit

### Error Handling

- All API routes should return proper HTTP status codes and JSON error bodies
- Client-side forms should show validation errors inline
- Failed alert checks should log errors but not crash the cron job
- Failed email sends should be retried once, then logged as failed

---

## FILE STRUCTURE

```
freestockalerts/
├── app/
│   ├── layout.tsx                   # Root layout with providers
│   ├── page.tsx                     # Landing page
│   ├── login/
│   │   └── page.tsx                 # Login/signup
│   ├── about/
│   │   └── page.tsx                 # About page
│   ├── templates/
│   │   ├── page.tsx                 # Public template browse
│   │   └── [slug]/
│   │       └── page.tsx             # Public template detail
│   ├── dashboard/
│   │   ├── layout.tsx               # Dashboard layout with sidebar
│   │   ├── page.tsx                 # Dashboard home
│   │   ├── alerts/
│   │   │   ├── page.tsx             # Alert management
│   │   │   └── new/
│   │   │       └── page.tsx         # Create alert
│   │   ├── templates/
│   │   │   └── page.tsx             # Template subscriptions
│   │   ├── history/
│   │   │   └── page.tsx             # Alert history
│   │   └── settings/
│   │       └── page.tsx             # User settings
│   └── api/
│       ├── auth/
│       │   └── callback/
│       │       └── route.ts
│       ├── alerts/
│       │   ├── route.ts             # GET all, POST new
│       │   ├── [id]/
│       │   │   └── route.ts         # GET, PUT, DELETE one
│       │   └── check/
│       │       └── route.ts         # Cron: check alerts
│       ├── templates/
│       │   ├── route.ts             # GET all templates
│       │   └── [slug]/
│       │       ├── route.ts         # GET template details
│       │       ├── subscribe/
│       │       │   └── route.ts     # POST subscribe
│       │       └── unsubscribe/
│       │           └── route.ts     # POST unsubscribe
│       ├── quotes/
│       │   ├── [ticker]/
│       │   │   └── route.ts         # GET quote
│       │   └── search/
│       │       └── route.ts         # GET search
│       └── ai/
│           └── summary/
│               └── route.ts         # POST generate summary
├── components/
│   ├── ui/                          # shadcn components
│   ├── landing/                     # Landing page sections
│   │   ├── Hero.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Features.tsx
│   │   ├── TemplatePreview.tsx
│   │   ├── Testimonials.tsx
│   │   └── FinalCTA.tsx
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── StatsRow.tsx
│   │   ├── AlertCard.tsx
│   │   ├── AlertTable.tsx
│   │   ├── TemplateCard.tsx
│   │   ├── TickerSearch.tsx
│   │   ├── AlertTypeSelector.tsx
│   │   ├── ThresholdForm.tsx
│   │   └── AlertHistoryItem.tsx
│   ├── email/
│   │   └── AlertEmail.tsx           # React Email template
│   └── shared/
│       ├── Logo.tsx
│       ├── PriceDisplay.tsx         # Formatted price with color
│       ├── PercentBadge.tsx         # +2.5% green / -1.3% red badge
│       └── TickerBadge.tsx          # Styled ticker symbol
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   ├── server.ts               # Server client
│   │   └── middleware.ts            # Auth middleware
│   ├── prisma/
│   │   └── client.ts               # Prisma client singleton
│   ├── api/
│   │   ├── fmp.ts                   # Financial Modeling Prep API wrapper
│   │   ├── alphaVantage.ts          # Alpha Vantage API wrapper
│   │   └── quotes.ts               # Unified quote fetcher with caching & fallback
│   ├── ai/
│   │   └── generateAlertSummary.ts  # Claude API integration
│   ├── email/
│   │   └── sendAlertEmail.ts        # Resend integration
│   ├── alerts/
│   │   └── evaluator.ts            # Alert evaluation logic
│   ├── utils/
│   │   ├── formatters.ts            # Price, percent, volume formatters
│   │   ├── marketHours.ts           # Is market open? Next open/close?
│   │   └── constants.ts             # App-wide constants
│   └── mock/
│       ├── quotes.ts                # Mock price data for development
│       ├── tickers.ts               # Top 500 tickers for search
│       └── templates.ts             # Mock template data
├── prisma/
│   ├── schema.prisma                # Database schema (see above)
│   └── seed.ts                      # Seed templates
├── public/
│   ├── og-image.png                 # Open Graph social sharing image (create a simple one)
│   └── favicon.ico
├── .env.local                       # Environment variables (template)
├── .env.example                     # Example env file for documentation
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## BUILD ORDER (FOLLOW THIS SEQUENCE)

This is the order you should build things in. Complete each step fully before moving to the next.

### Phase 1: Project Setup
1. Initialize Next.js project with TypeScript and Tailwind
2. Install all dependencies (see package.json below)
3. Set up shadcn/ui with the components listed above
4. Create the file structure
5. Set up Prisma with the schema above
6. Create the `.env.example` file

### Phase 2: Mock Data Layer
7. Create mock data files (tickers, quotes, templates)
8. Create the mock API functions that return static data
9. Create utility functions (formatters, market hours, constants)

### Phase 3: Landing Page
10. Build the landing page with all sections
11. Build the login page
12. Build the about page
13. Make sure responsive design works on mobile

### Phase 4: Dashboard Shell
14. Build the dashboard layout with sidebar
15. Build the dashboard home page with stats and recent alerts
16. Build the settings page

### Phase 5: Alert System UI
17. Build the create alert page with ticker search and type selector
18. Build the alerts management page (list, edit, delete)
19. Build the alert history page

### Phase 6: Templates UI
20. Build the public templates browse page
21. Build the public template detail page
22. Build the dashboard templates page with subscribe/unsubscribe

### Phase 7: API Routes
23. Build all alert CRUD API routes
24. Build template API routes
25. Build quote/search API routes (using mock data initially)
26. Build the AI summary API route (stub that returns placeholder text)

### Phase 8: Alert Evaluation Engine
27. Build the alert evaluator logic
28. Build the alert check cron API route
29. Build the email template and send function

### Phase 9: Database Seeding
30. Create and run the seed script for templates

### Phase 10: Polish
31. Add loading states (Skeleton components) to all data-fetching pages
32. Add error states and empty states
33. Add proper meta tags, OG image, favicon
34. Create README.md with setup instructions
35. Do a final review pass on all pages for consistency

---

## PACKAGE.JSON DEPENDENCIES

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "@prisma/client": "^5.19.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "resend": "^4.0.0",
    "@react-email/components": "^0.0.25",
    "node-cron": "^3.0.3",
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.0",
    "zod": "^3.23.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.4.0",
    "lucide-react": "^0.441.0",
    "cmdk": "^1.0.0",
    "next-themes": "^0.3.0",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "@types/node": "^22.0.0",
    "prisma": "^5.19.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/node-cron": "^3.0.11",
    "ts-node": "^10.9.0"
  }
}
```

---

## WHAT SUCCESS LOOKS LIKE

When you're done, I should be able to:

1. Run `npm run dev` and see the full landing page at localhost:3000
2. Click "Get Started" and go to a login page
3. Navigate to /dashboard and see the full dashboard UI with mock data
4. Create a new alert with ticker search, type selection, and threshold setting
5. Browse templates and see all 5 pre-built templates with their alerts
6. View alert history with placeholder AI summaries
7. Update settings
8. See that all pages are responsive on mobile
9. See that all the API routes exist and return structured JSON (even if using mock data)

The app should be a complete, polished, clickable prototype that demonstrates the full user experience. Every page should look professional and feel like a real product. The only things that won't work yet are live price data, real email sending, and actual auth — those require API keys that we'll add after the build.

---

## FINAL NOTES

- **Do not cut corners on the landing page.** It's our conversion engine. Make it look world-class.
- **Do not skip mobile responsiveness.** Test every page at 375px width.
- **Use placeholder/mock data everywhere.** I repeat: do NOT try to hit live APIs without the env keys being configured. Use realistic mock data.
- **Write clean, well-commented code.** I will be reading and modifying this.
- **If you get stuck on something, skip it with a TODO comment and move on.** Momentum matters more than perfection on the first pass.
- **Commit progress frequently** if you have git access. At minimum, ensure the project is in a runnable state when you finish.

Good luck, Claudius. Build me something great. 🚀
