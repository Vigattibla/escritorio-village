-- Agenda do plano: cada ação aparece no dia dela. Quem é da equipe muda o dia/a pessoa
-- e começa a ação sem poder editar o plano (o texto da planilha fica intacto).
alter table public.plano_acoes add column if not exists data date;
alter table public.plano_acoes add column if not exists dono uuid references public.profiles(id) on delete set null;
-- stakeholder (núcleo) com cor e ícone próprios na visão Estratégia
alter table public.plano_nucleos add column if not exists cor text check (cor is null or cor ~ '^#[0-9A-Fa-f]{6}$');
alter table public.plano_nucleos add column if not exists icone text check (icone is null or char_length(icone) <= 40);

-- equipes (Design, Edição de vídeo, Social Media…): o gestor marca quem faz parte.
-- Quem mexe: o gerente da sala da equipe, a Chefe ou o adm.
create table if not exists public.equipes (
  id text primary key check (char_length(id) between 1 and 40),
  nome text not null check (char_length(nome) between 1 and 60),
  cor text check (cor is null or cor ~ '^#[0-9A-Fa-f]{6}$'),
  icone text check (icone is null or char_length(icone) <= 40),
  dept text,
  pessoas uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create or replace function public.gere_equipe(u uuid, d text) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and (public.is_admin(u) or public.rank_of(u) = 4
    or (public.rank_of(u) >= 3 and d is not null and public.dept_of(u) = d))
$$;
revoke all on function public.gere_equipe(uuid, text) from public;
grant execute on function public.gere_equipe(uuid, text) to authenticated;
alter table public.equipes enable row level security;
drop policy if exists "equipes: ver" on public.equipes;
drop policy if exists "equipes: criar" on public.equipes;
drop policy if exists "equipes: editar" on public.equipes;
drop policy if exists "equipes: apagar" on public.equipes;
create policy "equipes: ver" on public.equipes for select to authenticated using (true);
create policy "equipes: criar" on public.equipes for insert to authenticated with check (public.gere_equipe(auth.uid(), dept));
create policy "equipes: editar" on public.equipes for update to authenticated using (public.gere_equipe(auth.uid(), dept)) with check (public.gere_equipe(auth.uid(), dept));
create policy "equipes: apagar" on public.equipes for delete to authenticated using (public.gere_equipe(auth.uid(), dept));
do $$ begin alter publication supabase_realtime add table public.equipes; exception when duplicate_object then null; end $$;

-- a sigla do plano aponta pra equipes: quem é da equipe recebe a ação
alter table public.plano_resp add column if not exists equipes text[] not null default '{}';

-- quem edita o plano, o dono, quem está na ação ou na equipe da sigla (RESP.)
create or replace function public.plano_pode(u uuid, a public.plano_acoes) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and (
    public.edita_plano(u) or a.dono = u or u = any(a.pessoas)
    or exists (
      select 1 from public.plano_resp r
      where (u = any(r.pessoas) or exists (select 1 from public.equipes e where e.id = any(r.equipes) and u = any(e.pessoas)))
        and (r.id = upper(trim(a.resp)) or r.id = any(regexp_split_to_array(upper(trim(a.resp)), '\s*(?:/|,|\+|&|\mE\M)\s*')))
    )
  )
$$;

create or replace function public.plano_agendar(p_id text, p_data date, p_dono uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.plano_acoes;
begin
  select * into a from public.plano_acoes where id = p_id for update;
  if not found then raise exception 'Essa ação não está mais no plano.'; end if;
  if not public.plano_pode(auth.uid(), a) then raise exception 'Só quem faz parte dessa ação muda o dia ou a pessoa.'; end if;
  if p_dono is not null and not exists (select 1 from public.profiles where id = p_dono) then raise exception 'Pessoa não encontrada.'; end if;
  if p_data is not null and abs(p_data - (a.mes || '-01')::date) > 400 then raise exception 'Data fora do plano.'; end if;
  update public.plano_acoes set data = p_data, dono = p_dono where id = p_id;
end $$;

-- vira tarefa uma vez só: reserva o vínculo antes de criar a tarefa (false = alguém já começou)
create or replace function public.plano_reservar(p_id text, p_tarefa uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare a public.plano_acoes;
begin
  select * into a from public.plano_acoes where id = p_id for update;
  if not found then raise exception 'Essa ação não está mais no plano.'; end if;
  if not public.plano_pode(auth.uid(), a) then raise exception 'Só quem faz parte dessa ação pode começar.'; end if;
  if cardinality(a.tarefas) > 0 then return false; end if;
  update public.plano_acoes set tarefas = array[p_tarefa] where id = p_id;
  return true;
end $$;

-- a tarefa não foi criada: desfaz a reserva
create or replace function public.plano_soltar(p_id text, p_tarefa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.plano_acoes;
begin
  select * into a from public.plano_acoes where id = p_id for update;
  if not found then return; end if;
  if not public.plano_pode(auth.uid(), a) then raise exception 'Sem permissão.'; end if;
  if exists (select 1 from public.tasks where id = p_tarefa) then return; end if;
  update public.plano_acoes set tarefas = array_remove(tarefas, p_tarefa) where id = p_id;
end $$;

revoke all on function public.plano_pode(uuid, public.plano_acoes) from public;
revoke all on function public.plano_agendar(text, date, uuid) from public;
revoke all on function public.plano_reservar(text, uuid) from public;
revoke all on function public.plano_soltar(text, uuid) from public;
grant execute on function public.plano_pode(uuid, public.plano_acoes) to authenticated;
grant execute on function public.plano_agendar(text, date, uuid) to authenticated;
grant execute on function public.plano_reservar(text, uuid) to authenticated;
grant execute on function public.plano_soltar(text, uuid) to authenticated;
