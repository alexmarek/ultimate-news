# Handoff — ultimate-news

> The 2026-11-08 status below is historical. The 2026-11-13 section at the end is current.

**Updated:** 2026-11-08 by Claude (agent rules rollout)

## Current state
Next.js and Prisma news aggregator, deployed on Vercel. 13 tracked tests (`npm test`); no CI yet. Agent rules, `scripts/check.sh` and this file were added on 2026-11-08. Not verified: what the app's current feature state is.

## Last session
- Added `AGENTS.md`, `CLAUDE.md`, `scripts/check.sh`, `docs/HANDOFF.md` from the dev-kit templates. Nothing in app code was changed.

## Next steps (in order)
1. Alex creates a separate dev database (the README documents a local Docker Postgres) and points the local `.env` and `.env.local` at it. Then update the Safety section of `AGENTS.md`.
2. Change the `build` script so a build no longer runs `prisma db push` (needs Alex's approval).
3. Add a CI workflow that runs `scripts/check.sh`.
4. Review the untracked `2026-11-08-ultimate-news-redesign-handover.md` before it is committed; this repo is public.

## Decisions and constraints
- 2026-11-08: agent files are committed in this repo. `.claude/` stays gitignored, so `.claude/settings.json` is local-only.

## Open questions for Alex
- When will the dev database exist? Until then agents do not run the app or any database-touching script (local `.env` points at production, confirmed 2026-11-08).
- What do `reclassify-articles.ts`, `reembed-articles.ts`, `embed-missing-articles.ts`, `sync-sources.ts`, `manual-ingest.ts` and `cluster-articles.ts` do to the data? They have not been reviewed.

## Commands that matter
- Check: `scripts/check.sh` (add `--build` only once `build` no longer touches the database)
- Dev: `npm run dev`; tests: `npm test`

## Newsroom redesign — 2026-11-13 (current)

A separate development database is available. Follow `AGENTS.md` and confirm the target before any database operation.

### Current state

The newsroom redesign updates the front page and story page with responsive layouts, shared navigation, day-based editions, a brief, article deduplication and an accessibility-focused type and colour system.

Fact-check styling and published-report integration are deferred. The summary component is not wired to report data, and no fact-check verdicts or report links are shown in the redesign.

### Next steps

1. Integrate the fact-check feature when its changes are available. Gate every verdict and report module behind `FACT_CHECK_ENABLED`, and display only published reports. The existing report route uses the fact-check article ID.
2. Re-run Lighthouse accessibility on the final integrated front page and story page. The earlier mobile audits scored 100/100 before the final control and footer changes.
3. Verify the approximate 2,000px mobile-page target using a 12-story fixture. Review screenshot image-use rights before publishing captures containing source images.
4. Add the paid-promotion hidden count only when a reliable promotion classification is available. Ingest filtering is a separate task.
5. Review legacy category-colour code and any unused local components only after confirming references and receiving approval to delete.

### Verification

- `scripts/check.sh` passed with dummy database variables: 124 tests and typecheck passed. Lint was skipped because no ESLint configuration is present.
- A direct Next.js production build passed with dummy database variables. Token colours met 4.5:1 contrast against the specified light and dark paper and wash backgrounds.
- The visible front-page controls were checked at 1440, 1024, 390 and 320 CSS pixels, with no page-level horizontal overflow. The keyboard-help shortcut and its dismissal were checked manually.

### Safety

Follow `AGENTS.md` for database and Git safeguards. The `npm run build` script in this revision invokes `prisma db push`; use a direct Next.js build with dummy database variables unless a database operation has been explicitly approved for a confirmed non-production database.

The effects of the reclassification, re-embedding, source-sync, manual-ingest and clustering scripts have not been reviewed. Inspect and obtain the required approval before running them.
