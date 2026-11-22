# ultimate-news — agent instructions
<!-- Generated from dev-kit template version 2026-11-08. -->

## Working agreement

- Carry out requested work autonomously, including ordinary file edits, tests, dependency changes, commits, branch pushes and Vercel preview deployments. Give brief progress updates on substantial work and report results.
- Preserve unrelated work and inspect existing changes before editing or removing files. Ask before deleting user data or discarding unrelated changes.
- Never modify files outside this project folder unless Alex explicitly asks.
- Ask before production deployments, publishing public content, destructive production database operations, or materially expanding the agreed scope.
- Do not send messages to other people without explicit authorization.

## Safety: data and commands

- **The local `.env` and `.env.local` point at the PRODUCTION database** (confirmed by Alex, 2026-11-08). Alex created a separate Neon `development` branch. Run the app and database tests against a confirmed non-production target. Run database-independent checks with dummy values:
  `DATABASE_URL="postgresql://none:none@127.0.0.1:1/none" DATABASE_URL_UNPOOLED="postgresql://none:none@127.0.0.1:1/none" bash scripts/check.sh`
- Confirm the database target before commands that connect or make changes. Schema changes and destructive test operations may run on a confirmed disposable or development database when needed for the task. Review their effects first and preserve existing development data unless Alex authorizes its removal.
- Do not read, print, copy or commit `.env*` files (the exception is `.env.example`). If a value is needed, ask Alex.
- Keep real user data and personal or health data out of prompts, logs, commit messages, handoff files and screenshots. Use synthetic data for tests and examples.
- Do not add third-party network calls, analytics or new data processors without approval.

## Quality gate

- Run `scripts/check.sh` before every commit and report the result. Fix failures or explain them.
- Label anything you could not verify as unverified. Do not describe untested behaviour as working.
- Add or update a test for any bug you fix, where the project has a test setup.

## Git and reporting

- Commit and push task-related changes to a non-production branch when useful for the requested work. Preserve unrelated changes.
- Commit subject: concise, imperative. Body: the problem, the resulting behaviour, and how it was validated.
- Use `YYYY-MM-DD-descriptive-name` for new reports and supporting documents. Keep conventional names (`AGENTS.md`, `README.md`, config files) as they are.
- At the end of a stage, list files created or modified with their locations, and say what was verified and what was not.
- At the end of a session, update `docs/HANDOFF.md`.

## Project facts

<!-- Observed 2026-11-08 by reading the repo. Items marked TO CONFIRM were not verified. -->

- **What:** Alex's impartial news aggregator web app (ultimate-news.vercel.app). The GitHub repo is **public**: never commit secrets, personal data or private notes.
- **Stack:** Next.js with TypeScript, Prisma. `prisma/schema.prisma` uses the `postgresql` provider via `DATABASE_URL`; a comment mentions SQLite for local development. Deployed on Vercel (`vercel.json`).
- **Commands:** `npm run dev`, `npm run lint`, `npm test` (tsx test runner over `lib/**/*.test.ts`), `npm run build`.
- **Database commands (confirm the target and review effects first):**
  - `npm run build` generates the Prisma client and builds Next.js. Check the current build script for schema operations before running it.
  - `npm run db:push`, `npm run db:migrate`, `npm run seed` (`prisma/seed.ts` calls `deleteMany` on clusters and articles).
  - `scripts/wipe-articles.ts` deletes reads, saves, clusters and articles.
  - `scripts/reembed-articles.ts`, `embed-missing-articles.ts`, `manual-ingest.ts`, `cluster-articles.ts`: effects NOT reviewed. TO CONFIRM before running. (`reclassify-articles.ts` and `sync-sources.ts` were deleted on 2026-11-22 as obsolete; see `docs/HANDOFF.md`.)
  - `npm run ingest:local` calls the ingest API with `INGEST_CRON_SECRET`.
- **Database:** `.env` and `.env.local` point at the **production** database (Neon, per the README; confirmed by Alex 2026-11-08). The README describes a local Docker Postgres for development; use that or another dev database once set up, then update this line. Prisma also reads `DATABASE_URL_UNPOOLED` (`directUrl`), so override both variables.
- **Local database file:** `prisma/dev.db` exists locally and is gitignored (`*.db`).
- **Env:** `.env`, `.env.local` are gitignored; only `.env.example` is tracked. Do not read the others.
- **Tests / CI:** 13 tracked test files; no CI workflows yet.

