# Fact-check integration: proposed existing-file changes

This is a review proposal, not an applied database migration. Existing article and ingestion models remain unchanged.

## `prisma/schema.prisma`

Add separate records for:

- `FactCheckUser`: unique Google subject once bound, invited verified email, owner/editor role, active state and timestamps. The owner is bootstrapped from an explicitly configured Google subject. Users added through the interface receive editor access; only the owner can manage them. Every protected request checks the current database record.
- `FactCheckArticle`: unique canonical URL, article metadata, a pointer to the current published version and an atomic active-job lock.
- `FactCheckReport`: article relation, version, processing and publication state, summary, nullable score, verdict, confidence, methodology/model versions, timestamps and bounded error details.
- `FactCheckClaim`: report relation, claim text, centrality, nullable score, verdict, confidence and explanation.
- `FactCheckEvidence`: report/claim relation, source URL, provenance, source type, publication and retrieval times, a short excerpt or summary and relationship to the claim.
- `FactCheckJob`: report relation, durable workflow ID, stage, retry and cost accounting, error category and timestamps.

Add the corresponding indexes, uniqueness constraints and relations. The migration will be additive and reviewed separately before it is applied to a confirmed non-production database.

## `package.json` and `yarn.lock`

Add the Google-capable Auth.js Next.js package and the Workflow SDK after checking their current compatibility. Add a runtime schema validation package if needed for model output. Keep existing packages and ingestion commands.

Proposed separate build change: replace `prisma generate && prisma db push && next build` with `prisma generate && next build`, so a build does not push a database schema. Database migration remains an explicit separate operation.

## `next.config.js`

Wrap the existing Next.js configuration with the Workflow SDK integration if the compatibility check succeeds. Preserve the existing security headers and other configuration.

## `.env.example`

Add placeholders for `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, the owner's Google subject, `OPENROUTER_API_KEY`, `FACT_CHECK_MODEL`, claim/search/cost limits, and any required workflow configuration. Do not add real values.

## Site navigation

Add a link to `/fact-check` to the existing mobile and desktop navigation, retaining the current search, categories, read state and theme controls. The user-management controls appear only in the owner interface.

## `README.md` and `docs/HANDOFF.md`

Document Google OAuth and owner bootstrap, editor invitations and revocation, research limitations and cost controls, safe migration, local testing and publication. Update the handoff with verified status and unresolved work; do not include private user data or secrets.

All other new implementation files are additive. New Next.js route and configuration filenames must follow framework conventions; other new files use the dated naming format.
