-- Escritório Village — rodar uma vez no Supabase: SQL Editor → New query → colar → Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default '',
  avatar jsonb,
  photo text,
  xp integer not null default 0 check (xp >= 0),
  desk integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  notes text not null default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due date,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists tasks_owner_idx on public.tasks(owner_id);

create table if not exists public.messages (
  id uuid primary key,
  channel text not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_idx on public.messages(channel, created_at desc);

-- canal 'geral' é de todos; 'dm:<uuid>:<uuid>' só dos dois participantes
create or replace function public.can_see_channel(ch text) returns boolean
language sql stable as $$
  select ch = 'geral' or (ch like 'dm:%' and auth.uid()::text = any(string_to_array(substr(ch, 4), ':')))
$$;

grant select, insert, update, delete on public.profiles, public.tasks, public.messages to authenticated;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;

drop policy if exists "perfis visíveis à equipe" on public.profiles;
drop policy if exists "cria o próprio perfil" on public.profiles;
drop policy if exists "edita o próprio perfil" on public.profiles;
create policy "perfis visíveis à equipe" on public.profiles for select to authenticated using (true);
create policy "cria o próprio perfil" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "edita o próprio perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "tarefas visíveis à equipe" on public.tasks;
drop policy if exists "cria tarefa ou pedido" on public.tasks;
drop policy if exists "dono ou autor edita" on public.tasks;
drop policy if exists "dono ou autor apaga" on public.tasks;
create policy "tarefas visíveis à equipe" on public.tasks for select to authenticated using (true);
create policy "dono ou autor apaga" on public.tasks for delete to authenticated using (owner_id = auth.uid() or created_by = auth.uid());

drop policy if exists "lê canais permitidos" on public.messages;
drop policy if exists "envia nos canais permitidos" on public.messages;
create policy "lê canais permitidos" on public.messages for select to authenticated using (public.can_see_channel(channel));
create policy "envia nos canais permitidos" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_see_channel(channel));

-- tempo real (respeita o RLS acima)
alter table public.tasks replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.profiles, public.tasks, public.messages;
exception when duplicate_object then null; end $$;

-- fotos do rosto: bucket público, cada um grava só na própria pasta
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "foto: envia na própria pasta" on storage.objects;
drop policy if exists "foto: troca na própria pasta" on storage.objects;
drop policy if exists "foto: apaga na própria pasta" on storage.objects;
create policy "foto: envia na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "foto: troca na própria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "foto: apaga na própria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== v2: cargos e pedidos (pode rodar de novo sem problema) =====
-- rank: 1 Equipe · 2 Coordenação · 3 Gerência · 4 Chefe. Cargo maior coloca tarefa direto na pasta;
-- quem não é chefe manda pedido ('inbox'), que o dono aceita ou recusa ('declined').
alter table public.profiles add column if not exists rank smallint not null default 1 check (rank between 1 and 4);
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('inbox', 'todo', 'doing', 'done', 'declined'));

create or replace function public.rank_of(uid uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select coalesce((select rank from public.profiles where id = uid), 1::smallint)
$$;

-- ninguém escolhe o próprio cargo: só o servidor (gatilho) e set_rank mexem na coluna
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, name, role, avatar, photo, xp, desk, created_at) on public.profiles to authenticated;
grant update (id, name, role, avatar, photo, xp, desk, created_at) on public.profiles to authenticated;

-- o primeiro a entrar sem haver Chefe vira Chefe
create or replace function public.first_is_boss() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where rank = 4 and id <> new.id) then new.rank := 4; end if;
  return new;
end $$;
drop trigger if exists first_is_boss on public.profiles;
create trigger first_is_boss before insert on public.profiles for each row execute function public.first_is_boss();
update public.profiles set rank = 4
  where id = (select id from public.profiles order by created_at limit 1)
    and not exists (select 1 from public.profiles where rank = 4);

