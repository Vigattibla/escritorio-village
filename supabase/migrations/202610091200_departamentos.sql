-- Departamentos (salas do andar). Fase 1: todo mundo fica em Marketing; cada sala só vê o próprio Quadro,
-- agenda, metas, etapas, fluxos e projetos. Cargo só vale dentro da própria sala; a Chefe (4) vê o andar todo.
-- Cafezinhos: mesma regra pra todos; meta conta só cards da sala dela.

-- ---------- salas ----------
create table if not exists public.depts (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#0B235D' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  floor smallint not null default 1 check (floor between 1 and 20),
  slot smallint not null default 0 check (slot between 0 and 7),
  created_at timestamptz not null default now(),
  unique (floor, slot)
);
insert into public.depts (id, name, color, floor, slot) values ('marketing', 'Marketing', '#0B235D', 1, 0) on conflict do nothing;
alter table public.depts enable row level security;
drop policy if exists "salas: ver" on public.depts;
drop policy if exists "salas: criar" on public.depts;
drop policy if exists "salas: editar" on public.depts;
drop policy if exists "salas: apagar" on public.depts;
create policy "salas: ver" on public.depts for select to authenticated using (true);
create policy "salas: criar" on public.depts for insert to authenticated
  with check (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4);
create policy "salas: editar" on public.depts for update to authenticated
  using (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4) with check (true);
-- apagar só sala vazia (a chave estrangeira barra se ainda tiver gente ou coisa dentro)
create policy "salas: apagar" on public.depts for delete to authenticated
  using (id <> 'marketing' and (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4));
do $$ begin alter publication supabase_realtime add table public.depts; exception when duplicate_object then null; end $$;

-- ---------- pessoa → sala (fora dos grants de coluna: só o servidor muda) ----------
alter table public.profiles add column if not exists dept text not null default 'marketing' references public.depts(id) on update cascade;

create or replace function public.dept_of(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select dept from public.profiles where id = uid), 'marketing')
$$;
create or replace function public.my_dept() returns text
language sql stable security definer set search_path = public as $$
  select public.dept_of(auth.uid())
