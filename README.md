# Ultimate News

A curated daily news aggregator — articles from 10 sources across 5 categories, refreshed every 24 hours via cron. Built with Next.js 15, Tailwind v4, and Prisma.

## Features

- **10 sources** across World News, Technology, Environment, Positive News, Business, Travel
- **Daily refresh** — Vercel Cron wipes and re-ingests all articles at 08:00 UTC
- **12 articles per page** with pagination
- **Search & category filter** via URL params
- **Keyboard navigation** — `j`/`k` to move, `o` to open, `m` to mark read
- **Cookie-based read tracking** — per-browser, no login required
- **Hide read** toggle to filter already-seen articles
- **Image proxy** with automatic WebP conversion and resizing (800px max)
- **Lazy loading** on all archive card images
- **AI enrichment** — per-article summary, topic extraction, entity extraction via Claude
- **Cluster dedup** — groups articles covering the same story across sources
- **Masonry grid** layout (4 cols desktop, 1 col mobile)
- **Dark mode** theme toggle

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma ORM** (PostgreSQL — Neon for production, Docker for local)
- **Claude API** (Anthropic) for article enrichment
- **Sharp** for image processing
- **Deployment**: Vercel

## Getting Started

```bash
# Install dependencies
yarn install

# Start PostgreSQL locally (requires Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ultimatenews postgres

# Set up environment
cp .env.example .env
# Edit .env if your Postgres credentials differ

# Generate Prisma client
npx prisma generate

# Push schema
npx prisma db push

# Start dev server
yarn dev
```

### Fetch articles

The daily cron runs automatically at 08:00 UTC on Vercel. To trigger it locally:

```bash
curl http://localhost:3000/api/cron
```

### Backfill missing images

```bash
curl -X POST http://localhost:3000/api/images \
  -H "x-cron-secret: <INGEST_CRON_SECRET>"
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Database connection string |
| `DATABASE_URL_UNPOOLED` | Direct connection (Neon auto-creates this) |
| `INGEST_CRON_SECRET` | Shared secret to authenticate ingest requests |
| `CRON_SECRET` | Vercel Cron Bearer token (matches ingest auth) |
| `ANTHROPIC_API_KEY` | API key for AI article enrichment |
| `NEXT_PUBLIC_APP_URL` | Public app URL (fallback for cron self-call) |

`VERCEL_URL` is auto-set by Vercel at deploy time.

## Project Structure

```
ultimate-news/
├── app/
│   ├── api/
│   │   ├── cron/        # Vercel Cron trigger → calls /api/ingest
│   │   ├── images/      # og:image backfill for articles
│   │   ├── img/         # Image proxy + WebP conversion via Sharp
│   │   └── ingest/      # RSS fetcher, dedup, enrichment, clustering
│   ├── article/
│   │   └── [id]/
│   │       └── page.tsx # Article detail view
│   ├── globals.css      # Tailwind v4 theme
│   ├── layout.tsx
│   └── page.tsx         # Homepage — daily feed with pagination
├── components/
│   ├── ArticleImage.tsx      # Image renderer with SVG fallback
│   ├── CategoryFilter.tsx    # Category + hide-read filter bar
│   ├── KeyboardNavWrapper.tsx
│   ├── MarkRead.tsx          # Marks article as read (cookie-based)
│   ├── MasonryGrid.tsx       # Responsive masonry grid
│   ├── NewsCard.tsx
│   ├── Pagination.tsx
│   ├── SearchBar.tsx
│   ├── ThemeToggle.tsx
│   └── useKeyboardNav.ts     # j/k/o/m keyboard navigation hook
├── lib/
│   ├── ai/              # Claude enrichment pipeline
│   ├── config/
│   │   └── dailyFeed.ts # Per-source limits and category mapping
│   ├── dedup/           # Cluster-based deduplication
│   ├── ingest/          # RSS parsing, URL canonicalization, image extraction
│   ├── db.ts            # Prisma client singleton
│   └── types.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── next.config.js
├── postcss.config.js
└── vercel.json
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Set environment variables (see above)
4. Vercel Cron is configured in `vercel.json` — runs daily at 08:00 UTC
5. Deploy