-- =====================================================================
--  52_pos_menu_options.sql — per-item option groups (PR 2b)
--
--  Owner feedback (2026-07-29): add-ons are not standalone items — they are
--  OPTIONS on an item, and meals use the same mechanism. An item (or meal)
--  carries option groups of three kinds:
--    choice — pick one (breakfast spread לבנה|טחינה, main שקשוקה|חביתה)
--    count  — a quantity min..max with `included` free units, each extra priced
--             (hummus pita: 1 free, extra +₪5; breakfast pita 0–1 free)
--    add    — optional add(s), each priced (egg +₪5, olives +₪5)
--
--  Meals keep their FIXED dishes in pos.menu_items.composition.includes (display /
--  kitchen), and move all guest CHOICES here. The standalone add-on items are gone
--  (removed from 51's seed). Line price = base + Σ selected option deltas; the
--  close-path validates that server-side (see the pos_close_table change below).
--
--  Plan: docs/plans/pos-menu-kitchen.md.
-- =====================================================================

-- ── 1) Tables ────────────────────────────────────────────────────────
create table if not exists pos.menu_option_groups (
  id         text primary key,
  item_id    text not null references pos.menu_items(id) on delete cascade,
  name_he    text not null,
  name_ar    text not null,
  kind       text not null check (kind in ('choice', 'count', 'add')),
  min_sel    int  not null default 0,     -- choice: 1 = required; add: 0; count: min qty
  max_sel    int  not null default 1,     -- choice: 1; add: N allowed; count: max qty
  included   int  not null default 0,     -- count only: free units before per-unit pricing
  sort       int  not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint menu_option_groups_sel_chk check (max_sel >= min_sel and included >= 0)
);
create index if not exists menu_option_groups_item_idx on pos.menu_option_groups (item_id);

create table if not exists pos.menu_options (
  id          text primary key,
  group_id    text not null references pos.menu_option_groups(id) on delete cascade,
  name_he     text not null,
  name_ar     text not null,
  price_delta numeric not null default 0 check (price_delta >= 0), -- per selection (count: per unit)
  sort        int  not null default 0
);
create index if not exists menu_options_group_idx on pos.menu_options (group_id);

-- ── 2) Audit trigger (reuse the menu actor stamp from 51) ────────────
drop trigger if exists menu_option_groups_touch on pos.menu_option_groups;
create trigger menu_option_groups_touch before insert or update on pos.menu_option_groups
for each row execute function pos.touch_menu_actor();

-- ── 3) RLS: read with pos.view, write with pos.menu (same as the menu) ──
alter table pos.menu_option_groups enable row level security;
alter table pos.menu_options       enable row level security;
revoke all on pos.menu_option_groups, pos.menu_options from anon, authenticated;
grant select, insert, update, delete on pos.menu_option_groups, pos.menu_options to authenticated;

drop policy if exists menu_option_groups_read  on pos.menu_option_groups;
drop policy if exists menu_option_groups_write on pos.menu_option_groups;
drop policy if exists menu_options_read        on pos.menu_options;
drop policy if exists menu_options_write       on pos.menu_options;
create policy menu_option_groups_read  on pos.menu_option_groups for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_option_groups_write on pos.menu_option_groups for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));
create policy menu_options_read  on pos.menu_options for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_options_write on pos.menu_options for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));

-- (server-side price validation lives in 53_pos_close_options.sql: pos.option_charge
--  computes an option's effective charge, and the close path validates each line.)

-- ── 4) Seed: item options + meal option groups ───────────────────────
-- egg / olives as options on the items that offer them
insert into pos.menu_option_groups (id, item_id, name_he, name_ar, kind, min_sel, max_sel, included, sort) values
  ('g_hummus_add',  'hummus',         'תוספות', 'إضافات', 'add',   0, 1, 0, 10),
  ('g_hummus_pita', 'hummus',         'פיתה',   'خبز',    'count', 0, 4, 1, 20),  -- like the meal: 1 free, extras +₪5
  ('g_spinach_add', 'pastry_spinach', 'תוספות', 'إضافات', 'add',   0, 1, 0, 10),
  ('g_pizza_add',   'pastry_pizza',   'תוספות', 'إضافات', 'add',   0, 1, 0, 10)
on conflict (id) do update set item_id = excluded.item_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, kind = excluded.kind, min_sel = excluded.min_sel,
  max_sel = excluded.max_sel, included = excluded.included, sort = excluded.sort;
insert into pos.menu_options (id, group_id, name_he, name_ar, price_delta, sort) values
  ('o_hummus_egg',   'g_hummus_add',  'תוספת ביצה',  'إضافة بيضة',  5, 10),
  ('o_hummus_pita',  'g_hummus_pita', 'פיתה',        'خبز',         5, 20),
  ('o_spinach_egg',  'g_spinach_add', 'תוספת ביצה',  'إضافة بيضة',  5, 10),
  ('o_pizza_olives', 'g_pizza_add',   'תוספת זיתים', 'إضافة زيتون', 5, 10)
