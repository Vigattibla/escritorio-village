-- Funil do setor: pedido feito para uma equipe (Design, Edição de vídeo…) cai com quem gerencia
-- e ele repassa para alguém. avisar = equipes que recebem aviso quando a entrega é aprovada.
alter table public.tasks add column if not exists equipe text;
alter table public.tasks add column if not exists avisar text[] not null default '{}';
create index if not exists tasks_equipe on public.tasks (equipe) where equipe is not null;

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
     and not (public.outranks(me, old.owner_id) and public.outranks(me, new.owner_id))
     -- funil do setor: quem recebeu o pedido da equipe (ou um cargo acima) repassa para alguém da sala
     and not (old.equipe is not null and old.status = 'inbox'
              and (me = old.owner_id or public.outranks(me, old.owner_id))
              and public.dept_of(new.owner_id) = old.dept) then
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
