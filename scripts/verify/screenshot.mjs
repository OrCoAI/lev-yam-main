#!/usr/bin/env node
// Headless-Chrome screenshot/click-through helper for the gate's /verify step.
//
// Replaces hand-rolling a one-off Playwright/CDP script per session (see the
// dozens of verify*.mjs entries in .claude/settings.json's permission history).
// No npm deps: Node 22's global WebSocket + fetch talk directly to Chrome's
// DevTools Protocol. Spawns its own headless Chrome per run and kills it after.
//
//   node scripts/verify/screenshot.mjs <url> <outPrefix> [options]
//
// Options:
//   --viewport mobile|desktop|both   default: both
//   --js "<expression>"              evaluated in-page before the shot; may
//                                     return a Promise (awaited) — use for
//                                     clicks, form fills, waiting on content
//   --wait <ms>                      extra settle time after load, default 300
//   --scale <n>                      deviceScaleFactor, default 1
//
// Writes <outPrefix>-mobile.png and/or <outPrefix>-desktop.png.
//
// Gotchas carried over from hand-run sessions (see the
// reference-headless-chrome-screenshots memory this script formalizes):
//   - captureBeyondViewport is deliberately never used — on these RTL pages
//     it shifts the image and looks like an overflow bug that isn't there.
//     To check real overflow, use --js measuring
//     document.documentElement.scrollWidth vs clientWidth instead.
//   - Always shoot BOTH viewports (mobile-first is a platform requirement,
//     and .rowline-style disclosure UI behaves differently under 640px) —
//     hence --viewport defaults to "both" rather than requiring the flag.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const VIEWPORTS = {
  mobile: { width: 390, height: 844, mobile: true },
  desktop: { width: 1280, height: 800, mobile: false },
};

function parseArgs(argv) {
  const [url, outPrefix, ...rest] = argv;
  if (!url || !outPrefix) {
    console.error('usage: node scripts/verify/screenshot.mjs <url> <outPrefix> [--viewport mobile|desktop|both] [--js "<expr>"] [--wait ms] [--scale n]');
    process.exit(2);
  }
  const opts = { viewport: 'both', wait: 300, scale: 1, js: null };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === '--viewport') opts.viewport = rest[++i];
    else if (flag === '--js') opts.js = rest[++i];
    else if (flag === '--wait') opts.wait = Number(rest[++i]);
    else if (flag === '--scale') opts.scale = Number(rest[++i]);
    else { console.error(`unknown flag: ${flag}`); process.exit(2); }
  }
  return { url, outPrefix, ...opts };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChrome(port, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

/** Thin CDP client: one request/response by id, plus an event listener. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = new Set();
  let nextId = 1;

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg.method, msg.params);
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', (e) => reject(e));
  });

  async function send(method, params = {}) {
    await ready;
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  function onEvent(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function waitForEvent(method, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error(`timed out waiting for ${method}`)); }, timeoutMs);
      const off = onEvent((m) => {
        if (m === method) { clearTimeout(timer); off(); resolve(); }
      });
    });
  }

  return { send, onEvent, waitForEvent, close: () => ws.close() };
}

async function shootViewport(port, opts, name, dims) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = connect(target.webSocketDebuggerUrl);

  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: dims.width,
    height: dims.height,
    deviceScaleFactor: opts.scale,
    mobile: dims.mobile,
  });

  const loaded = cdp.waitForEvent('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: opts.url });
  await loaded.catch(() => {}); // best-effort; fall through to the settle wait either way
  await sleep(opts.wait);

  if (opts.js) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: opts.js,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`--js threw: ${result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails)}`);
    }
  }

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }); // captureBeyondViewport intentionally omitted — see header
  const outPath = `${opts.outPrefix}-${name}.png`;
  writeFileSync(outPath, Buffer.from(data, 'base64'));
  cdp.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`, { method: 'PUT' }).catch(() => {});
  return outPath;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const names = opts.viewport === 'both' ? ['mobile', 'desktop'] : [opts.viewport];
  for (const n of names) {
    if (!VIEWPORTS[n]) { console.error(`unknown viewport: ${n}`); process.exit(2); }
  }

  const port = 9222 + Math.floor(Math.random() * 1000); // avoid colliding with a Chrome the user already has open
  const profileDir = mkdtempSync(join(tmpdir(), 'verify-cdp-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitForChrome(port);
    const written = [];
    for (const name of names) {
      written.push(await shootViewport(port, opts, name, VIEWPORTS[name]));
    }
    for (const path of written) console.log(path);
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
