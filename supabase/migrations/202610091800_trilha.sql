-- timelapse do dia: cada pessoa grava a própria trilha (pontos [segundo do dia, x, y, ...]) uma linha por dia
create table if not exists public.trilha (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dia date not null,
  pts jsonb not null default '[]'::jsonb check (jsonb_typeof(pts) = 'array' and jsonb_array_length(pts) <= 18000),
  updated_at timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.trilha enable row level security;
drop policy if exists "trilha: ver" on public.trilha;
drop policy if exists "trilha: gravar" on public.trilha;
drop policy if exists "trilha: atualizar" on public.trilha;
drop policy if exists "trilha: apagar" on public.trilha;
create policy "trilha: ver" on public.trilha for select to authenticated using (true);
create policy "trilha: gravar" on public.trilha for insert to authenticated with check (user_id = auth.uid());
create policy "trilha: atualizar" on public.trilha for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trilha: apagar" on public.trilha for delete to authenticated using (user_id = auth.uid());
