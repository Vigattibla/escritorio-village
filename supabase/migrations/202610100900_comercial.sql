-- Comercial: quadro de quartos disponíveis, vendas, metas, placar (pontos/tiers/prêmios) e campanhas do Marketing.
-- Sala que vende = depts.vendas. Pontos não ficam gravados: o app calcula a partir das vendas + regras (vendas_cfg).

alter table public.depts add column if not exists vendas boolean not null default false;
update public.depts set vendas = true where id = 'comercial';

-- jeito da sala ganha "vende"; troca a assinatura (a antiga some pra não dar chamada ambígua)
drop function if exists public.set_dept_look(text, text, boolean);
create or replace function public.set_dept_look(p_dept text, p_flag text, p_canais boolean, p_vendas boolean default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4
          or (public.rank_of(auth.uid()) >= 3 and public.my_dept() = p_dept)) then
    raise exception 'Só o gerente da sala, a Chefe ou o adm mudam a sala.';
  end if;
  if p_flag is not null and p_flag !~ '^[a-z-]{1,32}$' then raise exception 'Bandeira inválida.'; end if;
  update public.depts set flag = p_flag, canais = coalesce(p_canais, canais), vendas = coalesce(p_vendas, vendas) where id = p_dept;
  if not found then raise exception 'Essa sala não existe.'; end if;
end $$;
revoke all on function public.set_dept_look(text, text, boolean, boolean) from public;
grant execute on function public.set_dept_look(text, text, boolean, boolean) to authenticated;

-- quem é da sala que vende / quem manda no comercial / quem vê o placar
create or replace function public.vende(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select d.vendas from public.depts d where d.id = public.dept_of(uid)), false)
$$;
create or replace function public.manda_vendas(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and (public.is_admin(uid) or public.rank_of(uid) = 4 or (public.vende(uid) and public.rank_of(uid) >= 3))
$$;
create or replace function public.ve_vendas(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and (public.is_admin(uid) or public.rank_of(uid) = 4 or public.vende(uid))
$$;
-- campanha: gerência do comercial ou sala que publica (Marketing)
create or replace function public.edita_campanha(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and (public.manda_vendas(uid)
    or coalesce((select d.canais from public.depts d where d.id = public.dept_of(uid)), false))
$$;
grant execute on function public.vende(uuid), public.manda_vendas(uuid), public.ve_vendas(uuid), public.edita_campanha(uuid) to authenticated;

-- ---------- tipos de quarto (o quadro) ----------
create table if not exists public.quartos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 40),
  total smallint not null default 0 check (total between 0 and 999),
  pos smallint not null default 0,
  cor text not null default '#2440FF' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- vendas (cada reserva fechada) ----------
create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quarto_id uuid not null references public.quartos(id) on delete restrict,
  entrada date not null,
  saida date not null,
  qtd smallint not null default 1 check (qtd between 1 and 99),
  valor numeric(12,2) not null default 0 check (valor >= 0 and valor < 10000000),
  nota text check (nota is null or char_length(nota) <= 200),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (saida > entrada and saida - entrada <= 60)
);
create index if not exists vendas_periodo on public.vendas (entrada, saida);

-- ---------- ajuste manual do quadro (contagem do dia; vendas lançadas depois descontam dela) ----------
create table if not exists public.ajustes (
  id text primary key check (char_length(id) <= 60),
  quarto_id uuid not null references public.quartos(id) on delete cascade,
  dia date not null,
  livres smallint not null check (livres between 0 and 999),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quarto_id, dia)
);

-- ---------- metas do mês (user_id nulo = meta do time) ----------
create table if not exists public.metas_venda (
  id text primary key check (char_length(id) <= 60),
  user_id uuid references public.profiles(id) on delete cascade,
  mes text not null check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  alvo numeric(12,2) not null default 0 check (alvo >= 0 and alvo < 100000000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- regras do placar (linha única 'cfg') ----------
create table if not exists public.vendas_cfg (
  id text primary key check (id = 'cfg'),
  pts_venda int not null default 10 check (pts_venda between 0 and 10000),
  pts_mil int not null default 10 check (pts_mil between 0 and 10000),
  tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(tiers) = 'array' and jsonb_array_length(tiers) <= 12),
  premios jsonb not null default '[]'::jsonb check (jsonb_typeof(premios) = 'array' and jsonb_array_length(premios) <= 30),
  pasta jsonb,
  created_at timestamptz not null default now()
);

-- ---------- campanhas (Marketing publica, Comercial usa) ----------
create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 80),
  texto text not null default '' check (char_length(texto) <= 1000),
  inicio date,
  fim date,
  cor text not null default '#FF7A1A' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  pasta jsonb,
  link text check (link is null or char_length(link) <= 300),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- permissões ----------
