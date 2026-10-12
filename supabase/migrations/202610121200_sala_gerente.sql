-- Sala só do gerente no andar do setor: ele escolhe se quer (a mesa dele sai da sala do setor e vai pra lá).
-- Quem liga/desliga: o gerente da própria sala, a Chefe ou o adm (mesma regra da porta).
alter table public.depts add column if not exists sala_gerente boolean not null default false;

create or replace function public.set_sala_gerente(p_dept text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin(auth.uid()) or public.rank_of(auth.uid()) = 4
          or (public.rank_of(auth.uid()) >= 3 and public.my_dept() = p_dept)) then
    raise exception 'Só o gerente da sala, a Chefe ou o adm escolhem a sala do gerente.';
  end if;
  update public.depts set sala_gerente = p_on where id = p_dept;
  if not found then raise exception 'Essa sala não existe.'; end if;
end $$;
revoke all on function public.set_sala_gerente(text, boolean) from public;
grant execute on function public.set_sala_gerente(text, boolean) to authenticated;
