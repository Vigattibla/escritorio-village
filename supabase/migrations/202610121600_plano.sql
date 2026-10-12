-- Plano macro de marketing: núcleos (stakeholders) × meses do ciclo, com campanha do mês, ações, estratégia e quem executa.
-- Todo mundo vê; o Marketing (e Chefe/adm) monta e manda as ações pro quadro de cada setor.
create or replace function public.edita_plano(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and (public.is_admin(u) or public.rank_of(u) = 4 or public.dept_of(u) = 'marketing')
$$;

create table if not exists public.plano_meses (
  id text primary key,
  ciclo text not null check (ciclo ~ '^\d{4}-\d{2}$'),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  tematica text not null default '' check (char_length(tematica) <= 400),
  principal text not null default '' check (char_length(principal) <= 300),
  campanha text not null default '' check (char_length(campanha) <= 300),
  oferta text not null default '' check (char_length(oferta) <= 2000),
  persona text not null default '' check (char_length(persona) <= 2000),
  estrategia text not null default '' check (char_length(estrategia) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plano_nucleos (
  id text primary key,
  ciclo text not null check (ciclo ~ '^\d{4}-\d{2}$'),
  nome text not null check (char_length(nome) between 1 and 120),
  pos integer not null default 0,
  tipo text not null default 'acoes' check (tipo in ('acoes', 'datas')),
  created_at timestamptz not null default now()
);

create table if not exists public.plano_acoes (
  id text primary key,
  ciclo text not null check (ciclo ~ '^\d{4}-\d{2}$'),
  nucleo text not null references public.plano_nucleos(id) on delete cascade,
  pos integer not null default 0,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  dia text not null default '' check (char_length(dia) <= 40),
  resp text not null default '' check (char_length(resp) <= 60),
  texto text not null check (char_length(texto) between 1 and 1000),
  estrategia text not null default '' check (char_length(estrategia) <= 4000),
  dept text,
  pessoas uuid[] not null default '{}',
  tarefas uuid[] not null default '{}',
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plano_acoes_mes on public.plano_acoes (ciclo, mes);

-- legenda de responsáveis: sigla da planilha (MKT, PERF…) → sala e pessoas que recebem a tarefa
create table if not exists public.plano_resp (
  id text primary key check (char_length(id) between 1 and 12),
  nome text not null default '' check (char_length(nome) <= 80),
  dept text,
  pessoas uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.plano_touch() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists plano_meses_touch on public.plano_meses;
create trigger plano_meses_touch before update on public.plano_meses for each row execute function public.plano_touch();
drop trigger if exists plano_acoes_touch on public.plano_acoes;
create trigger plano_acoes_touch before update on public.plano_acoes for each row execute function public.plano_touch();

do $$
declare t text;
begin
  foreach t in array array['plano_meses', 'plano_nucleos', 'plano_acoes', 'plano_resp'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ': ver', t);
    execute format('drop policy if exists %I on public.%I', t || ': criar', t);
    execute format('drop policy if exists %I on public.%I', t || ': editar', t);
    execute format('drop policy if exists %I on public.%I', t || ': apagar', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || ': ver', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.edita_plano(auth.uid()))', t || ': criar', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.edita_plano(auth.uid())) with check (public.edita_plano(auth.uid()))', t || ': editar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.edita_plano(auth.uid()))', t || ': apagar', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;
