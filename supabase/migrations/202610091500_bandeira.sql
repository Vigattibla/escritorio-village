-- Jeito de cada setor: bandeira na porta (ícone) e se a sala trabalha com publicação (posts/canais).
-- Quem muda: o gerente da sala, a Chefe ou o adm (mesma regra da porta).
alter table public.depts add column if not exists flag text;
alter table public.depts add column if not exists canais boolean not null default false;
update public.depts set canais = true where id = 'marketing';

create or replace function public.set_dept_look(p_dept text, p_flag text, p_canais boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4
          or (public.rank_of(auth.uid()) >= 3 and public.my_dept() = p_dept)) then
    raise exception 'Só o gerente da sala, a Chefe ou o adm mudam a sala.';
  end if;
  if p_flag is not null and p_flag !~ '^[a-z-]{1,32}$' then raise exception 'Bandeira inválida.'; end if;
  update public.depts set flag = p_flag, canais = coalesce(p_canais, canais) where id = p_dept;
  if not found then raise exception 'Essa sala não existe.'; end if;
end $$;
revoke all on function public.set_dept_look(text, text, boolean) from public;
grant execute on function public.set_dept_look(text, text, boolean) to authenticated;
