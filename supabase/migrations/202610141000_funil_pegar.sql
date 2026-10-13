-- Funil por setor: o pedido fica no funil da equipe; qualquer pessoa da equipe pega para si
-- ou o gestor (ou cargo acima) passa para alguém da sala ou da equipe.
create or replace function public.na_equipe(eq text, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and exists (select 1 from public.equipes e where e.id = eq and u = any(e.pessoas))
$$;
revoke all on function public.na_equipe(text, uuid) from public, anon;
grant execute on function public.na_equipe(text, uuid) to authenticated;

drop policy if exists "tarefas: sala ou quem participa" on public.tasks;
create policy "tarefas: sala ou quem participa" on public.tasks for select to authenticated using (
  dept = public.my_dept() or owner_id = auth.uid() or created_by = auth.uid() or auth.uid() = any(collaborators)
  or public.rank_of(auth.uid()) = 4 or public.approver_of(project_id, owner_id) = auth.uid()
  or (equipe is not null and public.na_equipe(equipe, auth.uid())));

drop policy if exists "quem participa edita" on public.tasks;
create policy "quem participa edita" on public.tasks for update to authenticated
  using (public.can_edit_task(owner_id, created_by, collaborators)
    or public.approver_of(project_id, owner_id) = auth.uid()
    or (equipe is not null and status = 'inbox' and public.na_equipe(equipe, auth.uid()))) with check (true);

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r smallint; appr uuid; judge boolean; self_ok boolean := false; pega boolean;
begin
  if me is null or current_setting('ev.admin_op', true) = '1' then return new; end if;
  r := public.rank_of(me);
  -- alguém da equipe pegando o pedido do funil para si
  pega := old.equipe is not null and old.status = 'inbox' and new.owner_id = me and public.na_equipe(old.equipe, me);
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
     and not (public.outranks(me, old.owner_id) and public.outranks(me, new.owner_id))
     -- funil do setor: quem recebeu o pedido da equipe (ou um cargo acima) repassa para alguém da sala
     and not pega
     and not (old.equipe is not null and old.status = 'inbox'
              and (me = old.owner_id or public.outranks(me, old.owner_id))
              and (public.dept_of(new.owner_id) = old.dept or public.na_equipe(old.equipe, new.owner_id))) then
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
    if not (me = old.owner_id or public.outranks(me, old.owner_id) or (pega and new.status = 'todo')) then
      raise exception 'Só o dono da tarefa muda o andamento.';
    end if;
    if new.status = 'done' and public.approver_of(new.project_id, new.owner_id) is not null
       and not (me = public.approver_of(new.project_id, new.owner_id) or r = 4) then
      raise exception 'Essa tarefa precisa passar pela aprovação do mestre do projeto.';
    end if;
  end if;
  return new;
end $$;
