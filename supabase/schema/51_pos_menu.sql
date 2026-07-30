-- =====================================================================
--  51_pos_menu.sql — POS menu-as-data (PR 2 of the pos-menu-kitchen initiative)
--
--  The menu stops being a code literal (app-src/src/modules/pos/menu.ts) and
--  becomes owner-editable DB rows. This is the single source of truth for
--  categories, items, prices (HE/AR), add-ons, and meals; it retires the
--  hand-kept pos.menu_price() literal mirror (its price validation now reads
--  these tables) and feeds Phase 4's QR menu later.
--
--  Open house is retired going forward (owner 2026-07-28): no menu row carries
--  an open-house flag, new bills are always à-la-carte. History is untouched —
--  pricing_mode/oh_charge/is_open_house columns and pos.oh_charge() stay so a
--  reopened legacy bill still settles; new bills simply never use them.
--
--  Plan: docs/plans/pos-menu-kitchen.md. Seed = the August 2026 printed menu
--  (owner-confirmed prices) + the four hot drinks carried POS-only.
-- =====================================================================

-- ── 1) Tables ────────────────────────────────────────────────────────
create table if not exists pos.menu_categories (
  id         text primary key,                        -- stable slug ('salads', 'meals'…)
  name_he    text not null,
  name_ar    text not null,
  sort       int  not null default 0,
  pos_only   boolean not null default false,          -- sold at the POS but off the printed menu (drinks)
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists pos.menu_items (
  id          text primary key,                       -- stable slug
  category_id text not null references pos.menu_categories(id),
  name_he     text not null,
  name_ar     text not null,
  price       numeric not null default 0 check (price >= 0),
  sort        int  not null default 0,
  is_meal     boolean not null default false,         -- a combo: composition drives the picker + kitchen
  composition jsonb,                                  -- meals only: { includes:[…], slots:[{…,options:[…]}] }
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint menu_items_meal_has_composition check (not is_meal or composition is not null)
);
create index if not exists menu_items_category_idx on pos.menu_items (category_id);
-- price validation (pos.menu_price) looks an item up by name — keep active names unique
-- so the lookup is unambiguous, and a duplicate name fails closed at edit time.
create unique index if not exists menu_items_name_active_idx on pos.menu_items (name_he) where active;

-- ── 2) Audit: stamp updated_at / updated_by from the JWT on write ─────
create or replace function pos.touch_menu_actor()
returns trigger language plpgsql security definer set search_path = pos, public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt()->>'email', 'לא ידוע');
  return new;
end; $$;
drop trigger if exists menu_categories_touch on pos.menu_categories;
create trigger menu_categories_touch before insert or update on pos.menu_categories
for each row execute function pos.touch_menu_actor();
drop trigger if exists menu_items_touch on pos.menu_items;
create trigger menu_items_touch before insert or update on pos.menu_items
for each row execute function pos.touch_menu_actor();

-- ── 3) RLS: everyone who can see the POS reads the menu; only pos.menu writes ──
alter table pos.menu_categories enable row level security;
alter table pos.menu_items      enable row level security;
revoke all on pos.menu_categories, pos.menu_items from anon, authenticated;
grant select, insert, update, delete on pos.menu_categories, pos.menu_items to authenticated;

drop policy if exists menu_categories_read  on pos.menu_categories;
drop policy if exists menu_categories_write on pos.menu_categories;
drop policy if exists menu_items_read       on pos.menu_items;
drop policy if exists menu_items_write      on pos.menu_items;
-- (select …) wrapping keeps has_permission out of the per-row initplan (H4 sweep)
create policy menu_categories_read  on pos.menu_categories for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_categories_write on pos.menu_categories for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));
create policy menu_items_read  on pos.menu_items for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_items_write on pos.menu_items for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));

-- ── 4) Permission: pos.menu (owner + manager) ────────────────────────
insert into core.permissions (key, module, action, label) values
  ('pos.menu', 'pos', 'menu', 'עריכת תפריט — מנות, מחירים וקטגוריות')
on conflict (key) do nothing;
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.key = 'pos.menu'
where r.key in ('owner', 'manager')
on conflict do nothing;

-- ── 5) Retire the literal price mirror → read the menu table ─────────
-- Same contract as before: price for a known item by its Hebrew name, NULL for
-- anything not on the menu (custom lines stay the deliberate no-check escape
-- hatch). Meals validate on their own top-line price; their components are not
-- separate priced lines. `stable` (reads a table) instead of `immutable`.
create or replace function pos.menu_price(p_name text)
returns numeric language sql stable set search_path = pos as $$
  select price from pos.menu_items where name_he = p_name and active limit 1
$$;
revoke all on function pos.menu_price(text) from public, anon, authenticated;

-- ── 6) Seed: the August 2026 menu (owner-confirmed) ──────────────────
insert into pos.menu_categories (id, name_he, name_ar, sort, pos_only) values
  ('salads', 'פתיחים וסלטים',      'مقبلات وسلطات',   10, false),
  ('sea',    'מהים',               'من البحر',        20, false),
  ('mahashi','הממולאים של אסרא',    'محاشي إسراء',     30, false),
  ('taboon', 'מאפים מהטאבון',       'مخبوزات من الطابون', 40, false),
  ('sweets', 'מתוקים',             'حلويات',          50, false),
  ('meals',  'ארוחות',             'وجبات',           60, false),
  ('drinks', 'שתייה חמה',          'مشروبات ساخنة',   80, true)
