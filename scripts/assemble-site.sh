#!/usr/bin/env bash
# Assembles the full site (static marketing + already-built /app) into _site/.
#
#   scripts/assemble-site.sh prod       → GitHub Pages, levyam.com
#   scripts/assemble-site.sh staging    → Cloudflare Pages, staging.levyam.com
#
# THIS FILE IS THE ONLY COPY OF THE DEPLOY ALLOWLIST. Both tiers call it:
# .github/workflows/deploy.yml (prod) and scripts/build-site.sh (staging), which
# previously each carried their own copy of the same cp lines — a two-place edit
# whose failure mode is a production-only 404 that staging never reproduces.
#
# A new public page or asset folder MUST be added to the allowlist below, or it
# 404s in production while working fine on `python3 -m http.server 8080`.
#
# Expects app-src/dist/ to already exist (the caller builds the platform).
# Run from the repo root.
set -euo pipefail

TIER="${1:-}"
case "$TIER" in
  prod|staging) ;;
  *) echo "usage: scripts/assemble-site.sh <prod|staging>" >&2; exit 2 ;;
esac

# sitemap.xml + both /stories/ hubs are generated from the story pages on disk, so
# production is correct even if someone forgot to regenerate locally. This also
# enforces the HE/AR twin invariant — it exits non-zero on a half-translated page.
node scripts/gen-stories-index.mjs

rm -rf _site
mkdir -p _site/app

# ── Allowlist ───────────────────────────────────────────────────────────────
# 404.html is what GitHub Pages serves for any unknown path; it routes /app/*
# deep links into the SPA and sends other unknown paths to the marketing home.
cp index.html survey-june.html pos.html sitemap.xml 404.html llms.txt _site/
cp -r css js img fonts stories _site/
# FACTS.md is served verbatim as /facts.txt — the single source every piece of
# written content draws from, and what AI crawlers read.
cp FACTS.md _site/facts.txt
# Authoring templates and hub sources are tools, not pages. Recursive on purpose:
# the underscore files live at stories/ today, but a future stories/ar/_draft.html
# would otherwise be published to a public URL.
find _site/stories -name '_*.html' -delete
cp -r app-src/dist/* _site/app/

# ── Tier differences ────────────────────────────────────────────────────────
case "$TIER" in
  prod)
    # GitHub Pages owns levyam.com via CNAME, and prod is the indexed tier.
    cp robots.txt CNAME _site/
    ;;
  staging)
    # Cloudflare owns staging.levyam.com, so no CNAME. Staging is never indexed
    # (belt + suspenders: robots.txt + response header).
    printf 'User-agent: *\nDisallow: /\n' > _site/robots.txt
    printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > _site/_headers
    ;;
esac

echo "assemble-site($TIER): $(find _site -type f | wc -l | tr -d ' ') files"
