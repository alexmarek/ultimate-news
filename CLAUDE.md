# Claude instructions for ultimate-news
<!-- Template version 2026-11-08. -->

@AGENTS.md carries the shared rules. Follow it as written. This file only adds Claude-specific permission tiers.

## Permission tiers (inside this project folder)

**No approval needed (read-only):** reading files, searching, listing, `git status|diff|log`, and `scripts/check.sh`.

**After Alex approves a plan, no further per-action confirmation:** creating and editing files in this folder, `git add`, and local `git commit`.

**Always ask first:** `git push`, force-push, `git reset --hard`, deleting a branch, deleting/overwriting/renaming existing files, installing dependencies, any database command (see the Safety section of `AGENTS.md`), deploys, publishing, and anything outside this folder.

Keep `.claude/settings.json` consistent with this section.