-- muda o cargo de quem está abaixo de você, até o seu próprio nível
create or replace function public.set_rank(target uuid, new_rank smallint) returns void
language plpgsql security definer set search_path = public as $$
declare mine smallint := public.rank_of(auth.uid());
begin
  if auth.uid() is null or target = auth.uid() or public.rank_of(target) >= mine or new_rank < 1 or new_rank > mine then
    raise exception 'Sem permissão para mudar esse cargo.';
  end if;
  update public.profiles set rank = new_rank where id = target;
end $$;
revoke execute on function public.set_rank(uuid, smallint) from public, anon;
grant execute on function public.set_rank(uuid, smallint) to authenticated;

drop policy if exists "cria tarefa ou pedido" on public.tasks;
drop policy if exists "dono ou autor edita" on public.tasks;
create policy "cria tarefa ou pedido" on public.tasks for insert to authenticated with check (
  created_by = auth.uid()
  and (owner_id = auth.uid() or status = 'inbox' or public.rank_of(auth.uid()) > public.rank_of(owner_id)));
create policy "dono ou autor edita" on public.tasks for update to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid())
  with check (owner_id = auth.uid()
    or (created_by = auth.uid() and (status = 'inbox' or public.rank_of(auth.uid()) > public.rank_of(owner_id))));

-- ===== v3: detalhes da tarefa, anexos, notas e Chefe (pode rodar de novo sem problema) =====
alter table public.tasks add column if not exists start date;
alter table public.tasks add column if not exists collaborators uuid[] not null default '{}';
alter table public.tasks add column if not exists attachments jsonb not null default '[]';

-- mexe nos detalhes: dono, autor, colaborador, Chefe ou cargo acima do dono
create or replace function public.can_edit_task(o uuid, c uuid, collab uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = o or auth.uid() = c or auth.uid() = any(coalesce(collab, '{}'))
    or public.rank_of(auth.uid()) = 4 or public.rank_of(auth.uid()) > public.rank_of(o))
$$;

-- o que cada um pode mudar: pasta só o chefe, andamento só o dono ou o chefe, autor nunca muda
create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r smallint;
begin
  if me is null then return new; end if;
  r := public.rank_of(me);
  if new.created_by is distinct from old.created_by then raise exception 'O autor da tarefa não muda.'; end if;
  if new.owner_id is distinct from old.owner_id
     and not (r = 4 or (r > public.rank_of(old.owner_id) and r > public.rank_of(new.owner_id))) then
    raise exception 'Só o chefe muda a tarefa de pasta.';
  end if;
  if new.status is distinct from old.status and not (me = old.owner_id or r = 4 or r > public.rank_of(old.owner_id)) then
    raise exception 'Só o dono da tarefa muda o andamento.';
  end if;
  return new;
end $$;
drop trigger if exists guard_task on public.tasks;
create trigger guard_task before update on public.tasks for each row execute function public.guard_task();

drop policy if exists "dono ou autor edita" on public.tasks;
drop policy if exists "quem participa edita" on public.tasks;
drop policy if exists "dono ou autor apaga" on public.tasks;
create policy "quem participa edita" on public.tasks for update to authenticated
  using (public.can_edit_task(owner_id, created_by, collaborators)) with check (true);
create policy "dono ou autor apaga" on public.tasks for delete to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid() or public.rank_of(auth.uid()) = 4);

