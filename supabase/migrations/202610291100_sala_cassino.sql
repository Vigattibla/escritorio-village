-- sala própria do gerente do cassino: setor 'cassino', ele senta lá e arruma as máquinas
do $$ declare f int := 1; s int; begin
  if not exists (select 1 from public.depts where id = 'cassino') then
    loop
      select min(x) into s from generate_series(0, 3) x where not exists (select 1 from public.depts where floor = f and slot = x);
      exit when s is not null or f >= 20; f := f + 1;
    end loop;
    insert into public.depts (id, name, color, floor, slot, tipo) values ('cassino', 'Cassino', '#7A1F3D', f, coalesce(s, 0), 'cassino');
  end if;
end $$;

-- marcar a conta do cassino já muda ele de sala; desmarcar devolve pro marketing
create or replace function public.admin_set_cassino(target uuid, sim boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm marca a conta do cassino.'; end if;
  if sim and public.is_admin(target) then raise exception 'Conta de adm não pode ser a conta do cassino.'; end if;
  if sim and exists (select 1 from profiles where cassino and id <> target) then raise exception 'Já existe uma conta do cassino. Desmarque a outra primeiro.'; end if;
  perform set_config('ev.cassino_op', '1', true);
  perform set_config('ev.admin_op', '1', true);
  update profiles set cassino = sim, dept = case when sim then 'cassino' else 'marketing' end, desk = -1 where id = target;
  delete from public.carpenters where id = target;
  -- reforço de 300 ☕ uma vez só pra abrir a casa
  if sim then insert into coffee_log (user_id, amount, reason, ref) values (target, 300, 'boasvindas', 'cassino-300') on conflict do nothing; end if;
  perform set_config('ev.admin_op', '', true);
end $$;
revoke all on function public.admin_set_cassino(uuid, boolean) from public, anon;
grant execute on function public.admin_set_cassino(uuid, boolean) to authenticated;

-- quem já está marcado: vai pra sala e ganha o reforço
do $$ begin
  perform set_config('ev.admin_op', '1', true);
  update public.profiles set dept = 'cassino', desk = -1 where cassino and dept is distinct from 'cassino';
  insert into public.coffee_log (user_id, amount, reason, ref)
    select id, 300, 'boasvindas', 'cassino-300' from public.profiles where cassino on conflict do nothing;
  perform set_config('ev.admin_op', '', true);
end $$;

-- ele arruma a própria sala (só a do cassino)
create or replace function public.can_edit_office(uid uuid, room text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rank_of(uid) = 4
    or public.tem_poder(uid, 'chefe')
    or (room = 'cassino' and public.e_cassino(uid))
    or (public.dept_of(uid) = room and (public.rank_of(uid) >= 2
      or exists (select 1 from public.carpenters c where c.id = uid and c.until > now())))
$$;
