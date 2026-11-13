# Ultimate News

A curated daily news aggregator — articles from 20 sources across 7 categories, refreshed every 24 hours via cron. Built with Next.js 15, Tailwind v4, and Prisma.

## Features

- **22 sources** across World News, Business, Technology, Science, Environment, Positive News, Travel (defined in `lib/config/sources.ts`); German sources are translated to English
- **Today's brief** — on the front page, the 5 stories that matter most to the reader, one sentence each, ending with "You're up to date". Claude rates each article's `importance` (1–5) for the reader described in `lib/config/reader.ts`
- **For you** — a one-sentence "why it matters to you" line, labelled as an AI inference, where a story concretely affects the reader; `/?forYou=1` lists all such stories
- **Depth badge** — each summary says whether it was written from the full article or only a teaser
- **Your ETFs & petrol** — market performance in % (day, 1 month, year to date) of the ETFs in `lib/config/portfolio.ts` (Xetra, EUR; never amounts) and the weekly German pump prices from the EU Weekly Oil Bulletin, refreshed by the daily cron
- **14-day freshness limit** — news older than 14 days is never ingested and never shown (`MAX_ARTICLE_AGE_DAYS` in `lib/config/dailyFeed.ts`)
- **Travel inspiration** — travel articles may be up to ~6 months old. Each day Claude rates a pool of up to 14 candidates from the travel sources (1–5: how well it inspires and helps plan a trip) and the best 6 are shown, at most 2 per source. Nothing is shown twice: featured and weakly rated articles are not offered again, while strong ones that lost out (e.g. to the per-source cap) stay in the pool for later days (`CURATED_AREAS` in `lib/config/dailyFeed.ts`; judged articles are remembered in the `ConsideredArticle` table)
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
- `enrichment.untranslated` — non-English articles left out because Claude could not translate them (the extractive fallback cannot translate, so they are never shown untranslated).
- `categoryFill` — articles per category against the sum of the source limits.
- `embeddings` — how many articles got a Voyage embedding (requested in one batch); without them stories are not grouped across sources.
- `markets` — the ETF and petrol refresh: which provider served each ETF, or why it failed.

To refresh only the ETF and petrol data: `curl "https://<your-deployment>/api/cron?markets"`.

### Tests

```bash
npm test
```

Runs the unit tests in `lib/**/*.test.ts` (summary format, fallback summariser, Claude reply parsing, page/metadata extraction, ingest collect step against a local fixture server, source configuration).

### Adding or removing a source

Edit `SOURCES` in `lib/config/sources.ts`: id, name, site URL, category and the daily article limit, plus one of:

