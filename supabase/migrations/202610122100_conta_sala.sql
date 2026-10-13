-- Conta criada pelo adm entra na sala escolhida (antes caía sempre no Marketing, o padrão da coluna).
-- Gerência continua criando só na própria sala.
drop function if exists public.admin_create_user(text, text, text, smallint);

create or replace function public.admin_create_user(p_user text, p_pass text, p_name text, p_rank smallint, p_dept text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); uid uuid;
begin
  if public.is_admin(me) then
    if p_dept is not null and not exists (select 1 from public.depts where id = p_dept) then raise exception 'Sala não encontrada.'; end if;
    uid := public.create_login(p_user, p_pass, p_name, p_rank);
    if p_dept is not null then update public.profiles set dept = p_dept where id = uid; end if;
    return uid;
  end if;
  if public.rank_of(me) < 3 then raise exception 'Só o adm ou a gerência cria contas.'; end if;
  if p_rank is null or p_rank < 1 or p_rank >= public.rank_of(me) then raise exception 'Você só cria contas com cargo abaixo do seu.'; end if;
  uid := public.create_login(p_user, p_pass, p_name, p_rank);
  update public.profiles set dept = public.dept_of(me) where id = uid;
  return uid;
end $$;
revoke execute on function public.admin_create_user(text, text, text, smallint, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, smallint, text) to authenticated;
