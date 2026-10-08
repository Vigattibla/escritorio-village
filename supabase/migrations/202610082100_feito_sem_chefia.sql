-- card sem projeto que o próprio dono criou: a aprovação da chefia é opcional, o dono pode levar de Aprovação para Feito
create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r smallint; appr uuid; judge boolean; self_ok boolean := false;
begin
  if me is null or current_setting('ev.admin_op', true) = '1' then return new; end if;
  r := public.rank_of(me);
  if old.project_id is null and old.status = 'review' then
    judge := case when old.created_by is not null and old.created_by <> old.owner_id then me = old.created_by or r = 4
                  else me <> old.owner_id and (r = 4 or r > public.rank_of(old.owner_id)) end;
    self_ok := me = old.owner_id and (old.created_by is null or old.created_by = old.owner_id);
  else
    appr := public.approver_of(old.project_id, old.owner_id);
    judge := appr is not null and (me = appr or r = 4);
  end if;
  if new.created_by is distinct from old.created_by then raise exception 'O autor da tarefa não muda.'; end if;
  if new.owner_id is distinct from old.owner_id
     and not (r = 4 or (r > public.rank_of(old.owner_id) and r > public.rank_of(new.owner_id))) then
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
    if not (me = old.owner_id or r = 4 or r > public.rank_of(old.owner_id)) then
      raise exception 'Só o dono da tarefa muda o andamento.';
    end if;
    if new.status = 'done' and public.approver_of(new.project_id, new.owner_id) is not null
       and not (me = public.approver_of(new.project_id, new.owner_id) or r = 4) then
      raise exception 'Essa tarefa precisa passar pela aprovação do mestre do projeto.';
    end if;
  end if;
  return new;
end $$;
