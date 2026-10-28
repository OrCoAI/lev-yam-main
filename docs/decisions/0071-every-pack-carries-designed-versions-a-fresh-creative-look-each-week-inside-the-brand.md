# 0071 — Every pack carries designed versions: a fresh creative look each week, inside the brand

- **Date:** 2026-10-28
- **Status:** accepted — adds a design step to the weekly pack of [plans/content-media-foundation.md](../plans/content-media-foundation.md); works inside [0068](0068-content-system-home-is-the-repo-one-fenced-drive-area-cowork-engine-retired.md) (the fence, draft-only) and [0069](0069-every-published-piece-is-built-from-ids-and-recorded-content-records-additive-never-load-bearing.md) (IDs, consent scope, pixels-only, reader-signed Arabic)
- **Decided by:** owner + Claude Code
- **Source:** the first pack (`Ready to post/2026-10-28`, PR #155). The owner opened it and said: *"I don't see any design or nothing"*. Claude then made one branded set from `brand/`, and the owner answered the closed question *"Should this design become the weekly template?"* with *"every week create different creative designs"* (session, 2026-10-28)

## Context

`scripts/media.sh` cuts a photo to a channel's size and strips its metadata. That is all it
does: it adds no type, logo or brand element. So the first pack held plain photos and a `.txt`
of captions. Before that the brand layer had two homes:
- `media.sh --brand` copies logo files and does no layout;
- the designer's starting list in `brand/README.md` asks for empty template masters and, after
  that, "the look of the month". None has been delivered.

A post looked designed only if someone designed it by hand. Claude made one branded set for the
first pack: a cream band, the logo's zigzag waves, the headline in HE and AR, and the logo. The
owner did not want that set to become a fixed template. The owner wants a different creative
design every week.

## Decision

1. **Every piece in a pack gets a designed version.** It is written beside the plain cut as
   `<post id>-designed.jpg`. The plain cut stays in the pack, and the owner chooses which to post.
2. **The look is fresh every week. There is no fixed template.** Each week changes the layout, the
   type treatment, how the brand elements are used, and where the words sit. Before designing,
   Claude looks at last week's `-designed` files and does not repeat their look. Pieces in one pack
   may share a look or not; the photo decides.
3. **Fresh never means off-brand.** `brand/README.md` and `brand/tokens.json` hold:
   - colours: the three brand colours and the derived shades only;
   - fonts: Assistant and Heebo for Hebrew and Latin, Noto Sans Arabic for Arabic (until the
     Futura question is settled);
   - the logo rules: never recoloured, stretched or shadowed, and never full-colour on a busy
     area of the photo;
   - each icon only in its own meaning;
   - Hebrew and Arabic never letter-spaced.
4. **Words on the image are the piece's own signed words.** Every line is taken word for word from
   that piece's captions after the owner has signed them, so §7 of 0069 covers the on-image
   Arabic too. Never a new claim, a fact outside `FACTS.md`, a price or a name. A time or number
   range inside Hebrew or Arabic is pinned left-to-right (LRI … PDI); otherwise phones show it
   reversed.
5. **The channel limits hold.**
   - Google Business shows the place as it is: a small logo at most, no text.
   - A status or story keeps its text clear of the top and bottom strips where the app draws
     its own controls.
   - Text never covers a face.
6. **The design inherits its source.** It is made only from a cut that `media.sh` already
   produced for that piece. So the media ID, the consent scope and the WhatsApp-copy rules were
   already checked, and a design never brings in a new photo.
7. **Output follows the pack's rules.** The file is a pixels-only JPEG in
   `Ready to post/<date>/`, never replacing a file already there. The working source (HTML and
   fonts) stays in the session's scratch directory: a design is a one-week artefact, not a repo
   asset. The file name carries the post ID, which ties the design to its record, so the record
   gets no new field.

## Consequences

- `content-week` gains a design step after the Arabic sign-off, because the words come from the
  signed captions. A piece left unsigned carries Hebrew only on its design.
- The designer's deliveries become inputs, not a fixed frame. When template masters or a "look of
  the month" arrive in `Brand/`, a week may build on them, and the next week still changes.
- With no fixed template, a design cannot be checked mechanically. The rules above are checked
  by eye in the session, and the owner sees every design before posting (draft-only, 0068).
  If designs keep needing the same fix, that is evidence for a rule here, not for a template.
- Pack time grows by the design step, which is Claude's time, not the owner's. The owner's
  session stays a look and a choice per piece.