-- notas (comentários) da tarefa
create table if not exists public.task_notes (
  id uuid primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists task_notes_task_idx on public.task_notes(task_id, created_at);
alter table public.task_notes enable row level security;
drop policy if exists "notas visíveis à equipe" on public.task_notes;
drop policy if exists "escreve a própria nota" on public.task_notes;
drop policy if exists "apaga a própria nota" on public.task_notes;
create policy "notas visíveis à equipe" on public.task_notes for select to authenticated using (true);
create policy "escreve a própria nota" on public.task_notes for insert to authenticated with check (author_id = auth.uid());
create policy "apaga a própria nota" on public.task_notes for delete to authenticated
  using (author_id = auth.uid() or public.rank_of(auth.uid()) = 4);
do $$ begin
  alter publication supabase_realtime add table public.task_notes;
exception when duplicate_object then null; end $$;

-- anexos: bucket privado (link assinado), pasta = id da tarefa, até 20 MB
insert into storage.buckets (id, name, public, file_size_limit) values ('anexos', 'anexos', false, 20971520)
  on conflict (id) do update set public = false, file_size_limit = 20971520;
drop policy if exists "anexo: equipe vê" on storage.objects;
drop policy if exists "anexo: envia quem participa" on storage.objects;
drop policy if exists "anexo: apaga quem enviou ou chefe" on storage.objects;
create policy "anexo: equipe vê" on storage.objects for select to authenticated using (bucket_id = 'anexos');
create policy "anexo: envia quem participa" on storage.objects for insert to authenticated with check (
  bucket_id = 'anexos' and exists (
    select 1 from public.tasks t
    where t.id::text = (storage.foldername(name))[1] and public.can_edit_task(t.owner_id, t.created_by, t.collaborators)));
create policy "anexo: apaga quem enviou ou chefe" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (owner_id = auth.uid()::text or public.rank_of(auth.uid()) = 4));

-- ===== v4: contas criadas pelo Chefe, login por usuário (pode rodar de novo sem problema) =====
-- Usuário "maria" vira o e-mail interno maria@escritorio.village (ninguém recebe e-mail).
-- Depois de rodar: Authentication → Sign In / Providers → desligar "Allow new users to sign up".
create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_create_user(p_user text, p_pass text, p_name text, p_rank smallint)
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); mail text;
begin
  if auth.uid() is null or public.rank_of(auth.uid()) <> 4 then raise exception 'Só o Chefe cria contas.'; end if;
  p_user := lower(trim(p_user));
  if p_user !~ '^[a-z0-9._-]{2,30}$' then raise exception 'Usuário inválido: use letras, números, ponto ou traço.'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  if p_rank is null or p_rank < 1 or p_rank > 4 then raise exception 'Cargo inválido.'; end if;
  mail := p_user || '@escritorio.village';
  if exists (select 1 from auth.users where email = mail) then raise exception 'Esse usuário já existe.'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    crypt(p_pass, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', left(trim(p_name), 40), 'user', p_user),
    now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
    'email', now(), now(), now());
  -- perfil já nasce com nome e cargo; mesa (-1) e personagem a pessoa monta no primeiro acesso
  insert into public.profiles (id, name, rank, desk) values (uid, coalesce(nullif(left(trim(p_name), 40), ''), p_user), p_rank, -1);
  return uid;
end $$;
revoke execute on function public.admin_create_user(text, text, text, smallint) from public, anon;
grant execute on function public.admin_create_user(text, text, text, smallint) to authenticated;

create or replace function public.admin_set_password(target uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if auth.uid() is null or public.rank_of(auth.uid()) <> 4 then raise exception 'Só o Chefe troca senhas.'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = crypt(p_pass, gen_salt('bf')), updated_at = now() where id = target;
  if not found then raise exception 'Conta não encontrada.'; end if;
end $$;
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- ===== v5: Adm separado do Chefe (pode rodar de novo sem problema) =====
-- Adm cria contas, troca senhas e define o cargo de qualquer um (inclusive quem é Chefe).
-- Chefe (rank 4) continua sendo quem vê e mexe em todas as tarefas.
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false)
$$;

-- a primeira conta do sistema vira adm; ninguém mais vira Chefe sozinho (o adm escolhe)
create or replace function public.first_is_boss() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id <> new.id) then new.is_admin := true; end if;
  return new;
end $$;

