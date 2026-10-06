# Brief — {{TITLE}} (`{{SLUG}}`)

*Written {{DATE}} with the `new-video` skill · type: {{TYPE}} · status: draft → approved (Gate 1
{{GATE1_DATE}}) → built → reviewed (Gate 2) → rendered → posted*

> This file is the complete prompt. A build session reads **`video/GUIDELINES.md`
> first**, then follows this brief shot by shot. Nothing on screen that is not written here.

## Spec

- **Composition ids:** `{{SLUG}}-he-{{HOOK_A}}`, `{{SLUG}}-he-{{HOOK_B}}`, `{{SLUG}}-ar-{{HOOK_A}}`, `{{SLUG}}-ar-{{HOOK_B}}`
- **Size / fps / length:** 1080 × 1920 · 30 fps · {{SECONDS}} s = {{FRAMES}} frames {{FEED_VARIANT}}
- **Languages:** HE and AR ({{AR_REVIEWER}} signs the Arabic off before posting)
- **Audio:** none
- **Rules:** guidelines §3 (safe zone: `ZONE`, `<SafeZone />` on in Studio), §4 (type, RTL), §5 (motion), §6 (compose from the kit) — as read on {{DATE}}; the guidelines win where this brief and they diverge
- **Facts:** only the lines cited below; nothing invented; no prices; no names

## Goal

{{ONE_SENTENCE_GOAL}} — for {{AUDIENCE}}. **The one ask:** "{{CTA_HE}}" / "{{CTA_AR}}" → {{CTA_TARGET}}.

## Facts used (source · line)

| On screen | Source |
|---|---|
| {{FACT}} | `FACTS.md` § … / `/happening/{{PAGE}}/` read {{DATE}} |

Missing: {{GAPS_OR_NONE}}

## Assets (by path)

| Shot | File | Why this one · crop / focus |
|---|---|---|
| 1 | `site/hero.mp4` (from `img/hero/hero.mp4`) | … |

## Shots

Frame counts at 30 fps; transitions are 15 frames and shorten the timeline; overlays do not.

| # | Seconds (frames) | Beat | HE copy (exact) | AR copy (exact) | Asset | Kit motion / transition in |
|---|---|---|---|---|---|---|
| 1A | 0–3.3 (98) | HOOK **{{HOOK_A}}** | "…" | "… [ar-draft]" | … | `Words` headline + `Accent`; frame 0 is a scroll-stop frame |
| 1B | 0–3.3 (98) | HOOK **{{HOOK_B}}** | "…" | "… [ar-draft]" | … | … (everything after shot 1 is shared) |
| 2 | … | … | … | … | … | `sunIris` in → `KenBurns` ≤ 1.08 … |
| n | last ≥ 1.5 s | END CARD | "{{CTA_HE}}" | "{{CTA_AR}}" | `site/logo.png` | `heartZoom` in; everything settled; the last 45 frames hold still |

## Acceptance (this reel's additions to `review.md`'s standard checks)

- [ ] Every fact on screen matches the Facts table above
- [ ] {{REEL_SPECIFIC_CHECK}} (e.g. "the hours card shows both days", "the aerial stays a card")
- [ ] Arabic signed off by {{AR_REVIEWER}} before posting

## Render matrix

| Composition | File |
|---|---|
| `{{SLUG}}-he-{{HOOK_A}}` | `out/{{SLUG}}-he-{{HOOK_A}}.mp4` + `out/{{SLUG}}-he-cover.png` |
| `{{SLUG}}-he-{{HOOK_B}}` | `out/{{SLUG}}-he-{{HOOK_B}}.mp4` |
| `{{SLUG}}-ar-{{HOOK_A}}` | `out/{{SLUG}}-ar-{{HOOK_A}}.mp4` + `out/{{SLUG}}-ar-cover.png` |
| `{{SLUG}}-ar-{{HOOK_B}}` | `out/{{SLUG}}-ar-{{HOOK_B}}.mp4` |

## Out of scope for this reel

- {{OUT_OF_SCOPE}}

## Log

- {{DATE}} — brief written; Gate 1: …
