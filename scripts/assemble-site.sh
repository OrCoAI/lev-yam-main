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

# sitemap.xml, both /stories/ hubs and the header/footer chrome of every story page
# are generated from the templates and pages on disk (it rewrites story files in
# this checkout before they are copied), so production is correct even if someone
# forgot to regenerate locally. It also enforces the HE/AR twin invariant and
# refuses leftover placeholders and missing story images — exits non-zero.
# gen-happening.mjs below stamps the same chrome into the /happening/ shells.
node scripts/gen-stories-index.mjs

rm -rf _site
mkdir -p _site/app

# ── Allowlist ───────────────────────────────────────────────────────────────
# 404.html is what GitHub Pages serves for any unknown path; it routes /app/*
# deep links into the SPA and sends other unknown paths to the marketing home.
cp index.html survey-june.html pos.html sitemap.xml 404.html llms.txt _site/
cp -r css js img fonts stories happening _site/
# FACTS.md is served verbatim as /facts.txt — the single source every piece of
# written content draws from, and what AI crawlers read.
cp FACTS.md _site/facts.txt
# /happening/ (ADR 0056): one landing page per live item per language, the two
# hubs filled with their cards, the items' sitemap entries and the tier's feed
# config (js/happening-config.js) are rendered from the platform's public feed
# INTO _site/ ONLY — the items are not known at commit time. Reads
# VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (prod: repo secrets on the assemble
# step; staging: the values on deploy-staging.yml's build step). A feed fetch
# failure fails the build on purpose: a site whose shared links 404 is worse
# than a delayed deploy, and a re-run fixes it.
node scripts/gen-happening.mjs --out _site
# Authoring templates, hub sources and the render fixture are tools, not pages.
# Recursive on purpose: a future stories/ar/_draft.html would otherwise be
# published to a public URL.
find _site/stories _site/happening -name '_*' -delete
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
