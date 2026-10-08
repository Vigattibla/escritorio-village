-- etapas do quadro: a equipe cria, renomeia e exclui colunas; o tipo (todo/doing/review/done) mantém metas e aprovações
alter table public.tasks add column if not exists stage text;

create table if not exists public.stages (
  id text primary key check (char_length(id) between 1 and 64),
  label text not null check (char_length(label) between 1 and 40),
  kind text not null check (kind in ('todo', 'doing', 'review', 'done')),
  pos real not null default 0,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.stages enable row level security;

drop policy if exists "etapas: ver" on public.stages;
drop policy if exists "etapas: criar" on public.stages;
drop policy if exists "etapas: editar" on public.stages;
drop policy if exists "etapas: apagar" on public.stages;
create policy "etapas: ver" on public.stages for select to authenticated using (true);
create policy "etapas: criar" on public.stages for insert to authenticated with check (public.rank_of(auth.uid()) >= 2);
create policy "etapas: editar" on public.stages for update to authenticated using (public.rank_of(auth.uid()) >= 2);
create policy "etapas: apagar" on public.stages for delete to authenticated using (public.rank_of(auth.uid()) >= 2);

do $$ begin alter publication supabase_realtime add table public.stages; exception when duplicate_object then null; end $$;
