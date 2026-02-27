# FreeStockAlerts.AI

A full-stack Next.js 14+ prototype for FreeStockAlerts.AI — a free stock alert platform with AI-powered context.

## Tech Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma (PostgreSQL)
- Supabase Auth (stubbed)
- Resend + Anthropic (stubbed)

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
cp .env.example .env.local
```

3. Generate Prisma client

```bash
npm run prisma:generate
```

4. Run the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Mock Data

All pages and API routes use mock data. Look for `// TODO: Replace with live API call` comments to wire up real integrations.

## Prisma Seed

The seed script creates the five alert templates:

```bash
npm run prisma:seed
```

## Project Structure

See `BUILD_SPEC.md` for the full build specification, data model, and page requirements.
