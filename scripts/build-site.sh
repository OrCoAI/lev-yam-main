#!/usr/bin/env bash
# STAGING build entry point (Cloudflare runs this from the repo root — see
# .github/workflows/deploy-staging.yml). Builds the platform, then hands off to
# scripts/assemble-site.sh, which owns the deploy allowlist for both tiers.
set -euo pipefail

# Build the platform (/app). Cloudflare provides Node (see .node-version).
( cd app-src && npm ci && npm run build )

bash scripts/assemble-site.sh staging