on conflict (id) do update set group_id = excluded.group_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, price_delta = excluded.price_delta, sort = excluded.sort;

-- meal choices (fixed meal dishes stay in menu_items.composition.includes)
insert into pos.menu_option_groups (id, item_id, name_he, name_ar, kind, min_sel, max_sel, included, sort) values
  -- ארוחת בוקר של הדוקטור
  ('g_bf_main',   'meal_breakfast', 'עיקרית', 'الطبق الرئيسي', 'choice', 1, 1, 0, 10),
  ('g_bf_salad',  'meal_breakfast', 'סלט',    'سلطة',          'choice', 1, 1, 0, 20),
  ('g_bf_spread', 'meal_breakfast', 'ממרח',   'إضافة',         'choice', 1, 1, 0, 30),
  ('g_bf_pita',   'meal_breakfast', 'פיתה',   'خبز',           'count',  0, 4, 1, 40),  -- 1 free, extras +₪5
  -- ארוחת חומוס
  ('g_hm_add',    'meal_hummus',    'תוספות', 'إضافات', 'add',   0, 1, 0, 10),
  ('g_hm_pita',   'meal_hummus',    'פיתה',   'خبز',    'count', 0, 4, 1, 20),
  -- ארוחת השף
  ('g_chef_salad',  'meal_chef', 'סלט',  'سلطة',  'choice', 1, 1, 0, 10),
  ('g_chef_pastry', 'meal_chef', 'מאפה', 'معجنة', 'choice', 1, 1, 0, 20),
  -- ארוחת הדייג
  ('g_fish_salad', 'meal_fisherman', 'סלט', 'سلطة', 'choice', 1, 1, 0, 10)
on conflict (id) do update set item_id = excluded.item_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, kind = excluded.kind, min_sel = excluded.min_sel,
  max_sel = excluded.max_sel, included = excluded.included, sort = excluded.sort;

insert into pos.menu_options (id, group_id, name_he, name_ar, price_delta, sort) values
  ('o_bf_shakshuka', 'g_bf_main',  'שקשוקה',    'شكشوكة',   0, 10),
  ('o_bf_omelet',    'g_bf_main',  'חביתה',     'عجة',      0, 20),
  ('o_bf_omelet_veg','g_bf_main',  'חביתת ירק', 'عجة خضار', 0, 30),
  ('o_bf_salad_cab', 'g_bf_salad', 'סלט כרוב',   'سلطة ملفوف', 0, 10),
  ('o_bf_salad_tab', 'g_bf_salad', 'סלט טבולה',  'تبولة',      0, 20),
  ('o_bf_salad_veg', 'g_bf_salad', 'סלט ירקות',  'سلطة خضار',  0, 30),
  ('o_bf_salad_jar', 'g_bf_salad', 'סלט ג׳רג׳יר','سلطة جرجير', 0, 40),
  ('o_bf_labneh',    'g_bf_spread','לבנה',   'لبنة',           0, 10),
  ('o_bf_tahini',    'g_bf_spread','טחינה',  'طحينة',          0, 20),
  ('o_bf_pita',      'g_bf_pita',  'פיתה',   'خبز',            5, 10),
  ('o_hm_egg',       'g_hm_add',   'תוספת ביצה', 'إضافة بيضة', 5, 10),
  ('o_hm_pita',      'g_hm_pita',  'פיתה',   'خبز',            5, 10),
  ('o_chef_salad_cab', 'g_chef_salad', 'סלט כרוב',   'سلطة ملفوف', 0, 10),
  ('o_chef_salad_tab', 'g_chef_salad', 'סלט טבולה',  'تبولة',      0, 20),
  ('o_chef_salad_veg', 'g_chef_salad', 'סלט ירקות',  'سلطة خضار',  0, 30),
  ('o_chef_salad_jar', 'g_chef_salad', 'סלט ג׳רג׳יר','سلطة جرجير', 0, 40),
  ('o_chef_zaatar',  'g_chef_pastry', 'מאפה זעתר',       'معجنة زعتر',        0, 10),
  ('o_chef_pizza',   'g_chef_pastry', 'מאפה פיצה',       'معجنة بيتزا',       0, 20),
  ('o_chef_spinach', 'g_chef_pastry', 'מאפה תרד וגבינה', 'معجنة سبانخ وجبنة', 0, 30),
  ('o_fish_salad_cab', 'g_fish_salad', 'סלט כרוב',   'سلطة ملفوف', 0, 10),
  ('o_fish_salad_tab', 'g_fish_salad', 'סלט טבולה',  'تبولة',      0, 20),
  ('o_fish_salad_veg', 'g_fish_salad', 'סלט ירקות',  'سلطة خضار',  0, 30),
  ('o_fish_salad_jar', 'g_fish_salad', 'סלט ג׳רג׳יר','سلطة جرجير', 0, 40)
on conflict (id) do update set group_id = excluded.group_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, price_delta = excluded.price_delta, sort = excluded.sort;
