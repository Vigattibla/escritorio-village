-- Aprovação do Estúdio: a conversa é só do dono do Estúdio; quem aprova peça do Estúdio
-- é quem tem a marca "Aprova Estúdio" (o dono marca). As peças saem da aprovação geral do Quadro.

alter table public.profiles add column if not exists estudio_dono boolean not null default false;
alter table public.profiles add column if not exists aprova_estudio boolean not null default false;
alter table public.tasks add column if not exists estudio boolean not null default false;
alter table public.estudio_pedidos add column if not exists ajustes int not null default 0;

-- dono = quem conversa com o Estúdio (o trabalhador da VPS entra com a mesma conta)
update public.profiles set estudio_dono = true
where id = (select autor from public.estudio_chat where papel = 'eu' and autor is not null group by autor order by count(*) desc limit 1)
  and not exists (select 1 from public.profiles where estudio_dono);

create or replace function public.estudio_e_dono(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and (exists (select 1 from profiles where id = u and estudio_dono)
    or (not exists (select 1 from profiles where estudio_dono) and public.is_admin(u)))
$$;
create or replace function public.estudio_aprova(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.estudio_e_dono(u) or exists (select 1 from profiles where id = u and aprova_estudio)
$$;
revoke all on function public.estudio_e_dono(uuid) from public, anon;
revoke all on function public.estudio_aprova(uuid) from public, anon;
grant execute on function public.estudio_e_dono(uuid) to authenticated;
grant execute on function public.estudio_aprova(uuid) to authenticated;

-- marcas do Estúdio no perfil só mudam pelas funções abaixo
create or replace function public.estudio_guard_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('ev.estudio_op', true) = '1' or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.estudio_dono := false; new.aprova_estudio := false; return new; end if;
  new.estudio_dono := old.estudio_dono;
  new.aprova_estudio := old.aprova_estudio;
  return new;
end $$;
drop trigger if exists estudio_guard_perfil on public.profiles;
create trigger estudio_guard_perfil before insert or update on public.profiles for each row execute function public.estudio_guard_perfil();

create or replace function public.estudio_marcar(alvo uuid, sim boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.estudio_e_dono(auth.uid()) then raise exception 'Só o dono do Estúdio marca quem aprova.'; end if;
  perform set_config('ev.estudio_op', '1', true);
  update profiles set aprova_estudio = sim where id = alvo;
end $$;
grant execute on function public.estudio_marcar(uuid, boolean) to authenticated;

-- conversa: só o dono
drop policy if exists "estudio chat: adm" on public.estudio_chat;
drop policy if exists "estudio chat: dono" on public.estudio_chat;
create policy "estudio chat: dono" on public.estudio_chat for all to authenticated
  using (public.estudio_e_dono(auth.uid())) with check (public.estudio_e_dono(auth.uid()));

-- tarefa do Estúdio: em aprovação, só sai pela decisão de quem aprova
create or replace function public.estudio_guard_tarefa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('ev.admin_op', true) = '1' then return new; end if;
  if new.estudio is distinct from old.estudio then new.estudio := old.estudio; end if;
  if old.estudio and old.status = 'review' and (new.status is distinct from old.status or new.reviews is distinct from old.reviews) then
    raise exception 'Peça do Estúdio: aprove ou peça ajuste na aba Aprovar do Estúdio.';
  end if;
  return new;
end $$;
drop trigger if exists estudio_guard_tarefa on public.tasks;
create trigger estudio_guard_tarefa before update on public.tasks for each row execute function public.estudio_guard_tarefa();

-- entrega: tarefa marcada como do Estúdio; num ajuste, troca os slides e a legenda (não empilha)
create or replace function public.estudio_entregar(pid uuid, anexos jsonb, legenda text, titulo text, canal text, resultado jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare p estudio_pedidos; tid uuid;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o Estúdio entrega.'; end if;
  select * into p from estudio_pedidos where id = pid for update;
  if not found then raise exception 'Pedido não existe.'; end if;
  perform set_config('ev.admin_op', '1', true);
  tid := p.task_id;
  if tid is null then
    tid := (resultado->>'task_id')::uuid;
    insert into tasks (id, owner_id, created_by, title, notes, status, attachments, channel, publish_at, due, dept, estudio)
    values (tid, p.criado_por, p.criado_por, left(coalesce(nullif(titulo, ''), 'Carrossel do Estúdio'), 200), coalesce(legenda, ''),
            'review', anexos, canal, p.quando, (p.quando at time zone 'America/Sao_Paulo')::date, public.dept_of(p.criado_por), true);
  elsif p.ajustes > 0 then
    update tasks set attachments = anexos, notes = coalesce(legenda, ''), channel = coalesce(channel, canal),
      title = left(coalesce(nullif(titulo, ''), title), 200), status = 'review', estudio = true
    where id = tid;
  else
    update tasks set attachments = attachments || anexos,
      notes = case when coalesce(notes, '') = '' then coalesce(legenda, '') else notes || E'\n\n' || coalesce(legenda, '') end,
      channel = coalesce(channel, canal), status = 'review', estudio = true
    where id = tid;
  end if;
  update estudio_pedidos set estado = 'pronto', passo = null, erro = null, task_id = tid, resultado = estudio_entregar.resultado, atualizado_em = now()
  where id = pid;
  return tid;
end $$;
grant execute on function public.estudio_entregar(uuid, jsonb, text, text, text, jsonb) to authenticated;

-- fila de aprovação (quem aprova pode não enxergar a tarefa pela sala)
create or replace function public.estudio_para_aprovar() returns table (
  pedido uuid, task_id uuid, titulo text, legenda text, anexos jsonb, publicar timestamptz, canal text, canal_nome text,
  pilar text, assunto text, ajustes int, entregue timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.estudio_aprova(auth.uid()) then return; end if;
  return query
    select p.id, t.id, t.title, t.notes, t.attachments, t.publish_at, p.canal, c.nome, p.pilar, p.texto, p.ajustes, p.atualizado_em
    from estudio_pedidos p join tasks t on t.id = p.task_id left join estudio_canais c on c.id = p.canal
    where p.estado = 'pronto' and t.status = 'review'
    order by coalesce(t.publish_at, p.atualizado_em);
end $$;
grant execute on function public.estudio_para_aprovar() to authenticated;

-- quem aprova enxerga os slides
drop policy if exists "anexo: aprova estudio" on storage.objects;
create policy "anexo: aprova estudio" on storage.objects for select to authenticated using (
  bucket_id = 'anexos' and public.estudio_aprova(auth.uid())
  and exists (select 1 from public.tasks t where t.id::text = (storage.foldername(name))[1] and t.estudio));

-- decide: aprova (LinkedIn entra na fila de publicar) ou pede ajuste (volta pro Estúdio refazer com o motivo)
create or replace function public.estudio_decidir(tid uuid, ok boolean, motivo text default '') returns void
language plpgsql security definer set search_path = public as $$
declare t tasks; p estudio_pedidos; m text := left(btrim(coalesce(motivo, '')), 1000);
begin
  if not public.estudio_aprova(auth.uid()) then raise exception 'Você não tem a marca Aprova Estúdio.'; end if;
  select * into t from tasks where id = tid for update;
  if not found or not t.estudio then raise exception 'Essa peça não é do Estúdio.'; end if;
  if t.status <> 'review' then raise exception 'Essa peça já foi decidida.'; end if;
  if not ok and length(m) < 3 then raise exception 'Diga o que ajustar.'; end if;
  perform set_config('ev.admin_op', '1', true);
  update tasks set status = case when ok then 'done' else 'doing' end,
    done_at = case when ok then now() else null end, position = extract(epoch from now()) * 1000,
    reviews = coalesce(reviews, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('by', auth.uid(), 'at', now(), 'ok', ok, 'reason', m, 'failed', '[]'::jsonb))
  where id = tid;
  if not ok then
    update estudio_pedidos set estado = 'fila', gerar_em = now(), passo = null, erro = null, ajustes = ajustes + 1,
      direcao = left(coalesce(nullif(direcao, '') || E'\n', '') || 'Ajuste pedido: ' || m, 4000), atualizado_em = now()
    where task_id = tid;
  end if;
end $$;
grant execute on function public.estudio_decidir(uuid, boolean, text) to authenticated;

-- peças que já estão esperando viram do Estúdio
update public.tasks t set estudio = true from public.estudio_pedidos p where p.task_id = t.id and not t.estudio;
