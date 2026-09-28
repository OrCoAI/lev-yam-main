# 0055 — A "What's happening" item's Arabic may be machine-drafted (Google) but is never published unreviewed

- **Date:** 2026-09-28
- **Status:** accepted. It amends [0054](0054-whats-happening-is-db-driven-public-life-bilingual-in-the-db.md), and specifically the kickoff answer "both required, written by a person" (plan alignment Q5, 2026-09-25, which rejected auto-translate).
- **Decided by:** owner (step-zero review of PR 1, [plans/events-whats-happening.md](../plans/events-whats-happening.md))
- **Source:** owner, 2026-09-28: *"can we make a button that generate arabic translation?"* The follow-up answers chose Google Translate, "mark + confirm", and building it inside PR 1.

## Context

At kickoff the owner chose to type both languages rather than auto-translate, and invariant 5 is enforced by a CHECK constraint. Once the owner saw the form, writing Arabic for every item turned out to be the friction. The risk a button introduces is machine Arabic going live with no one who reads Arabic having checked it. For story pages, a native reader signs off before merge; here, publishing is instant. Google also returns Modern Standard Arabic, not the Levantine the site is written in.

## Decision

1. **A "תרגום מעברית" button** fills an item's Arabic title, summary and body from the Hebrew. It calls the `translate` Edge Function, which:
   - holds `GOOGLE_TRANSLATE_API_KEY` server-side, sent in a header and never in a URL;
   - re-checks `events.manage`, which also guards the spend;
   - caps one call at 8,000 characters;
   - pins the names from `FACTS.md` (לב ים → ليف يام, ג'סר א-זרקא → جسر الزرقاء) so Google cannot translate them word by word.
2. **Machine Arabic is a draft, enforced by the database.** `events.events.ar_machine_translated` is set by the button. The CHECK `events_public_reviewed_arabic` refuses `visibility = 'public'` while it is true. It is cleared when a person confirms "בדקתי את הערבית" or edits an Arabic field. The owner chose that rule: editing counts as reading.
3. **The engine is Google Translate** (owner's choice over Claude, knowing the output is formal rather than dialect). A new spend: billed per character.

## Consequences

- A new Edge Function and a new secret, so the change is Tier A. The key must be set on the staging and prod projects before the button works there; without it, the function answers `not_configured`. Local dev without a key echoes `[AR] <text>`. The function decides that from its own URL (the local stack only), because a config-file secret was pushed to staging by `supabase secrets set` (2026-09-28). With the key in the gitignored `supabase/functions/.env`, local calls Google for real.
- Telemetry records only fixed codes, never the text being translated (ADR 0013).
- Story pages keep their rule: native-reader sign-off before merge (ADR 0007). This ADR covers `/app/events` items only.
