#!/usr/bin/env bash
# Quality gate for Node/TypeScript projects. Run before every commit.
# Template version 2026-11-08. Never touches a database.
#   scripts/check.sh            # lint, typecheck, tests, staged-secret check
#   scripts/check.sh --build    # also run the build, only if the build script is DB-free
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
[ -f package.json ] || { echo "No package.json here."; exit 2; }

fail=0
step() { local name="$1"; shift; echo "== $name"; if "$@"; then echo "   ok"; else echo "   FAILED: $name"; fail=1; fi; }
has_script() { node -e 'process.exit(((require("./package.json").scripts)||{})[process.argv[1]] ? 0 : 1)' "$1"; }
script_body() { node -e 'console.log(((require("./package.json").scripts)||{})[process.argv[1]]||"")' "$1"; }

# 1. No env files staged (except .env.example)
staged_env="$(git diff --cached --name-only | grep -E '(^|/)\.env(\.|$)' | grep -v -E '\.env\.example$' || true)"
if [ -n "$staged_env" ]; then echo "== staged env files"; echo "$staged_env"; echo "   FAILED: env file staged"; fail=1; fi

# 2. Lint, typecheck, tests
if has_script lint; then
  if ls .eslintrc* eslint.config.* >/dev/null 2>&1 || node -e 'process.exit(require("./package.json").eslintConfig ? 0 : 1)'; then
    step "lint" npm run --silent lint
  else
    echo "== lint skipped: no ESLint config found (next lint would stop to ask for setup)"
  fi
fi
[ -f tsconfig.json ] && step "typecheck" npx --no-install tsc --noEmit --incremental false
has_script test && step "tests" npm test --silent

# 3. Optional secret scan if gitleaks is installed
if command -v gitleaks >/dev/null 2>&1; then step "gitleaks" gitleaks detect --no-banner --redact; else echo "== gitleaks not installed (skipped)"; fi

# 4. Build only on request, and only if it does not touch a database
if [ "${1:-}" = "--build" ]; then
  if has_script build; then
    body="$(script_body build)"
    if echo "$body" | grep -q -E 'db push|migrate|db execute|seed'; then
      echo "== build skipped: the build script touches the database ($body). Ask Alex."; fail=1
    else step "build" npm run --silent build; fi
  fi
fi

[ "$fail" -eq 0 ] && echo "ALL CHECKS PASSED" || echo "CHECKS FAILED"
exit "$fail"
