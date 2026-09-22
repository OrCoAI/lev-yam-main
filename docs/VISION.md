# Lev Yam — Product Vision

> לב ים is a social business in the Jisr az-Zarqa fishing village. Its base is the
> **community** — people who have the power to create their own ideas and bring them to life.
> The app exists to serve that: **in one hand, see what's happening; in the other, create
> your own work.**

## The dream

One platform — simply **Lev Yam**, no sub-brand — that serves three circles of people:

| Circle | Who | What the app gives them |
|---|---|---|
| **Operate** | Staff & managers | Run the venue: POS, bookings, shifts, inventory, finance, dashboards |
| **Create** | Community members | Propose initiatives, run them (team, events, tasks, budget), see their impact |
| **Join** | Guests & the village | Book a table, join an event, order from the menu, become part of the community |

These are not three apps. They are one platform with one identity system, where **roles decide
what each person sees and can do** — a guest today can become a community member tomorrow and
a venue creator the day after, without ever switching apps.

Membership starts **by invitation from the team** — intimate, controlled growth with people we
know. Over time the door opens wider (a request → approve flow from the public site), but that
is a later decision, not a launch requirement.

## Principles

1. **Community as creators, not consumers.** The platform's highest purpose is letting
   members bring their own ideas to life. Creation flows (**propose → approve → run**) are
   first-class, not admin afterthoughts. An initiative is a generic container for *any*
   dream — a fishing trip, a workshop, a festival, a village tour — the platform never
   hardcodes what a dream is allowed to look like.
2. **Everything is a module.** The platform is a container — role → module → action
   permissions, one schema per module, one folder per module. New capabilities (including
   member initiatives) plug in; they don't require rebuilding the core. Flexibility is the
   architecture, not a feature.
3. **One login, roles decide.** A single account per person; RBAC (enforced by Postgres RLS,
   mirrored in the UI) determines everything else. Never rely on UI gating alone.
4. **Public by default.** "See what's happening" — the shared feed/calendar of venue life and
   community initiatives — lives openly on levyam.com so the whole village and its visitors
   see the energy. Items can be marked internal; hiding is the exception, not the rule.
5. **Bilingual everywhere, from day one.** Hebrew + Levantine Arabic (RTL) inside the
   platform and on public pages alike — built into the first module, never retrofitted.
   Mobile-first: staff and members use phones during real work.
6. **Real ventures, real numbers — tightly guarded.** Initiatives track actual budgets and
   expenses through the finance module from day one, but *who sees the money* is strictly
   controlled: per-initiative access (its leads + finance permission holders), not
   platform-wide visibility.
7. **Evolution, not revolution.** The marketing site, `pos.html`, and live operations keep
   working while their replacements are built. Cut-over only after parity is proven on real
   service days.

## Where we are today (September 2026 — rewritten at the first quarterly review)

- **Live, public:** the marketing site (levyam.com, HE/AR) with a `/stories/` answer-first
  content section (template, bilingual hub, generated sitemap, `facts.txt` / `llms.txt`) —
  Phase 0 of the organic-reach track. Conversion is measured by GA4 + Meta on the WhatsApp CTA.
- **Live, platform `/app`:** one shell, Supabase auth + passkeys, role → module → action RBAC
  enforced in Postgres, four modules — **Users** (invite, lifecycle, custom roles, break-glass),
  **Finance** (entries, expected payments, categories-as-data, reconciliation, owner override,
  transfers, audit log), **Quotes** (migrated; documents rendered from the DB), **POS** (migrated
  and cut over 2026-07-15; `pos.html` is a redirect — menu-as-data, options, split payments,
  kitchen pipeline, day lifecycle posting into finance). The events and money **spines** are in
  the schema; the events module row is seeded but disabled.
- **Live, machinery:** three tiers (local · `lev-yam-staging` · prod) with a grant audit on every
  deploy; risk tiers, a decision log (46 ADRs), product skills, and the weekly / monthly /
  quarterly automations — the company-of-one operating system ([ADR 0021](decisions/0021-operating-cadence-quarterly-gate.md)).
- **Not live:** the observability home (deferred, [ADR 0045](decisions/0045-observability-home-re-deferred-to-2027-01-review.md));
  bookings still live in WhatsApp; the community has no presence in the app; nothing on the
  platform is public-facing yet.
- **The quarter ahead (2026-Q4):** marketing — reach the world, measured first
  ([ADR 0046](decisions/0046-q4-2026-mandate-marketing-quarter.md)).

The path from here to the dream is [ROADMAP.md](ROADMAP.md).
