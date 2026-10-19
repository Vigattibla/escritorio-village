-- gerente do cassino fica no andar do marketing, na sala de jogos (mesa própria), sem fazer parte do time;
-- a sala/setor 'cassino' separados saem
create or replace function public.admin_set_cassino(target uuid, sim boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm marca a conta do cassino.'; end if;
  if sim and public.is_admin(target) then raise exception 'Conta de adm não pode ser a conta do cassino.'; end if;
  if sim and exists (select 1 from profiles where cassino and id <> target) then raise exception 'Já existe uma conta do cassino. Desmarque a outra primeiro.'; end if;
  perform set_config('ev.cassino_op', '1', true);
  perform set_config('ev.admin_op', '1', true);
  update profiles set cassino = sim, dept = 'marketing', desk = -1 where id = target;
  delete from public.carpenters where id = target;
  -- reforço de 300 ☕ uma vez só pra abrir a casa
  if sim then insert into coffee_log (user_id, amount, reason, ref) values (target, 300, 'boasvindas', 'cassino-300') on conflict do nothing; end if;
  perform set_config('ev.admin_op', '', true);
end $$;
revoke all on function public.admin_set_cassino(uuid, boolean) from public, anon;
grant execute on function public.admin_set_cassino(uuid, boolean) to authenticated;

do $$ begin
  perform set_config('ev.admin_op', '1', true);
  update public.profiles set dept = 'marketing', desk = -1 where cassino and dept is distinct from 'marketing';
  perform set_config('ev.admin_op', '', true);
  delete from public.rooms where id = 'cassino';
  begin
    delete from public.depts where id = 'cassino' and not exists (select 1 from public.profiles where dept = 'cassino');
  exception when foreign_key_violation then null;
  end;
end $$;

-- ele arruma a sala de jogos do andar dele (rooms.id = 'jogos-<setor>')
create or replace function public.can_edit_office(uid uuid, room text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rank_of(uid) = 4
    or public.tem_poder(uid, 'chefe')
    or (room = 'jogos-' || public.dept_of(uid) and public.e_cassino(uid))
    or (public.dept_of(uid) = room and (public.rank_of(uid) >= 2
      or exists (select 1 from public.carpenters c where c.id = uid and c.until > now())))
$$;
