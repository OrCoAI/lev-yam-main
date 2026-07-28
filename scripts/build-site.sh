#!/usr/bin/env bash
# Assemble the full site (static marketing + built /app) into _site/ for the
# STAGING deploy on Cloudflare (staging.levyam.com). Mirrors the assembly in
# .github/workflows/deploy.yml (prod → GitHub Pages), with two deliberate
# differences for staging:
#   1. no CNAME file — Cloudflare owns staging.levyam.com, not GitHub Pages;
#   2. the whole site is marked noindex (robots + X-Robots-Tag) so staging
#      never shows up in search.
# Run from the repo root (Cloudflare runs build commands there).
set -euo pipefail

# 1. Build the platform (/app). Cloudflare provides Node (see .node-version).
( cd app-src && npm ci && npm run build )

# 2. Assemble the static site (same allowlist as deploy.yml, minus CNAME).
rm -rf _site
mkdir -p _site/app
cp index.html survey-june.html pos.html sitemap.xml 404.html _site/
cp -r css js img fonts _site/
cp -r app-src/dist/* _site/app/

# 3. Staging is never indexed (belt + suspenders: robots.txt + response header).
printf 'User-agent: *\nDisallow: /\n' > _site/robots.txt
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > _site/_headers

echo "build-site: assembled _site/ ($(find _site -type f | wc -l | tr -d ' ') files)"
