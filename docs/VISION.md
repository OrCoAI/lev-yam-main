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

## Where we are today (July 2026)

- **Live:** marketing site (levyam.com, HE/AR), standalone POS (`pos.html`, feature-complete:
  billing, tips/discounts, combos, kitchen pipeline, day reports, expenses), community survey,
  and a quotes & contracts manager (separate local app at `~/lev-yam-quotes` — quote → contract
  → signed → confirmed event with prep checklist; the platform's **first** module migration).
- **Platform `/app` (live):** Vite + React + TS shell, Supabase auth + passkeys,
  role → module → action RBAC (`core` schema), Users admin module, Finance module.
- **The gap:** POS is outside the platform; bookings live in WhatsApp; the community has no
  presence in the app at all yet; nothing is public-facing beyond marketing.

The path from here to the dream is [ROADMAP.md](ROADMAP.md).
