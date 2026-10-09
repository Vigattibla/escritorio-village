-- Vendas só pro setor de vendas (e admin): diretoria de outro setor e Marketing não veem nem editam
create or replace function public.manda_vendas(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and (public.is_admin(uid) or (public.vende(uid) and public.rank_of(uid) >= 3))
$$;
create or replace function public.ve_vendas(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and (public.is_admin(uid) or public.vende(uid))
$$;
create or replace function public.edita_campanha(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.manda_vendas(uid)
$$;
