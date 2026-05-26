create table if not exists public.seed_lounge_posts (
  id          uuid        primary key default gen_random_uuid(),
  category    text,
  title       text,
  content     text        not null,
  image_urls  text[]      not null default '{}',
  author_name text        not null default '공간마켓',
  sort_order  int         not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table public.seed_lounge_posts enable row level security;

create policy "anon_read" on public.seed_lounge_posts
  for select using (true);

create policy "admin_all" on public.seed_lounge_posts
  for all using (true) with check (true);
