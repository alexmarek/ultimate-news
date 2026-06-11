# Ultimate News

A curated news aggregator collecting articles from 23 sources across 6 categories, with visual card-based layout and pagination.

## Features

- **23 news sources** across World, Technology, Politics, Business, Environment, and Music
- **18 articles per page** — 3 from each category, paginated
- **Search & filter** by keyword or category via URL params
- **Image proxy** for hotlink-protected sources (Blabbermouth etc.)
- **RSS ingest** with auto-discovery of missing feeds, og:image fallback
- **Tailwind v4** with custom lemon-lime color scheme, Inter font, responsive grid

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma ORM** (PostgreSQL in production, SQLite for local dev)
- **Deployment**: Vercel

## Getting Started

```bash
# Install dependencies
yarn install

# Set up environment
cp .env.example .env.local
# Edit .env.local — for local dev with SQLite use:
#   DATABASE_URL="file:./dev.db"

# Generate Prisma client
npx prisma generate

# Push schema
npx prisma db push

# Seed with 23 sources
yarn seed

# Start dev server
yarn dev
```

### Fetch articles

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "x-cron-secret: <INGEST_CRON_SECRET>"
```

### Backfill images for articles without them

```bash
curl -X POST http://localhost:3000/api/images \
  -H "x-cron-secret: <INGEST_CRON_SECRET>"
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Database connection string |
| `DIRECT_URL` | Direct connection (for Prisma migrations) |
| `INGEST_CRON_SECRET` | Shared secret to authenticate ingest requests |
| `CRON_SECRET` | Vercel Cron Bearer token (matches ingest auth) |
| `ANTHROPIC_API_KEY` | (optional) Anthropic API key for AI enrichment |
| `VOYAGE_API_KEY` | (optional) Voyage AI key for embeddings |
| `NEXT_PUBLIC_APP_URL` | Public app URL (fallback for cron self-call) |

`VERCEL_URL` is auto-set by Vercel at deploy time.

## Project Structure

```
ultimate-news/
├── app/
│   ├── api/
│   │   ├── cron/      # Vercel Cron trigger → calls /api/ingest
│   │   ├── images/    # og:image backfill for articles
│   │   ├── img/       # Image proxy for hotlink-protected sources
│   │   ├── ingest/    # RSS feed fetcher
│   │   └── search/    # Full-text search API
│   ├── globals.css    # Tailwind v4 theme + Inter font
│   ├── layout.tsx
│   └── page.tsx       # Homepage with pagination
├── components/
│   ├── CategoryFilter.tsx
│   ├── NewsCard.tsx
│   ├── Pagination.tsx
│   └── SearchBar.tsx
├── lib/
│   ├── ai/            # Article enrichment
│   ├── ingest/        # RSS parsing, canonicalization, image extraction
│   ├── db.ts          # Prisma client singleton
│   └── types.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts        # 23 news sources
├── next.config.js
├── postcss.config.js
└── vercel.json
```

## Color Scheme

Custom lemon-lime primary palette:

| Swatch | Hex |
|---|---|
| 50 | `#fbfde7` |
| 100 | `#f7fccf` |
| 200 | `#eff8a0` |
| 300 | `#e8f570` |
| 400 | `#e0f240` |
| **500** | **`#d8ee11`** |
| 600 | `#adbf0d` |
| 700 | `#828f0a` |
| 800 | `#565f07` |
| 900 | `#2b3003` |
| 950 | `#1e2102` |

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Set environment variables (see above)
4. Set up a cron job at `/api/cron` with `CRON_SECRET` as Bearer token
5. Deploy
