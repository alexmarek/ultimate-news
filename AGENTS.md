# ultimate-news — agent instructions
<!-- Generated from dev-kit template version 2026-11-08. -->

## Working agreement

- For multi-step tasks, outline the plan first and wait for Alex's approval before executing. After each major step, summarise what was done and what comes next.
- Alex can override this explicitly for a task (for example "proceed without waiting"). An override applies to that task only, unless he says it is standing.
- Reading, searching and listing files, and running the checks in `scripts/check.sh`, need no approval.
- Before deleting, overwriting or renaming an existing file, show what will change and wait for confirmation.
- Never modify files outside this project folder unless Alex explicitly asks.
- Preserve unrelated work. Do not discard or overwrite changes made by Alex or another agent.
- Ask before destructive actions, deployment, publishing, `git push`, adding dependencies, or materially expanding the agreed scope.
- Do not send messages to other people without explicit authorization.

## Safety: data and commands

- **Never run any of these without Alex's explicit approval AND a confirmed non-production `DATABASE_URL`:**
  `prisma db push`, `prisma migrate dev|deploy|reset`, `prisma db execute`, seed scripts, any script that calls `deleteMany`, `TRUNCATE` or `DROP`, and the wipe/reset scripts listed under "Project facts".
- Ask which database a command would touch before running it. Do not guess from the variable name.
- Do not read, print, copy or commit `.env*` files (the exception is `.env.example`). If a value is needed, ask Alex.
- Keep real user data and personal or health data out of prompts, logs, commit messages, handoff files and screenshots. Use synthetic data for tests and examples.
- Do not add third-party network calls, analytics or new data processors without approval.

## Quality gate

- Run `scripts/check.sh` before every commit and report the result. Fix failures or explain them.
- Label anything you could not verify as unverified. Do not describe untested behaviour as working.
- Add or update a test for any bug you fix, where the project has a test setup.

## Git and reporting

- Commits are local after an approved plan; `git push` always needs approval.
- Commit subject: concise, imperative. Body: the problem, the resulting behaviour, and how it was validated.
- Use `YYYY-MM-DD-descriptive-name` for new reports and supporting documents. Keep conventional names (`AGENTS.md`, `README.md`, config files) as they are.
- At the end of a stage, list files created or modified with their locations, and say what was verified and what was not.
- At the end of a session, update `docs/HANDOFF.md`.

## Project facts

<!-- Observed 2026-11-08 by reading the repo. Items marked TO CONFIRM were not verified. -->

- **What:** Alex's impartial news aggregator web app (ultimate-news.vercel.app). The GitHub repo is **public**: never commit secrets, personal data or private notes.
- **Stack:** Next.js with TypeScript, Prisma. `prisma/schema.prisma` uses the `postgresql` provider via `DATABASE_URL`; a comment mentions SQLite for local development. Deployed on Vercel (`vercel.json`).
- **Commands:** `npm run dev`, `npm run lint`, `npm test` (tsx test runner over `lib/**/*.test.ts`), `npm run build`.
- **Dangerous commands (approval and a confirmed non-production DB required):**
  - `npm run build` runs `prisma generate && prisma db push && next build`, so **a build can change the database schema**. Use `npx next build` or ask first.
  - `npm run db:push`, `npm run db:migrate`, `npm run seed` (`prisma/seed.ts` calls `deleteMany` on clusters and articles).
  - `scripts/wipe-articles.ts` deletes reads, saves, clusters and articles.
  - `scripts/reclassify-articles.ts`, `reembed-articles.ts`, `embed-missing-articles.ts`, `sync-sources.ts`, `manual-ingest.ts`, `cluster-articles.ts`: effects NOT reviewed. TO CONFIRM before running.
  - `npm run ingest:local` calls the ingest API with `INGEST_CRON_SECRET`.
- **Which database do `.env` and `.env.local` point at (dev or production)?** TO CONFIRM with Alex.
- **Local database file:** `prisma/dev.db` exists locally and is gitignored (`*.db`).
- **Env:** `.env`, `.env.local` are gitignored; only `.env.example` is tracked. Do not read the others.
- **Tests / CI:** 13 tracked test files; no CI workflows yet.

