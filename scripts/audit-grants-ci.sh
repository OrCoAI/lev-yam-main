#!/usr/bin/env bash
# The single copy of the deploy-time grant-audit invocation. deploy.yml (prod,
# gating) and deploy-staging.yml (advisory, continue-on-error) both call this,
# so the two tiers cannot drift in HOW they audit — the same reason
# assemble-site.sh is the single copy of what the site ships.
#
# Skips with a warning when the token is absent so a fork or a secretless run
# still deploys; otherwise the audit's own exit code decides (the script runs
# in summary mode by itself under CI — it detects $CI).
set -euo pipefail

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "::warning::SUPABASE_ACCESS_TOKEN not set — skipping the live grant audit."
  exit 0
fi
node supabase/tests/audit-grants.mjs --ref "$1"