$$;
-- manda em alguém: Chefe sempre; senão cargo maior e mesma sala
create or replace function public.outranks(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a is not null and (public.rank_of(a) = 4
    or (public.rank_of(a) > public.rank_of(b) and public.dept_of(a) = public.dept_of(b)))
$$;
grant execute on function public.dept_of(uuid), public.my_dept(), public.outranks(uuid, uuid) to authenticated;

-- ---------- linhas por sala (as antigas ficam em Marketing; as novas, na sala de quem cria) ----------
alter table public.tasks add column if not exists dept text not null default 'marketing' references public.depts(id) on update cascade;
alter table public.events add column if not exists dept text not null default 'marketing' references public.depts(id) on update cascade;
alter table public.goals add column if not exists dept text not null default 'marketing' references public.depts(id) on update cascade;
alter table public.stages add column if not exists dept text not null default 'marketing' references public.depts(id) on update cascade;
alter table public.flows add column if not exists dept text not null default 'marketing' references public.depts(id) on update cascade;
alter table public.projects add column if not exists dept text not null default 'marketing' references public.depts(id) on update cascade;
alter table public.events alter column dept set default public.my_dept();
alter table public.goals alter column dept set default public.my_dept();
alter table public.stages alter column dept set default public.my_dept();
alter table public.flows alter column dept set default public.my_dept();
alter table public.projects alter column dept set default public.my_dept();
create index if not exists tasks_dept on public.tasks (dept);

-- tarefa mora na sala de quem é responsável
create or replace function public.task_dept() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then new.dept := public.dept_of(new.owner_id);
  elsif current_setting('ev.admin_op', true) is distinct from '1' then new.dept := old.dept; end if;
  return new;
end $$;
drop trigger if exists task_dept on public.tasks;
create trigger task_dept before insert or update on public.tasks for each row execute function public.task_dept();

-- ---------- tarefas ----------
create or replace function public.can_edit_task(o uuid, c uuid, collab uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = o or auth.uid() = c or auth.uid() = any(coalesce(collab, '{}'))
    or public.outranks(auth.uid(), o))
$$;

drop policy if exists "tarefas visíveis à equipe" on public.tasks;
drop policy if exists "tarefas: sala ou quem participa" on public.tasks;
create policy "tarefas: sala ou quem participa" on public.tasks for select to authenticated using (
  dept = public.my_dept() or owner_id = auth.uid() or created_by = auth.uid() or auth.uid() = any(collaborators)
  or public.rank_of(auth.uid()) = 4 or public.approver_of(project_id, owner_id) = auth.uid());

drop policy if exists "cria tarefa ou pedido" on public.tasks;
create policy "cria tarefa ou pedido" on public.tasks for insert to authenticated with check (
  created_by = auth.uid()
  and (owner_id = auth.uid() or status = 'inbox' or public.outranks(auth.uid(), owner_id)));

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r smallint; appr uuid; judge boolean; self_ok boolean := false;
begin
  if me is null or current_setting('ev.admin_op', true) = '1' then return new; end if;
  r := public.rank_of(me);
  if old.project_id is null and old.status = 'review' then
    judge := case when old.created_by is not null and old.created_by <> old.owner_id then me = old.created_by or r = 4
                  else me <> old.owner_id and public.outranks(me, old.owner_id) end;
    self_ok := me = old.owner_id and (old.created_by is null or old.created_by = old.owner_id);
  else
    appr := public.approver_of(old.project_id, old.owner_id);
    judge := appr is not null and (me = appr or r = 4);
  end if;
  if new.created_by is distinct from old.created_by then raise exception 'O autor da tarefa não muda.'; end if;
  if new.owner_id is distinct from old.owner_id
     and not (public.outranks(me, old.owner_id) and public.outranks(me, new.owner_id)) then
    raise exception 'Só o chefe muda a tarefa de pasta.';
  end if;
  if new.reviews is distinct from old.reviews and not judge then
    raise exception 'Só quem aprova essa entrega (ou o Chefe) aprova ou reprova.';
  end if;
  if old.status = 'review' then
    if new.project_id is distinct from old.project_id and not judge then
      raise exception 'Essa entrega está em aprovação: não dá pra trocar o projeto agora.';
    end if;
    if new.status is distinct from old.status and not (judge or self_ok or (me = old.owner_id and new.status <> 'done')) then
      raise exception 'Essa entrega está esperando aprovação.';
    end if;
  elsif new.status is distinct from old.status then
    if not (me = old.owner_id or public.outranks(me, old.owner_id)) then
      raise exception 'Só o dono da tarefa muda o andamento.';
    end if;
    if new.status = 'done' and public.approver_of(new.project_id, new.owner_id) is not null
       and not (me = public.approver_of(new.project_id, new.owner_id) or r = 4) then
      raise exception 'Essa tarefa precisa passar pela aprovação do mestre do projeto.';
    end if;
  end if;
  return new;
end $$;

-- comentários e anexos: quem enxerga a tarefa
drop policy if exists "notas visíveis à equipe" on public.task_notes;
drop policy if exists "notas: quem vê a tarefa" on public.task_notes;
create policy "notas: quem vê a tarefa" on public.task_notes for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
drop policy if exists "anexo: equipe vê" on storage.objects;
drop policy if exists "anexo: quem vê a tarefa" on storage.objects;
create policy "anexo: quem vê a tarefa" on storage.objects for select to authenticated using (
  bucket_id = 'anexos' and exists (select 1 from public.tasks t where t.id::text = (storage.foldername(name))[1]));

-- ---------- agenda, metas, etapas, fluxos ----------
drop policy if exists "eventos: ver" on public.events;
drop policy if exists "eventos: criar" on public.events;
drop policy if exists "eventos: editar" on public.events;
drop policy if exists "eventos: apagar" on public.events;
create policy "eventos: ver" on public.events for select to authenticated using (dept = public.my_dept() or public.rank_of(auth.uid()) = 4);
create policy "eventos: criar" on public.events for insert to authenticated
  with check (created_by = auth.uid() and (dept = public.my_dept() or public.rank_of(auth.uid()) = 4));
create policy "eventos: editar" on public.events for update to authenticated
  using (created_by = auth.uid() or public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 3 and dept = public.my_dept()))
  with check (dept = public.my_dept() or public.rank_of(auth.uid()) = 4);
