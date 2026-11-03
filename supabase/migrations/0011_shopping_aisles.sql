-- Every shopping item sits in a supermarket aisle, and the house remembers where each product goes:
-- once the AI or a parent places "פסטרמה", it lands there every time after. A parent's choice
-- (source 'user') is never overwritten by the AI.

alter table public.shopping_items
  add column category text check (
    category in ('produce', 'bakery', 'meat', 'dairy', 'pantry', 'snacks', 'drinks', 'frozen', 'cleaning', 'care', 'other')
  );

create table public.shopping_categories (
  household_id uuid not null references public.households (id) on delete cascade,
  item_key text not null,
  category text not null check (
    category in ('produce', 'bakery', 'meat', 'dairy', 'pantry', 'snacks', 'drinks', 'frozen', 'cleaning', 'care', 'other')
  ),
  source text not null default 'ai' check (source in ('ai', 'user')),
  updated_at timestamptz not null default now(),
  primary key (household_id, item_key)
);

alter table public.shopping_categories enable row level security;

create policy "household reads aisles" on public.shopping_categories
  for select using (household_id = public.my_household_id());

create policy "household adds aisles" on public.shopping_categories
  for insert with check (household_id = public.my_household_id());

create policy "household changes aisles" on public.shopping_categories
  for update using (household_id = public.my_household_id());
