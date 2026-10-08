-- Cortina da sala (parede de vidro pro corredor): aberta = quem passa vê o que acontece; fechada = sala reservada.
-- Quem mexe: o gerente da própria sala, a Chefe ou o adm (mesma regra da porta).
alter table public.depts add column if not exists curtains_open boolean not null default true;

create or replace function public.set_curtains(p_dept text, p_open boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4
          or (public.rank_of(auth.uid()) >= 3 and public.my_dept() = p_dept)) then
    raise exception 'Só o gerente da sala, a Chefe ou o adm mexem na cortina.';
  end if;
  update public.depts set curtains_open = p_open where id = p_dept;
  if not found then raise exception 'Essa sala não existe.'; end if;
end $$;
revoke all on function public.set_curtains(text, boolean) from public;
grant execute on function public.set_curtains(text, boolean) to authenticated;