do $$
declare t text;
begin
  foreach t in array array['quartos','vendas','ajustes','metas_venda','vendas_cfg','campanhas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ': ver', t);
    execute format('drop policy if exists %I on public.%I', t || ': criar', t);
    execute format('drop policy if exists %I on public.%I', t || ': editar', t);
    execute format('drop policy if exists %I on public.%I', t || ': apagar', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- quartos: todo mundo vê; quem manda no comercial monta o quadro
create policy "quartos: ver" on public.quartos for select to authenticated using (true);
create policy "quartos: criar" on public.quartos for insert to authenticated with check (public.manda_vendas(auth.uid()));
create policy "quartos: editar" on public.quartos for update to authenticated using (public.manda_vendas(auth.uid())) with check (true);
create policy "quartos: apagar" on public.quartos for delete to authenticated using (public.manda_vendas(auth.uid()));

-- vendas: o comercial vê; cada um lança a própria (gerente lança/corrige de qualquer um)
create policy "vendas: ver" on public.vendas for select to authenticated using (public.ve_vendas(auth.uid()));
create policy "vendas: criar" on public.vendas for insert to authenticated
  with check (created_by = auth.uid() and (public.manda_vendas(auth.uid()) or (public.vende(auth.uid()) and user_id = auth.uid())));
create policy "vendas: editar" on public.vendas for update to authenticated
  using (public.manda_vendas(auth.uid()) or user_id = auth.uid())
  with check (public.manda_vendas(auth.uid()) or user_id = auth.uid());
create policy "vendas: apagar" on public.vendas for delete to authenticated using (public.manda_vendas(auth.uid()) or user_id = auth.uid());

-- ajustes: todo mundo vê o quadro; qualquer vendedor corrige a contagem
create policy "ajustes: ver" on public.ajustes for select to authenticated using (true);
create policy "ajustes: criar" on public.ajustes for insert to authenticated with check (public.ve_vendas(auth.uid()));
create policy "ajustes: editar" on public.ajustes for update to authenticated using (public.ve_vendas(auth.uid())) with check (true);
create policy "ajustes: apagar" on public.ajustes for delete to authenticated using (public.ve_vendas(auth.uid()));

-- metas: o comercial vê; gerente define todas, vendedor define a própria
create policy "metas_venda: ver" on public.metas_venda for select to authenticated using (public.ve_vendas(auth.uid()));
create policy "metas_venda: criar" on public.metas_venda for insert to authenticated
  with check (public.manda_vendas(auth.uid()) or (user_id = auth.uid() and public.vende(auth.uid())));
create policy "metas_venda: editar" on public.metas_venda for update to authenticated
  using (public.manda_vendas(auth.uid()) or user_id = auth.uid())
  with check (public.manda_vendas(auth.uid()) or (user_id = auth.uid() and public.vende(auth.uid())));
create policy "metas_venda: apagar" on public.metas_venda for delete to authenticated using (public.manda_vendas(auth.uid()) or user_id = auth.uid());

-- regras do placar: todos leem, gerente muda
create policy "vendas_cfg: ver" on public.vendas_cfg for select to authenticated using (true);
create policy "vendas_cfg: criar" on public.vendas_cfg for insert to authenticated with check (public.manda_vendas(auth.uid()));
create policy "vendas_cfg: editar" on public.vendas_cfg for update to authenticated using (public.manda_vendas(auth.uid())) with check (true);
create policy "vendas_cfg: apagar" on public.vendas_cfg for delete to authenticated using (public.manda_vendas(auth.uid()));

-- campanhas: todos veem; Marketing e gerência do comercial editam
create policy "campanhas: ver" on public.campanhas for select to authenticated using (true);
create policy "campanhas: criar" on public.campanhas for insert to authenticated with check (public.edita_campanha(auth.uid()));
create policy "campanhas: editar" on public.campanhas for update to authenticated using (public.edita_campanha(auth.uid())) with check (true);
create policy "campanhas: apagar" on public.campanhas for delete to authenticated using (public.edita_campanha(auth.uid()));
