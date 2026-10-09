-- marca do cliente: uma linha (id 'marca') com a logo em data URL; todo mundo vê, adm ou Chefe troca
create table if not exists public.brand (
  id text primary key check (id = 'marca'),
  logo text check (logo is null or length(logo) <= 300000),
  created_at timestamptz not null default now()
);
alter table public.brand enable row level security;
drop policy if exists "marca: ver" on public.brand;
drop policy if exists "marca: criar" on public.brand;
drop policy if exists "marca: trocar" on public.brand;
create policy "marca: ver" on public.brand for select to authenticated using (true);
create policy "marca: criar" on public.brand for insert to authenticated
  with check (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4);
create policy "marca: trocar" on public.brand for update to authenticated
  using (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4) with check (true);
do $$ begin alter publication supabase_realtime add table public.brand; exception when duplicate_object then null; end $$;