-- quem montou o sistema vira adm (e sai do cargo de Chefe, que é de outra pessoa)
update public.profiles set is_admin = true, rank = 1
  where id = (select id from public.profiles order by created_at limit 1)
    and not exists (select 1 from public.profiles where is_admin);

create or replace function public.set_rank(target uuid, new_rank smallint) returns void
language plpgsql security definer set search_path = public as $$
declare mine smallint := public.rank_of(auth.uid());
begin
  if auth.uid() is null or new_rank is null or new_rank < 1 or new_rank > 4 then raise exception 'Sem permissão para mudar esse cargo.'; end if;
  if not public.is_admin(auth.uid())
     and (target = auth.uid() or public.rank_of(target) >= mine or new_rank > mine) then
    raise exception 'Sem permissão para mudar esse cargo.';
  end if;
  update public.profiles set rank = new_rank where id = target;
end $$;

create or replace function public.admin_create_user(p_user text, p_pass text, p_name text, p_rank smallint)
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); mail text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm cria contas.'; end if;
  p_user := lower(trim(p_user));
  if p_user !~ '^[a-z0-9._-]{2,30}$' then raise exception 'Usuário inválido: use letras, números, ponto ou traço.'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  if p_rank is null or p_rank < 1 or p_rank > 4 then raise exception 'Cargo inválido.'; end if;
  mail := p_user || '@escritorio.village';
  if exists (select 1 from auth.users where email = mail) then raise exception 'Esse usuário já existe.'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    crypt(p_pass, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', left(trim(p_name), 40), 'user', p_user),
    now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
    'email', now(), now(), now());
  insert into public.profiles (id, name, rank, desk) values (uid, coalesce(nullif(left(trim(p_name), 40), ''), p_user), p_rank, -1);
  return uid;
end $$;

create or replace function public.admin_set_password(target uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm troca senhas.'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = crypt(p_pass, gen_salt('bf')), updated_at = now() where id = target;
  if not found then raise exception 'Conta não encontrada.'; end if;
end $$;

-- ===== v6: primeiro acesso cria o adm (pode rodar de novo sem problema) =====
-- Sistema vazio (nenhum perfil): a tela de login vira "crie a conta do adm". Depois disso, só o adm cria contas.
create or replace function public.create_login(p_user text, p_pass text, p_name text, p_rank smallint)
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); mail text;
begin
  p_user := lower(trim(p_user));
  if p_user !~ '^[a-z0-9._-]{2,30}$' then raise exception 'Usuário inválido: use letras, números, ponto ou traço.'; end if;
  if length(coalesce(p_pass, '')) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  if p_rank is null or p_rank < 1 or p_rank > 4 then raise exception 'Cargo inválido.'; end if;
  mail := p_user || '@escritorio.village';
  if exists (select 1 from auth.users where email = mail) then raise exception 'Esse usuário já existe.'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    crypt(p_pass, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', left(trim(p_name), 40), 'user', p_user),
    now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
    'email', now(), now(), now());
  insert into public.profiles (id, name, rank, desk) values (uid, coalesce(nullif(left(trim(p_name), 40), ''), p_user), p_rank, -1);
  return uid;
end $$;
revoke execute on function public.create_login(text, text, text, smallint) from public, anon, authenticated;

create or replace function public.admin_create_user(p_user text, p_pass text, p_name text, p_rank smallint)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm cria contas.'; end if;
  return public.create_login(p_user, p_pass, p_name, p_rank);
end $$;

create or replace function public.needs_setup() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles)
$$;
grant execute on function public.needs_setup() to anon, authenticated;

create or replace function public.setup_admin(p_user text, p_pass text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  perform pg_advisory_xact_lock(424242);
  if exists (select 1 from public.profiles) then raise exception 'O escritório já tem adm. Peça sua conta a ele.'; end if;
  uid := public.create_login(p_user, p_pass, p_name, 1::smallint);
  update public.profiles set is_admin = true where id = uid;
end $$;
grant execute on function public.setup_admin(text, text, text) to anon, authenticated;
