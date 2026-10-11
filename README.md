# Ultimate News

A curated daily news aggregator — articles from 12 sources across 7 categories, refreshed every 24 hours via cron. Built with Next.js 15, Tailwind v4, and Prisma.

## Features

- **12 sources** across World News, Technology, Science, Environment, Positive News, Business, Travel (defined in `lib/config/sources.ts`)
- **14-day freshness limit** — articles older than 14 days are never ingested and never shown (`MAX_ARTICLE_AGE_DAYS` in `lib/config/dailyFeed.ts`)
- **Daily refresh** — Vercel Cron re-ingests all articles at 08:00 UTC; the previous feed is replaced only once new articles are ready, so a failed run never empties the site
- **12 articles per page** with pagination
- **Search & category filter** via URL params
- **Keyboard navigation** — `j`/`k` to move, `o` to open, `m` to mark read
- **Cookie-based read tracking** — per-browser, no login required
- **Hide read** toggle to filter already-seen articles
- **Image proxy** with automatic WebP conversion and resizing (800px max)
- **Lazy loading** on all archive card images
- **Structured summaries** — up to 400 words per article: a bold lead with the main message, short paragraphs, a *Key points* list and an optional *Why it matters* note, with no repeated sentences (`lib/summary.ts`)
- **AI enrichment** — summary, topic and entity extraction via Claude; if Claude is unavailable an extractive fallback builds the same format from the article text
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

The response is an ingest report. Check it after changing sources or prompts:

- `sources[]` — per source: how it was fetched (`feed` / `scrape`), the feed URL used, how many items it offered, how many were skipped as too old, how many were kept, and any `error`.
- `enrichment` — how many summaries were written by Claude (`ai`) versus the extractive fallback (`fallback`), with the reasons. If `ai` is 0, check `ANTHROPIC_API_KEY`.
- `categoryFill` — articles per category against the sum of the source limits.

### Tests

```bash
npm test
```

Runs the unit tests in `lib/**/*.test.ts` (summary format, fallback summariser, Claude reply parsing, page/metadata extraction, ingest collect step against a local fixture server, source configuration).

### Adding or removing a source

Edit `SOURCES` in `lib/config/sources.ts`: id, name, site URL, category and the daily article limit, plus one of:

- `feeds: [...]` — known RSS/Atom URLs (if omitted, the site's `<link rel="alternate">` feed is auto-discovered), or
- `scrape: true` — read articles straight from the page at `url`. No feed is used or discovered. Article links are taken from the page and each linked page must expose a publish date (JSON-LD, `<meta>` or `<time>`), either on the article page or next to the link on the listing.

The next ingest syncs the database; sources removed from the list are deactivated and their articles disappear from the feed immediately.

To see what the scrapers and feeds currently find, without writing anything or calling the AI:

```bash
curl "https://<your-deployment>/api/cron?dryRun"
```

The result lists, per source, the method used, how many items were offered, kept and skipped as too old, any error, and the articles that would be ingested.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Database connection string |
| `DATABASE_URL_UNPOOLED` | Direct connection (Neon auto-creates this) |
| `INGEST_CRON_SECRET` | Shared secret to authenticate ingest requests |
| `CRON_SECRET` | Vercel Cron Bearer token (matches ingest auth) |
| `ANTHROPIC_API_KEY` | API key for AI summaries. Without it the lower-quality extractive fallback is used |
| `ENRICH_MODEL` | Optional. Claude model for summaries (default `claude-haiku-4-5-20251001`) |
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
│   │   └── ingest/      # Authenticated trigger for the ingest pipeline
│   ├── article/
│   │   └── [id]/
│   │       └── page.tsx # Article detail view
│   ├── globals.css      # Tailwind v4 theme
│   ├── layout.tsx
│   └── page.tsx         # Homepage — daily feed with pagination
├── components/
│   ├── ArticleImage.tsx      # Image renderer with SVG fallback
│   ├── SummaryView.tsx       # Renders a structured summary (lead, paragraphs, key points)
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
│   ├── ai/              # Claude enrichment + extractive fallback
│   ├── config/
│   │   ├── sources.ts   # Every source: feeds, category, daily limit
│   │   └── dailyFeed.ts # Category targets, 14-day freshness window
│   ├── dedup/           # Cluster-based deduplication
│   ├── ingest/          # Ingest pipeline, RSS/HTML collection, URL canonicalization, images
│   ├── summary.ts       # Summary format: parse, de-duplicate, 400-word cap
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