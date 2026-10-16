-- Coordenação (rank 2) também arruma a própria sala, além de Gerência, Chefe e carpinteiro.
create or replace function public.can_edit_office(uid uuid, room text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rank_of(uid) = 4
    or (public.dept_of(uid) = room and (public.rank_of(uid) >= 2
      or exists (select 1 from public.carpenters c where c.id = uid and c.until > now())))
$$;
grant execute on function public.can_edit_office(uuid, text) to authenticated;
