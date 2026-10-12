# 0069 — Every published piece is built from media IDs and recorded back; the content records are additive, never load-bearing; one derivative script; consent has a scope; every public Arabic text is reader-signed

- **Date:** 2026-10-08
- **Status:** accepted — applies [0013](0013-platform-telemetry-separate-envs-allow-list-additive.md)'s "additive, never load-bearing" to content; extends [0049](0049-story-chrome-is-generated-and-a-pair-merges-complete.md)'s metadata-stripped derivatives and `media/README.md`'s consent line from stories to every channel; widens the native-reader rule of [0007](0007-story-page-ships-only-with-arabic-twin.md) / CLAUDE.md (stories) and [0055](0055-whats-happening-arabic-may-be-machine-drafted-but-never-published-unreviewed.md) (initiatives) to every channel
- **Decided by:** owner (kickoff of `docs/plans/content-media-foundation.md`) + Claude Code
- **Source:** the owner's question *"If I will want to create videos with Remotion and new posts based on our media it will get aligned and organized afterwards, correct?"* and the alignment answers that followed, 2026-10-08

## Context

Nothing recorded which photo was used where. The Remotion asset map renamed a gallery file and no
record tied the reel to the photo; reel briefs named raw files that exist on one Mac; gallery alts
described the wrong photo for months; some gallery files were WhatsApp-compressed copies nobody
knew were copies (the plan's §Inventory has the list). A system where content is made from file
paths cannot answer "where is this used", "what is still unused" or "is this face cleared".

## Decision

1. **Every original gets an ID when it is sorted** (`YYYY-MM-<occasion>-NN`), with one record in
   `content/media.json`: the committed renditions, alt text HE + AR, where it is used, consent,
   published date. **The ID is the only key the public repo holds**: the ID → Drive-file mapping
   lives in a sheet inside the fence, never in the repo — a Drive file ID resolves to the
   unstripped original (GPS, uncleared faces) the day any folder is shared "anyone with the link",
   and git history would keep it forever. No names, no locations either. The record's alt is the
   source; a page alt that differs fails the check, and so does a Drive-ID-shaped string or a
   `drive.google.com` URL anywhere under `content/`.
2. **A reel, a post, a story image or a GBP update is built from IDs, never from file paths.**
   Briefs, packs and asset maps resolve IDs through the record's renditions; a brief or post that
   names a raw file fails `check-content.mjs`.
3. **Every finished piece is recorded back** (`content/posts/<id>.md`: sources, captions, channel,
   `posted` date — empty until the owner marks it — `expires` where time-bound, UTM, the
   experiment if any, results at +7 days as totals only) — the one publish record, for reels too.
   The post ID is the UTM campaign, the join key to GA4; the snapshot keeps a `utm_campaign` value
   only when it matches an existing post record, since the dimension is free text anyone can set
   (the ADR 0047 injection path). A piece posted outside the pack is recorded by hand in the next
   session.
4. **Consent has a scope — `none | site | social | ads`** — recorded in the Drive consent sheet at
   the weekly sort and mirrored on the record. A photo of a recognisable person is used only within
   its scope; the check refuses anything else. Children: never without explicit consent.
5. **The records are additive, never load-bearing.** No page, feed or build reads `content/` or
   `brand/` at runtime or at build time: `brand/assets/` and `brand/tokens.json` are *sources* —
   a script copies the served logo and icon files into `img/`, and the check compares the CSS
   custom properties and the Remotion theme against the tokens. One stated exception: `video/`
   is never deployed (ADR 0064), so its asset sync may resolve IDs through the records — a broken
   record then fails a local render, nothing live. A broken or missing record fails CI, never a
   deploy; reverting the content system changes nothing live.
6. **Derivatives come from one script** (`scripts/media.sh`, presets per channel in
   `content/channels.json` — the one home of sizes), written from pixels only: no EXIF, GPS, ICC or
   XMP survives into a public file, whatever the channel. The one non-script path is the
   `/app/events` browser upload (ADR 0059's small copies): it is bound by the same pixels-only
   rule and the check asserts its size constants agree with the preset row.
7. **Every public Arabic text on every channel — captions, alts, profile text — is signed off by
   the native reader before it is posted.** Machine drafting is allowed; posting unreviewed is not.

## Consequences

- "Where is this photo used", "what hasn't been used yet", "what did we post this week" are
  queries over two files, not anyone's memory; the freshness numbers in the weekly report are
  computed from them.
- Adding a channel adds a preset row; the script needs no new code path for a new size.
- The video plan's publish log, `video/GUIDELINES.md` §8–9 and the Remotion asset map follow this
  ADR (the plan's PRs B and C carry the edits).
- The weekly pack waits on the Arabic reader; a named reader with a short turnaround is a
  precondition of the loop, not an optional step.
