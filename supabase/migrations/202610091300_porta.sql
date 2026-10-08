-- Porta da sala: aberta (qualquer um entra pelo corredor) ou fechada (só quem é da sala e a Chefe).
-- Quem fecha: o gerente da própria sala, a Chefe ou o adm.
alter table public.depts add column if not exists door_open boolean not null default true;

create or replace function public.set_door(p_dept text, p_open boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4
          or (public.rank_of(auth.uid()) >= 3 and public.my_dept() = p_dept)) then
    raise exception 'Só o gerente da sala, a Chefe ou o adm mexem na porta.';
  end if;
  update public.depts set door_open = p_open where id = p_dept;
  if not found then raise exception 'Essa sala não existe.'; end if;
end $$;
revoke all on function public.set_door(text, boolean) from public;
grant execute on function public.set_door(text, boolean) to authenticated;
