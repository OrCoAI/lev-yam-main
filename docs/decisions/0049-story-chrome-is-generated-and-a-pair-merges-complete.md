# 0049 — Story chrome is generated, not copied; a story pair merges only complete

- **Date:** 2026-09-22
- **Status:** accepted — amends the Stories rules in `CLAUDE.md`; closes the "chrome stamping" follow-up of [plans/content-engine-phase0.md](../plans/content-engine-phase0.md)
- **Decided by:** owner (kickoff of Q4 mandate item 2, [plans/stories-authoring-tool.md](../plans/stories-authoring-tool.md))
- **Source:** the kickoff alignment questions and the gate's review passes on the tool PR

## Context

Phase 0 shipped `/stories/` with the homepage's header and footer copied into four underscore
templates and every page pair — ~180 lines per file. Two review rounds flagged it and it was
deferred as "an architecture change, not a gate fix". With four story pairs about to be written
and a cadence after them, every nav or footer change would be an N-file edit that `--check`
could not see. The gate's review of the tool found a third copy in the two hub templates.

Separately, the kickoff decided how a page is allowed to merge: the fact guardrail produces
`[חסר]` markers by design, and invariant 5 requires an Arabic twin — neither says what happens
when a marker is still in the text or the Arabic was never read by a native reader.

## Decision

1. **The header and footer of every story page and of both hubs are generated.** They sit
   between `chrome:header` / `chrome:footer` marker comments and `scripts/gen-stories-index.mjs`
   **rewrites** them from `stories/_template.html` / `_template.ar.html` on every run (rewrite,
   not verify-only: a template edit propagates by itself; CI's `--check` fails on drift). Inside
   a region only three named variables may appear — the language-toggle URLs and the nav's
   `aria-current` — so a page and a hub are the same kind of output. The CTA band and the
   WhatsApp float carry per-page text and stay outside every region.
2. **A story pair goes to PR with zero `[חסר]` / `[مفقود]` markers** — the owner answers the
   page's gap list in session and the answers land in `FACTS.md` in the same PR — **and merges
   only after a native reader (owner / Nimer) has signed off the Arabic.**
3. **Photo originals never enter the repo.** They live in the gitignored `media/` intake; only
   the three derivatives `scripts/story-images.sh` writes are committed, with every metadata
   block stripped (GPS, timestamps, photographer) and a hard floor of 1600×800 on the source.

## Consequences

- `CLAUDE.md` Stories: "sitemap.xml, both hubs and every page's chrome are generated"; the
  `story-author` skill is the authoring path.
- Hot-fixing a nav link on one page is impossible by design — the deploy's generator run would
  revert it. Fix the template.
- The generator also refuses a non-kebab slug, a leftover `{{PLACEHOLDER}}`, a referenced
  `/img/stories/…` file that does not exist, and an `og:image` other than the slug's `card.jpg`.
- Mandate item 11 (drafting on the Actions runner) inherits a macOS-only image script — logged
  in the plan's follow-ups.
