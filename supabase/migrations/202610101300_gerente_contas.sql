-- Gerente (3) e Chefe (4) cuidam das contas da própria equipe: criam, editam, trocam senha.
-- Só mexem em quem tem cargo menor (Chefe: o andar todo; Gerente: só a sala dele) e nunca em adm.
-- Excluir conta, dar adm e mudar de sala continuam com o adm.

create or replace function public.manages_account(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and (public.is_admin(a)
    or (a <> b and public.rank_of(a) >= 3 and not public.is_admin(b) and public.outranks(a, b)))
$$;
revoke execute on function public.manages_account(uuid, uuid) from public, anon;
grant execute on function public.manages_account(uuid, uuid) to authenticated;

create or replace function public.admin_create_user(p_user text, p_pass text, p_name text, p_rank smallint)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); uid uuid;
begin
  if public.is_admin(me) then return public.create_login(p_user, p_pass, p_name, p_rank); end if;
  if public.rank_of(me) < 3 then raise exception 'Só o adm ou a gerência cria contas.'; end if;
  if p_rank is null or p_rank < 1 or p_rank >= public.rank_of(me) then raise exception 'Você só cria contas com cargo abaixo do seu.'; end if;
  uid := public.create_login(p_user, p_pass, p_name, p_rank);
  update public.profiles set dept = public.dept_of(me) where id = uid;
  return uid;
end $$;
revoke execute on function public.admin_create_user(text, text, text, smallint) from public, anon;
grant execute on function public.admin_create_user(text, text, text, smallint) to authenticated;

create or replace function public.admin_set_password(target uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.manages_account(auth.uid(), target) then raise exception 'Você não pode trocar a senha dessa pessoa.'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = crypt(p_pass, gen_salt('bf')), updated_at = now() where id = target;
  if not found then raise exception 'Conta não encontrada.'; end if;
end $$;
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- usuário de login: o adm vê todos; a gerência vê a equipe dela; cada um vê o próprio
create or replace function public.admin_logins() returns table (id uuid, login text)
language plpgsql stable security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Entre primeiro.'; end if;
  return query select u.id, split_part(u.email, '@', 1)::text from auth.users u
    where u.id = me or public.manages_account(me, u.id);
end $$;
revoke execute on function public.admin_logins() from public, anon;
grant execute on function public.admin_logins() to authenticated;

create or replace function public.admin_update_user(target uuid, p_name text, p_role text, p_rank smallint, p_admin boolean, p_user text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); mail text; adm boolean := public.is_admin(auth.uid());
begin
  if not public.manages_account(me, target) and not (adm and target = me) then raise exception 'Você não pode mexer nessa conta.'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'Conta não encontrada.'; end if;
  if p_rank is null or p_rank < 1 or p_rank > 4 then raise exception 'Cargo inválido.'; end if;
  if not adm then
    if p_rank >= public.rank_of(me) then raise exception 'Você só dá cargos abaixo do seu.'; end if;
    if coalesce(p_admin, false) then raise exception 'Só o adm dá acesso de adm.'; end if;
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'O nome não pode ficar vazio.'; end if;
  if target = me and not p_admin then raise exception 'Você não pode tirar o seu próprio adm.'; end if;
  update public.profiles set name = left(trim(p_name), 40), role = left(trim(coalesce(p_role, '')), 40),
    rank = p_rank, is_admin = case when adm then p_admin else is_admin end where id = target;
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || jsonb_build_object('name', left(trim(p_name), 40)),
    updated_at = now() where id = target;
  p_user := lower(trim(coalesce(p_user, '')));
  if p_user <> '' then
    if p_user !~ '^[a-z0-9._-]{2,30}$' then raise exception 'Usuário inválido: use letras, números, ponto ou traço.'; end if;
    mail := p_user || '@escritorio.village';
    if exists (select 1 from auth.users where email = mail and id <> target) then raise exception 'Esse usuário já existe.'; end if;
    update auth.users set email = mail, raw_user_meta_data = raw_user_meta_data || jsonb_build_object('user', p_user)
      where id = target and email is distinct from mail;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', mail)
      where user_id = target and provider = 'email';
  end if;
end $$;
revoke execute on function public.admin_update_user(uuid, text, text, smallint, boolean, text) from public, anon;
grant execute on function public.admin_update_user(uuid, text, text, smallint, boolean, text) to authenticated;