on conflict (id) do update set
  name_he = excluded.name_he, name_ar = excluded.name_ar,
  sort = excluded.sort, pos_only = excluded.pos_only;

insert into pos.menu_items (id, category_id, name_he, name_ar, price, sort, is_meal, composition) values
  -- פתיחים וסלטים
  ('tahini',   'salads', 'טחינה וחמוצים', 'طحينة ومخللات', 15, 10, false, null),
  ('labneh',   'salads', 'לבנה',          'لبنة',          20, 20, false, null),
  ('cabbage',  'salads', 'סלט כרוב',      'سلطة ملفوف',    27, 30, false, null),
  ('tabbouleh','salads', 'סלט טבולה',     'تبولة',         27, 40, false, null),
  ('salad_veg','salads', 'סלט ירקות',     'سلطة خضار',     32, 50, false, null),
  ('jarjir',   'salads', 'סלט ג׳רג׳יר',   'سلطة جرجير',    32, 60, false, null),
  ('hummus',   'salads', 'החומוס של רמי', 'حمّص رامي',     33, 70, false, null),
  ('chips',    'salads', 'צ׳יפס',         'بطاطس مقلية',   30, 80, false, null),
  -- מהים
  ('fish',     'sea',    'מנת דג',        'وجبة سمك',      80, 10, false, null),
  ('shrimp',   'sea',    'שרימפס',        'جمبري',         65, 20, false, null),
  -- הממולאים של אסרא
  ('vine_leaves',   'mahashi', 'עלי גפן',       'ورق عنب',      30, 10, false, null),
  ('stuffed_cabbage','mahashi','מלפוף',         'ملفوف محشي',   30, 20, false, null),
  ('stuffed_plate', 'mahashi', 'צלחת ממולאים',  'صحن محاشي',    54, 30, false, null),
  -- מאפים מהטאבון
  ('pastry_zaatar',  'taboon', 'מאפה זעתר',        'معجنة زعتر',        20, 10, false, null),
  ('pastry_pizza',   'taboon', 'מאפה פיצה',        'معجنة بيتزا',       28, 20, false, null),
  ('pastry_spinach', 'taboon', 'מאפה תרד וגבינה',  'معجنة سبانخ وجبنة', 32, 30, false, null),
  ('pita',           'taboon', 'פיתה בעבודת יד',   'خبز بيتا يدوي',      8, 40, false, null),
  -- מתוקים
  ('watermelon', 'sweets', 'אבטיח טרי',        'بطيخ طازج', 25, 10, false, null),
  ('cookies',    'sweets', 'עוגיות בעבודת יד', 'كعك بيتي',  15, 20, false, null),
  -- ארוחות (meals) — composition.includes = the FIXED dishes (display / kitchen);
  -- all guest CHOICES live in pos.menu_option_groups (52_pos_menu_options.sql).
  ('meal_breakfast', 'meals', 'ארוחת בוקר של הדוקטור', 'فطور الدكتور', 65, 10, true,
    jsonb_build_object('includes', jsonb_build_array())),
  ('meal_hummus', 'meals', 'ארוחת חומוס', 'وجبة حمّص', 55, 20, true,
    jsonb_build_object('includes', jsonb_build_array(
      jsonb_build_object('name_he','מנת חומוס','name_ar','صحن حمّص'),
      jsonb_build_object('name_he','סלט ירקות','name_ar','سلطة خضار'),
      jsonb_build_object('name_he','טחינה וחמוצים','name_ar','طحينة ومخللات')))),
  ('meal_chef', 'meals', 'ארוחת השף', 'وجبة الشيف', 75, 30, true,
    jsonb_build_object('includes', jsonb_build_array(
      jsonb_build_object('name_he','מיקס ממולאים','name_ar','تشكيلة محاشي'),
      jsonb_build_object('name_he','טחינה וחמוצים','name_ar','طحينة ومخللات')))),
  ('meal_fisherman', 'meals', 'ארוחת הדייג', 'وجبة الصيّاد', 110, 40, true,
    jsonb_build_object('includes', jsonb_build_array(
      jsonb_build_object('name_he','מנת דג','name_ar','وجبة سمك'),
      jsonb_build_object('name_he','צ׳יפס','name_ar','بطاطس مقلية')))),
  -- שתייה חמה (POS-only, carried from the previous menu)
  ('drink_espresso',    'drinks', 'אספרסו / שחור', 'إسبريسو / قهوة سوداء', 5,  10, false, null),
  ('drink_coffee_milk', 'drinks', 'קפה עם חלב',    'قهوة بحليب',           8,  20, false, null),
  ('drink_tea_cup',     'drinks', 'תה בכוס',       'شاي بكوب',             8,  30, false, null),
  ('drink_tea_pot',     'drinks', 'קנקן תה',       'إبريق شاي',            15, 40, false, null)
on conflict (id) do update set
  category_id = excluded.category_id, name_he = excluded.name_he, name_ar = excluded.name_ar,
  price = excluded.price, sort = excluded.sort,
  is_meal = excluded.is_meal, composition = excluded.composition;
