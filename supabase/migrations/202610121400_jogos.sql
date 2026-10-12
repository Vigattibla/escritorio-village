-- sala de jogos: melhor pontuação de cada pessoa por jogo e por mês (base pra competição do mês no futuro)
create table if not exists public.jogos_pontos (
  id text primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dept text not null default public.my_dept(),
  jogo text not null check (jogo in ('cobrinha', 'penalti', 'memoria', 'reflexo')),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  pontos integer not null default 0 check (pontos between 0 and 100000),
  partidas integer not null default 1 check (partidas between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, jogo, mes)
);
create index if not exists jogos_pontos_mes on public.jogos_pontos (dept, mes);

-- setor vem do perfil (não do app); recorde nunca baixa; id sempre dono:jogo:mês
create or replace function public.jogos_pontos_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.dept := public.dept_of(new.user_id);
    new.created_at := now();
  else
    new.user_id := old.user_id; new.jogo := old.jogo; new.mes := old.mes; new.dept := old.dept; new.created_at := old.created_at;
    new.pontos := greatest(old.pontos, new.pontos);
    new.partidas := greatest(old.partidas, new.partidas);
  end if;
  new.id := new.user_id || ':' || new.jogo || ':' || new.mes;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists jogos_pontos_guard on public.jogos_pontos;
create trigger jogos_pontos_guard before insert or update on public.jogos_pontos for each row execute function public.jogos_pontos_guard();

alter table public.jogos_pontos enable row level security;
drop policy if exists "jogos: ver" on public.jogos_pontos;
drop policy if exists "jogos: criar" on public.jogos_pontos;
drop policy if exists "jogos: editar" on public.jogos_pontos;
create policy "jogos: ver" on public.jogos_pontos for select to authenticated
  using (dept = public.my_dept() or public.rank_of(auth.uid()) = 4 or public.is_admin(auth.uid()));
create policy "jogos: criar" on public.jogos_pontos for insert to authenticated with check (user_id = auth.uid());
create policy "jogos: editar" on public.jogos_pontos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.jogos_pontos; exception when duplicate_object then null; end $$;
