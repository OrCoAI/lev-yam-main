#!/usr/bin/env node
// The "look at it" half of the loop (.claude/skills/new-video/review.md): render review stills of
// one or more compositions so a reviewer — human or the reviewer subagent — checks the real
// frames, not the code. Writes out/review/<id>/<frame>.png.
//
//   node scripts/review-stills.mjs <id> [<id> ...] [--frames 0,15,mid,end-30] [--guide]
//
// Frames: integers, `mid` and `end` (last frame), with +/- offsets (`end-30`, `mid+10`).
// Default: 0,15,mid,end-30 — the scroll-stop frame, the hook, the middle, the held CTA.
// --guide: also render each frame with the <SafeZone /> overlay (`<frame>-guide.png`) so the
// safe-zone check is judged on a frame that carries the zone, while the plain stills stay real.
// One bundle (rspack, as remotion.config.ts; public/ symlinked, not copied) and one browser serve
// every still — bundling and cold browser starts are the cost, the frames are cheap.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values, positionals: ids } = parseArgs({
  options: { frames: { type: "string", default: "0,15,mid,end-30" }, guide: { type: "boolean", default: false } },
  allowPositionals: true,
});
if (ids.length === 0) {
  console.error("usage: node scripts/review-stills.mjs <id> [<id> ...] [--frames 0,15,mid,end-30] [--guide]");
  process.exit(1);
}
const spec = values.frames.split(",");

const resolveFrame = (token, last) => {
  const m = /^(mid|end|\d+)([+-]\d+)?$/.exec(token.trim());
  if (!m) throw new Error(`bad frame token "${token}"`);
  const base = m[1] === "mid" ? Math.floor(last / 2) : m[1] === "end" ? last : Number(m[1]);
  return Math.min(last, Math.max(0, base + (m[2] ? Number(m[2]) : 0)));
};

const chromiumOptions = { gl: "angle" }; // @remotion/effects (light leaks) needs WebGL2
const bundleDir = join(VIDEO, "out", "bundle");
rmSync(bundleDir, { recursive: true, force: true });
const serveUrl = await bundle({
  entryPoint: join(VIDEO, "src", "index.ts"),
  outDir: bundleDir,
  rspack: true,
  symlinkPublicDir: true,
});
const browser = await openBrowser("chrome", { chromiumOptions });
try {
  for (const id of ids) {
    const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions });
    const last = composition.durationInFrames - 1;
    const outDir = join(VIDEO, "out", "review", id);
    mkdirSync(outDir, { recursive: true });
    // Two tokens can resolve to one frame on a short composition; render each frame once.
    const frames = [...new Set(spec.map((token) => resolveFrame(token, last)))];
    const variants = values.guide ? [{ suffix: "", env: {} }, { suffix: "-guide", env: { SHOW_SAFE_ZONE: "1" } }] : [{ suffix: "", env: {} }];
    await Promise.all(
      frames.flatMap((frame) =>
        variants.map(async ({ suffix, env }) => {
          const output = join(outDir, `${String(frame).padStart(4, "0")}${suffix}.png`);
          await renderStill({
            composition,
            serveUrl,
            frame,
            output,
            imageFormat: "png",
            envVariables: env,
            puppeteerInstance: browser,
            chromiumOptions,
          });
          console.log(`${id} frame ${frame}/${last} → ${output}`);
        }),
      ),
    );
  }
} finally {
  await browser.close({ silent: true });
}
