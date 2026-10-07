#!/usr/bin/env node
// video/public/site/ is GENERATED from the site's own img/ tree and gitignored (ADR 0064 §2):
// the reels use photos, icons and the hero clip the site already ships, so the repo never
// carries a second copy. This map is the only place those paths live — add a line here, never
// drop a file into public/site/ by hand. Run by `npm run dev`, `npm run review`, `npm run render`.
// Committed assets (derivatives that exist nowhere else) live in public/brand/ and public/photos/.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMG = join(VIDEO, "..", "img");
const OUT = join(VIDEO, "public", "site");

/** public/site/<to>  ←  img/<from> */
const MAP = {
  "hero.mp4": "hero/hero.mp4", // the homepage hero clip (1080p, muted)
  "sunset-pair.jpg": "gallery/16.jpg", // SunsetDream's photo (1200×1600)
  "sunset-thatch.jpg": "gallery/18.jpg",
  "village-aerial.jpg": "gallery/01.jpg", // 708×387 — a card, never full-frame
  "family-house.jpg": "gallery/13.jpg",
  "weekend-table.jpg": "services/weekend.jpg",
  "work-window.jpg": "gallery/12.jpg", // moments-by-the-sea hook (1205×1600)
  "logo.png": "logo/logo-mono-nobg.png",
  "icons/palm-orange.png": "icons/palm-orange.png",
  "icons/heart.png": "icons/heart.png",
  "icons/sun-orange.png": "icons/sun-orange.png",
  "icons/house-blue.png": "icons/house-blue.png",
};

let copied = 0;
const missing = [];
for (const [to, from] of Object.entries(MAP)) {
  const src = join(IMG, from);
  const dst = join(OUT, to);
  if (!existsSync(src)) {
    missing.push(from);
    continue;
  }
  mkdirSync(dirname(dst), { recursive: true });
  const source = statSync(src);
  const copy = statSync(dst, { throwIfNoEntry: false });
  const fresh = copy !== undefined && copy.size === source.size && copy.mtimeMs >= source.mtimeMs;
  if (!fresh) {
    copyFileSync(src, dst);
    copied += 1;
  }
}
if (missing.length) {
  console.error(`sync-assets: missing in img/: ${missing.join(", ")} — the map in scripts/sync-assets.mjs names a file the site no longer has.`);
  process.exit(1);
}
console.log(`sync-assets: ${copied} copied, ${Object.keys(MAP).length} files current in public/site/`);