create policy "eventos: apagar" on public.events for delete to authenticated
  using (created_by = auth.uid() or public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 3 and dept = public.my_dept()));

drop policy if exists "metas: ver" on public.goals;
drop policy if exists "metas: criar" on public.goals;
drop policy if exists "metas: editar" on public.goals;
drop policy if exists "metas: apagar" on public.goals;
create policy "metas: ver" on public.goals for select to authenticated using (dept = public.my_dept() or public.rank_of(auth.uid()) = 4);
create policy "metas: criar" on public.goals for insert to authenticated with check (created_by = auth.uid()
  and (public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 2 and dept = public.my_dept())));
create policy "metas: editar" on public.goals for update to authenticated
  using (public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 2 and dept = public.my_dept()))
  with check (public.rank_of(auth.uid()) = 4 or dept = public.my_dept());
create policy "metas: apagar" on public.goals for delete to authenticated
  using (public.rank_of(auth.uid()) = 4 or ((created_by = auth.uid() or public.rank_of(auth.uid()) >= 3) and dept = public.my_dept()));

drop policy if exists "etapas: ver" on public.stages;
drop policy if exists "etapas: criar" on public.stages;
drop policy if exists "etapas: editar" on public.stages;
drop policy if exists "etapas: apagar" on public.stages;
create policy "etapas: ver" on public.stages for select to authenticated using (dept = public.my_dept() or public.rank_of(auth.uid()) = 4);
create policy "etapas: criar" on public.stages for insert to authenticated
  with check (public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 2 and dept = public.my_dept()));
create policy "etapas: editar" on public.stages for update to authenticated
  using (public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 2 and dept = public.my_dept()))
  with check (public.rank_of(auth.uid()) = 4 or dept = public.my_dept());
create policy "etapas: apagar" on public.stages for delete to authenticated
  using (public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 2 and dept = public.my_dept()));

drop policy if exists "fluxos: ver" on public.flows;
drop policy if exists "fluxos: criar" on public.flows;
drop policy if exists "fluxos: editar" on public.flows;
drop policy if exists "fluxos: apagar" on public.flows;
create policy "fluxos: ver" on public.flows for select to authenticated using (dept = public.my_dept() or public.rank_of(auth.uid()) = 4);
create policy "fluxos: criar" on public.flows for insert to authenticated with check (created_by = auth.uid()
  and (public.rank_of(auth.uid()) = 4 or (public.rank_of(auth.uid()) >= 2 and dept = public.my_dept())));
create policy "fluxos: editar" on public.flows for update to authenticated
  using (public.rank_of(auth.uid()) = 4 or ((created_by = auth.uid() or public.rank_of(auth.uid()) >= 3) and dept = public.my_dept()))
  with check (public.rank_of(auth.uid()) = 4 or dept = public.my_dept());
create policy "fluxos: apagar" on public.flows for delete to authenticated
  using (public.rank_of(auth.uid()) = 4 or ((created_by = auth.uid() or public.rank_of(auth.uid()) >= 3) and dept = public.my_dept()));

-- ---------- projetos ----------
drop policy if exists "projetos visíveis à equipe" on public.projects;
drop policy if exists "projetos: sala ou quem participa" on public.projects;
drop policy if exists "coordenação cria projeto" on public.projects;
create policy "projetos: sala ou quem participa" on public.projects for select to authenticated using (
  dept = public.my_dept() or master_id = auth.uid() or created_by = auth.uid() or public.rank_of(auth.uid()) = 4);
