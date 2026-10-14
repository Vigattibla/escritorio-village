-- Ponte de tarefas pra IAs e automações (função tarefas: MCP, webhook e e-mail).
-- Cada pessoa gera chaves pessoais no app; o banco guarda só o hash. As funções api_* recebem a chave,
-- descobrem quem é e fazem a mesma coisa que o app faria por essa pessoa (pedido pra outra pasta vira inbox).
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null check (length(nome) between 1 and 60),
  hash text not null unique,
  dica text not null,
  criado timestamptz not null default now(),
  usado timestamptz
);
create index if not exists api_tokens_user_idx on public.api_tokens(user_id);
alter table public.api_tokens enable row level security;
drop policy if exists "vê as próprias chaves" on public.api_tokens;
drop policy if exists "apaga as próprias chaves" on public.api_tokens;
create policy "vê as próprias chaves" on public.api_tokens for select to authenticated using (user_id = auth.uid());
create policy "apaga as próprias chaves" on public.api_tokens for delete to authenticated using (user_id = auth.uid());
grant select (id, user_id, nome, dica, criado, usado), delete on public.api_tokens to authenticated;

-- gera a chave e devolve uma vez só (depois só aparecem os 4 últimos caracteres)
create or replace function public.criar_token(p_nome text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid(); t text;
begin
  if me is null then raise exception 'Entre no escritório primeiro.'; end if;
  if (select count(*) from public.api_tokens where user_id = me) >= 10 then raise exception 'Máximo de 10 chaves. Apague uma antes.'; end if;
  t := 'tv_' || encode(gen_random_bytes(24), 'hex');
  insert into public.api_tokens (user_id, nome, hash, dica)
  values (me, coalesce(nullif(left(trim(p_nome), 60), ''), 'Minha IA'), encode(digest(t, 'sha256'), 'hex'), right(t, 4));
  return t;
end $$;
revoke all on function public.criar_token(text) from public, anon;
grant execute on function public.criar_token(text) to authenticated;

-- interna: chave → pessoa (marca o último uso)
create or replace function public.api_quem(p_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid;
begin
  update public.api_tokens set usado = now()
   where hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
   returning user_id into u;
  if u is null then raise exception 'Chave inválida ou apagada.'; end if;
  return u;
end $$;
revoke all on function public.api_quem(text) from public, anon, authenticated;

-- interna: acha a pessoa pelo nome ("ana", "Ana Paula", "eu", vazio = eu)
create or replace function public.api_pessoa(me uuid, p_para text) returns uuid
language plpgsql security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_para, ''))); ids uuid[]; nomes text;
begin
  if q in ('', 'eu', 'mim', 'me', 'minha', 'minhas') then return me; end if;
  select array_agg(id) into ids from public.profiles where lower(name) = q;
  if coalesce(array_length(ids, 1), 0) = 0 then
    select array_agg(id) into ids from public.profiles where lower(name) like q || '%' or lower(name) like '% ' || q || '%';
  end if;
  if coalesce(array_length(ids, 1), 0) = 1 then return ids[1]; end if;
  if coalesce(array_length(ids, 1), 0) = 0 then raise exception 'Não achei ninguém chamado "%". Use api_pessoas pra ver os nomes.', p_para; end if;
  select string_agg(name, ', ') into nomes from public.profiles where id = any(ids);
  raise exception 'Tem mais de uma pessoa com "%": %. Use o nome completo.', p_para, nomes;
end $$;
revoke all on function public.api_pessoa(uuid, text) from public, anon, authenticated;

create or replace function public.api_pessoas(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('nome', name, 'cargo', nullif(role, ''), 'sala', dept, 'eu', id = me) order by name), '[]')
            from public.profiles);
end $$;

create or replace function public.api_tarefa_criar(p_token text, p_titulo text, p_para text default null, p_prazo date default null,
  p_notas text default '', p_prioridade text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token); dono uuid; st text; tid uuid := gen_random_uuid(); t text := left(trim(coalesce(p_titulo, '')), 200);
begin
  if t = '' then raise exception 'Falta o título da tarefa.'; end if;
  if p_prioridade is not null and p_prioridade not in ('alta', 'media', 'baixa') then raise exception 'Prioridade: alta, media ou baixa.'; end if;
  dono := public.api_pessoa(me, p_para);
  st := case when dono = me or public.outranks(me, dono) then 'todo' else 'inbox' end;
  insert into public.tasks (id, owner_id, created_by, title, notes, status, due, position, priority)
  values (tid, dono, me, t, left(coalesce(p_notas, ''), 5000), st, p_prazo, extract(epoch from now()) * 1000, p_prioridade);
  return jsonb_build_object('id', tid, 'titulo', t, 'para', (select name from public.profiles where id = dono),
    'situacao', case st when 'inbox' then 'pedido (a pessoa aceita no quadro)' else 'a fazer' end, 'prazo', p_prazo);
end $$;

-- minhas tarefas abertas (dono ou colaborador) + concluídas nos últimos 7 dias
create or replace function public.api_tarefas(p_token text, p_situacao text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.title, 'situacao', t.status, 'prazo', t.due,
            'prioridade', t.priority, 'de', (select name from public.profiles where id = t.created_by),
            'minha', t.owner_id = me) order by t.due nulls last, t.position), '[]')
    from (select * from public.tasks
           where (owner_id = me or me = any(collaborators))
             and (case when p_situacao is null then status not in ('declined') and (status <> 'done' or done_at > now() - interval '7 days')
                       else status = p_situacao end)
           order by due nulls last, position limit 60) t);
end $$;

create or replace function public.api_tarefa_mover(p_token text, p_id uuid, p_situacao text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token); t public.tasks; st text := p_situacao; appr uuid;
begin
  if st not in ('todo', 'doing', 'done') then raise exception 'Situação: todo, doing ou done.'; end if;
  select * into t from public.tasks where id = p_id;
  if t.id is null or t.owner_id <> me then raise exception 'Essa tarefa não está na sua pasta.'; end if;
  if t.status in ('review') then raise exception 'Essa entrega está esperando aprovação.'; end if;
  appr := public.approver_of(t.project_id, t.owner_id);
  if st = 'done' and appr is not null and appr <> me then st := 'review'; end if;
  update public.tasks set status = st, stage = null,
    done_at = case when st = 'done' then now() else null end
   where id = p_id;
  return jsonb_build_object('id', p_id, 'titulo', t.title, 'situacao', st);
end $$;

create or replace function public.api_comentar(p_token text, p_id uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token); t public.tasks; nid uuid := gen_random_uuid();
begin
  select * into t from public.tasks where id = p_id;
  if t.id is null or not (t.owner_id = me or t.created_by = me or me = any(t.collaborators)) then raise exception 'Você não participa dessa tarefa.'; end if;
  insert into public.task_notes (id, task_id, author_id, body) values (nid, p_id, me, left(trim(p_texto), 2000));
  return jsonb_build_object('id', nid, 'tarefa', t.title);
end $$;

grant execute on function public.api_pessoas(text), public.api_tarefa_criar(text, text, text, date, text, text),
  public.api_tarefas(text, text), public.api_tarefa_mover(text, uuid, text), public.api_comentar(text, uuid, text) to anon, authenticated;