- `feeds: [...]` — known RSS/Atom URLs (if omitted, the site's `<link rel="alternate">` feed is auto-discovered), or
- `scrape: true` — read articles straight from the page at `url`. No feed is used or discovered. Article links are taken from the page and each linked page must expose a publish date (JSON-LD, `<meta>` or `<time>`), either on the article page or next to the link on the listing.

Set `lang: 'de'` (or another code) for a non-English source. Its headline, summary and excerpt are then translated to English by Claude at ingest and stored in English; the article page shows the original language as e.g. "DE → EN". If Claude is unavailable or its reply is not English, that article is skipped rather than shown untranslated.

The next ingest syncs the database; sources removed from the list are deactivated and their articles disappear from the feed immediately.

To see what the scrapers and feeds currently find, without writing anything or calling the AI:

```bash
curl "https://<your-deployment>/api/cron?dryRun"
```

Add `&source=id1,id2` to check only some sources, and `&enrich` to also summarise the newest article of each (up to 4, calls Claude, still writes nothing). The result lists, per source, the method used, how many items were offered, kept and skipped as too old, any error, and the articles that would be ingested.

## Environment Variables

### Fact checking (in development)

The fact checker is in development. The nine fact-check tables have been verified on the Neon `development` branch. The normal build generates the Prisma client and leaves database schema changes to a separate migration.

Administrator sign-in uses Google. Configure a Google OAuth client with an authorized callback ending in `/api/auth/callback/google`, an Auth.js secret, and the owner's immutable Google account subject. The owner can add or remove editors by their verified Google account email. Editors can submit articles and review and publish reports. See `.env.example` for the server settings.

For a local smoke test, enable `FACT_CHECK_ENABLED` in `.env.development.local`, use the Neon `development` connection, and visit `/admin/fact-check`. Use `http://localhost:3000/api/auth/callback/google` as the callback if the local server runs on port 3000.

The default OpenRouter configuration uses the dated GLM 5.3 release and limits routing to endpoints that fit the reserved price. It defaults to two claims and a $1 job budget. Each source search reserves $0.228716 to cover both model turns and the Exa Fast fee. A custom model requires verified whole-request bounds in `FACT_CHECK_SEARCH_LIMITS_JSON`. The default uses the [provider catalog](https://openrouter.ai/api/v1/models/z-ai/glm-5.3-20260816/endpoints), [routing limits](https://openrouter.ai/docs/guides/routing/provider-selection#max-price), [server tool limits](https://openrouter.ai/docs/guides/features/server-tools#tool-call-limits), and [search pricing](https://openrouter.ai/docs/guides/features/server-tools/web-search#pricing).

Google sign-in and paid research have run locally. Publication, unpublishing, and revocation were checked against disposable PostgreSQL using synthetic sessions.

#### Vercel preview

1. In the Vercel project, confirm **Settings → Build and Deployment → Node.js Version** is **24.x** and the build command uses `npm run build`. Verify the branch selected for the preview is separate from the Production branch.
2. Under **Settings → Environment Variables**, choose **Preview** and scope the settings to the fact-check branch. Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the Neon `development` branch or another confirmed non-production branch with the nine fact-check tables. Use the pooled URL for `DATABASE_URL` and the direct URL for `DATABASE_URL_UNPOOLED`.
3. For the same Preview scope, set `FACT_CHECK_ENABLED=true`, `AUTH_SECRET` to a new random secret, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to the Google web client's credentials, `FACT_CHECK_OWNER_GOOGLE_SUBJECT` to the configured owner's Google subject, and `OPENROUTER_API_KEY` to the OpenRouter key. Generate a session secret locally with `openssl rand -base64 32`. Use the built-in model and limits for the first check.
4. After the preview builds, copy its stable Git branch URL from the Vercel deployment details. In **Google Cloud Console → Google Auth Platform → Clients**, open the web client and add `https://<preview-branch-host>/api/auth/callback/google` under **Authorized redirect URIs**. Open that same preview hostname for the test so the request and callback hosts match.
5. Open `/admin/fact-check`, sign in with the owner account, and submit one readable article. Confirm the Workflow run completes in Vercel, the report reaches **Ready for review**, and the review shows a verdict, score, and evidence. If approved for publication, publish it on the preview and verify it appears in `/fact-check`, then unpublish it and verify that the archive and direct URL hide it.

See [Vercel Preview environments](https://vercel.com/docs/deployments/environments), [branch-specific environment variables](https://vercel.com/docs/environment-variables#preview-environment-variables), and the [Auth.js Google callback](https://authjs.dev/getting-started/providers/google#callback-url).

| Variable | Description |
|---|---|
| `DATABASE_URL` | Database connection string |
| `DATABASE_URL_UNPOOLED` | Direct connection (Neon auto-creates this) |
| `INGEST_CRON_SECRET` | Shared secret to authenticate ingest requests |
| `CRON_SECRET` | Vercel Cron Bearer token (matches ingest auth) |
| `ANTHROPIC_API_KEY` | API key for AI summaries. Without it the lower-quality extractive fallback is used |
| `ENRICH_MODEL` | Optional. Claude model for summaries (default `claude-haiku-5-5`, low effort) |
| `NEXT_PUBLIC_APP_URL` | Public app URL (fallback for cron self-call) |
| `EODHD_API_KEY` (or `EODHD_API_TOKEN`) | Free key from eodhd.com for the ETF panel (4 calls per day). Without it ETF performance is not shown; petrol prices need no key |

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
│   │   └── dailyFeed.ts # Category targets, freshness windows, curated travel pick
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
