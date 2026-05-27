-- Fix: lounge_posts edit/delete RLS
-- Owner update (Supabase phone-OTP authenticated users can edit/soft-delete their own posts)
-- Anon update (admin panel operations via anon key — TODO: migrate to service role Edge Function)

-- 1. Add missing columns (idempotent)
alter table public.lounge_posts add column if not exists is_deleted  boolean     not null default false;
alter table public.lounge_posts add column if not exists deleted_at  timestamptz;
alter table public.lounge_posts add column if not exists deleted_by  uuid references public.users(id) on delete set null;
alter table public.lounge_posts add column if not exists updated_at  timestamptz default now();

notify pgrst, 'reload schema';

-- 2. Drop old conflicting policies
drop policy if exists "lounge_posts: admin update"   on public.lounge_posts;
drop policy if exists "lounge_posts: owner insert"   on public.lounge_posts;
drop policy if exists "lounge_posts: auth insert"    on public.lounge_posts;
drop policy if exists "lounge_posts: owner update"   on public.lounge_posts;

-- 3. Owner update: phone-OTP authenticated users can edit/soft-delete own posts
create policy "lounge_posts: owner update" on public.lounge_posts
  for update to authenticated
  using   (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Anon update: admin panel uses anon key (no Supabase Auth session)
--    Application layer enforces user_id filter.
--    TODO: 추후 service role Edge Function으로 전환
create policy "lounge_posts: anon update" on public.lounge_posts
  for update to anon
  using   (true)
  with check (true);

-- 5. Admin re-add update for authenticated admin role
create policy "lounge_posts: admin update" on public.lounge_posts
  for update to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- 6. Insert: allow both anon and authenticated
create policy "lounge_posts: insert" on public.lounge_posts
  for insert to public
  with check (true);