create policy "coordenação cria projeto" on public.projects for insert to authenticated with check (
  created_by = auth.uid() and (public.rank_of(auth.uid()) >= 2 or public.is_admin(auth.uid()))
  and (dept = public.my_dept() or public.rank_of(auth.uid()) = 4));

-- ---------- metas e cafezinhos: cada sala conta os próprios cards ----------
create or replace function public.goal_count(g public.goals, upto timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.tasks t
  left join public.projects p on p.id = t.project_id
  where t.status = 'done' and t.done_at is not null and t.done_at < upto and t.dept = g.dept
    and to_char(t.done_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = g.month
    and (g.metric <> 'posts' or t.channel is not null)
    and (t.created_by <> t.owner_id
      or (p.master_id is not null and p.master_id <> t.owner_id)
      or exists (select 1 from jsonb_array_elements(coalesce(t.reviews, '[]'::jsonb)) r
                 where coalesce((r->>'ok')::boolean, false) and r->>'by' <> t.owner_id::text))
$$;

create or replace function public.claim_coffee() returns setof public.coffee_log
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  tz text := 'America/Sao_Paulo';
  g public.goals;
  v int; b int; s int[]; n int; paid int;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then return; end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  return query with x as (insert into public.coffee_log (user_id, amount, reason, ref) values (me, 60, 'boasvindas', '1') on conflict do nothing returning *) select * from x;
  return query with x as (insert into public.coffee_log (user_id, amount, reason, ref)
    values (me, 10, 'dia', to_char(now() at time zone tz, 'YYYY-MM-DD')) on conflict do nothing returning *) select * from x;
  for g in select * from public.goals where dept = public.dept_of(me)
      and month >= to_char((now() at time zone tz) - interval '1 month', 'YYYY-MM') order by created_at loop
    -- teto: 3 metas pagas por mês para cada pessoa (a que já começou a pagar continua)
    if not exists (select 1 from public.coffee_log where user_id = me and reason in ('fase', 'meta') and split_part(ref, ':', 2) = g.id::text) then
      select count(distinct split_part(ref, ':', 2)) into paid from public.coffee_log
        where user_id = me and reason in ('fase', 'meta') and split_part(ref, ':', 1) = g.month;
      if paid >= 3 then continue; end if;
    end if;
    v := case when g.metric = 'manual' then g.value else public.goal_count(g, 'infinity') end;
    if v <= 0 then continue; end if;
    b := case when g.metric = 'manual' then g.base
      else public.goal_count(g, (((g.created_at at time zone tz)::date + 1)::timestamp at time zone tz)) end;
    s := public.goal_steps(g.target);
    n := array_length(s, 1);
    for i in 1..n loop
      if s[i] > b and v >= s[i] then
        if i < n then
          return query with x as (insert into public.coffee_log (user_id, amount, reason, ref)
            values (me, 5, 'fase', g.month || ':' || g.id || ':' || i) on conflict do nothing returning *) select * from x;
        else
          return query with x as (insert into public.coffee_log (user_id, amount, reason, ref)
            values (me, 20, 'meta', g.month || ':' || g.id) on conflict do nothing returning *) select * from x;
        end if;
      end if;
    end loop;
  end loop;
end $$;
revoke all on function public.claim_coffee() from public, anon;
grant execute on function public.claim_coffee() to authenticated;

-- ---------- chat: Geral = andar todo; 'sala:<id>' = só a sala (a Chefe vê todas) ----------
create or replace function public.can_see_channel(ch text) returns boolean
language sql stable as $$
  select ch = 'geral'
    or ch = 'sala:' || public.my_dept()
    or (ch ~ '^sala:[a-z0-9-]{2,30}$' and public.rank_of(auth.uid()) = 4)
    or (ch like 'dm:%' and auth.uid()::text = any(string_to_array(substr(ch, 4), ':')))
    or (ch ~ '^g:[0-9a-f-]{36}$' and exists (
      select 1 from public.groups g where g.id = substr(ch, 3)::uuid and (g.open or auth.uid() = any(g.members))))
$$;

-- ---------- layout: uma sala por departamento (rooms.id = depts.id) ----------
insert into public.rooms (id, data, created_by, created_at)
  select 'marketing', data, created_by, created_at from public.rooms where id = 'escritorio'
  on conflict (id) do nothing;

create or replace function public.can_edit_office(uid uuid, room text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rank_of(uid) = 4
    or (public.dept_of(uid) = room and (public.rank_of(uid) >= 3
      or exists (select 1 from public.carpenters c where c.id = uid and c.until > now())))
$$;
grant execute on function public.can_edit_office(uuid, text) to authenticated;
drop policy if exists "sala: criar" on public.rooms;
drop policy if exists "sala: arrumar" on public.rooms;
create policy "sala: criar" on public.rooms for insert to authenticated with check (public.can_edit_office(auth.uid(), id));
create policy "sala: arrumar" on public.rooms for update to authenticated
  using (public.can_edit_office(auth.uid(), id)) with check (public.can_edit_office(auth.uid(), id));

-- carpinteiro: gerente dá pra alguém da própria sala (a Chefe, pra qualquer um)
drop policy if exists "carpinteiro: dar" on public.carpenters;
drop policy if exists "carpinteiro: mudar" on public.carpenters;
drop policy if exists "carpinteiro: tirar" on public.carpenters;
create policy "carpinteiro: dar" on public.carpenters for insert to authenticated
  with check (created_by = auth.uid() and until <= now() + interval '4 hours' and public.outranks(auth.uid(), id) and public.rank_of(auth.uid()) >= 3);
create policy "carpinteiro: mudar" on public.carpenters for update to authenticated
  using (public.rank_of(auth.uid()) >= 3 and public.outranks(auth.uid(), id))
  with check (created_by = auth.uid() and until <= now() + interval '4 hours');
create policy "carpinteiro: tirar" on public.carpenters for delete to authenticated
  using (id = auth.uid() or (public.rank_of(auth.uid()) >= 3 and public.outranks(auth.uid(), id)));

-- ---------- cargo: só dentro da própria sala (adm e Chefe, em qualquer uma) ----------
create or replace function public.set_rank(target uuid, new_rank smallint) returns void
language plpgsql security definer set search_path = public as $$
declare mine smallint := public.rank_of(auth.uid());
begin
  if auth.uid() is null or new_rank is null or new_rank < 1 or new_rank > 4 then raise exception 'Sem permissão para mudar esse cargo.'; end if;
  if not public.is_admin(auth.uid())
     and (target = auth.uid() or public.rank_of(target) >= mine or new_rank > mine
       or (mine < 4 and public.dept_of(target) <> public.dept_of(auth.uid()))) then
    raise exception 'Sem permissão para mudar esse cargo.';
  end if;
  update public.profiles set rank = new_rank where id = target;
end $$;

-- ---------- mudar alguém de sala: adm ou Chefe. As tarefas abertas vão junto; as feitas ficam na meta da sala antiga ----------
create or replace function public.admin_set_dept(target uuid, p_dept text, p_desk smallint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4) then raise exception 'Só o adm ou a Chefe muda alguém de sala.'; end if;
  if not exists (select 1 from public.depts where id = p_dept) then raise exception 'Essa sala não existe.'; end if;
  if public.dept_of(target) = p_dept then return; end if;
  perform set_config('ev.admin_op', '1', true);
  update public.profiles set dept = p_dept, desk = coalesce(p_desk, -1) where id = target;
  update public.tasks set dept = p_dept where owner_id = target and status not in ('done', 'declined');
  delete from public.carpenters where id = target;
  perform set_config('ev.admin_op', '', true);
end $$;
revoke all on function public.admin_set_dept(uuid, text, smallint) from public, anon;
grant execute on function public.admin_set_dept(uuid, text, smallint) to authenticated;
