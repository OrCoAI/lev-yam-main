#!/usr/bin/env node
// video/public/site/ is GENERATED from the site's own img/ tree and gitignored (ADR 0064 §2):
// the reels use photos, icons and the hero clip the site already ships, so the repo never
// carries a second copy. The map is video/assets.json — a name the compositions use, and the
// media or brand ID it is cut from (ADR 0069 §2). An ID resolves to its record's first rendition
// in the name's format that is not a sized cut (card.jpg, hero-1600.jpg, 18-960.webp): the web
// copy. Run by `npm run dev`, `npm run review`, `npm run render`.
// Committed assets (derivatives that exist nowhere else) live in public/brand/ and public/photos/.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(VIDEO, "..");
const OUT = join(VIDEO, "public", "site");
const json = (rel) => JSON.parse(readFileSync(join(REPO, rel), "utf8"));

/** public/site/<name>  ←  the media / brand ID */
const MAP = json("video/assets.json").site;
const FILES = new Map([
  ...json("content/media.json").media.map((r) => [r.id, r.renditions ?? []]),
  ...json("brand/assets.json").assets.map((a) => [a.id, a.served ?? []]),
]);
const SIZED_CUT = /(\/card|-\d+)\.[a-z0-9]+$/;

let copied = 0;
const missing = [];
for (const [to, id] of Object.entries(MAP)) {
  const from = (FILES.get(id) ?? []).find((f) => extname(f) === extname(to) && !SIZED_CUT.test(f));
  const src = from && join(REPO, from);
  if (!src || !existsSync(src)) {
    missing.push(`${to} ← ${id}`);
    continue;
  }
  const dst = join(OUT, to);
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
  console.error(`sync-assets: no rendition for ${missing.join(", ")} — video/assets.json names an ID without a web copy in that format.`);
  process.exit(1);
}
console.log(`sync-assets: ${copied} copied, ${Object.keys(MAP).length} files current in public/site/`);
