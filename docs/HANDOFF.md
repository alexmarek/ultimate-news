# Handoff — ultimate-news

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
