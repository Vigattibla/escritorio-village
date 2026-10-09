-- caderninho: anotações rápidas de cada pessoa (só ela vê); somem em 7 dias se não forem fixadas
create table if not exists public.caderno (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 4000),
  fixa boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists caderno_dono on public.caderno (user_id, created_at);

alter table public.caderno enable row level security;
drop policy if exists "caderno: ver" on public.caderno;
drop policy if exists "caderno: criar" on public.caderno;
drop policy if exists "caderno: editar" on public.caderno;
drop policy if exists "caderno: apagar" on public.caderno;
create policy "caderno: ver" on public.caderno for select to authenticated using (user_id = auth.uid());
create policy "caderno: criar" on public.caderno for insert to authenticated with check (user_id = auth.uid());
create policy "caderno: editar" on public.caderno for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "caderno: apagar" on public.caderno for delete to authenticated using (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.caderno; exception when duplicate_object then null; end $$;
