-- Estúdio acoplado: o Turmeo pede (carrossel...), o Estúdio da VPS pega da fila, gera e entrega na tarefa (anexos + legenda, em aprovação).
-- O trabalhador entra como o adm (sessão dele), então só o adm pega/entrega; a equipe pede e acompanha.

create table if not exists public.estudio_pedidos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  tipo text not null default 'carrossel' check (tipo in ('carrossel')),
  molde text not null default 'convention-linkedin',
  pilar text,
  texto text not null check (length(texto) between 3 and 2000),
  direcao text not null default '',
  slides int not null default 0,
  quando timestamptz,
  estado text not null default 'fila' check (estado in ('fila', 'gerando', 'pronto', 'erro')),
  passo text,
  erro text,
  resultado jsonb,
  criado_por uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists estudio_pedidos_fila on public.estudio_pedidos (estado, criado_em);
alter table public.estudio_pedidos enable row level security;
drop policy if exists "estudio: ver" on public.estudio_pedidos;
create policy "estudio: ver" on public.estudio_pedidos for select to authenticated using (true);
drop policy if exists "estudio: pedir" on public.estudio_pedidos;
create policy "estudio: pedir" on public.estudio_pedidos for insert to authenticated with check (criado_por = auth.uid() and estado = 'fila');
drop policy if exists "estudio: cancelar" on public.estudio_pedidos;
create policy "estudio: cancelar" on public.estudio_pedidos for delete to authenticated
  using (estado in ('fila', 'erro') and (criado_por = auth.uid() or public.is_admin(auth.uid())));
drop policy if exists "estudio: trabalhador" on public.estudio_pedidos;
create policy "estudio: trabalhador" on public.estudio_pedidos for update to authenticated using (public.is_admin(auth.uid()));

-- sinal de vida do trabalhador (uma linha por máquina)
create table if not exists public.estudio_sinal (
  id text primary key,
  visto timestamptz not null default now(),
  info jsonb not null default '{}'
);
alter table public.estudio_sinal enable row level security;
drop policy if exists "sinal: ver" on public.estudio_sinal;
create policy "sinal: ver" on public.estudio_sinal for select to authenticated using (true);
drop policy if exists "sinal: gravar" on public.estudio_sinal;
create policy "sinal: gravar" on public.estudio_sinal for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- o Estúdio sobe os slides antes de a tarefa existir (pedido sem tarefa): adm envia em anexos/<id da tarefa nova>/
drop policy if exists "anexo: estúdio envia" on storage.objects;
create policy "anexo: estúdio envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and public.is_admin(auth.uid()));

do $$ begin alter publication supabase_realtime add table public.estudio_pedidos; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.estudio_sinal; exception when duplicate_object then null; end $$;

-- pega o próximo da fila (um por vez, sem dois trabalhadores pegarem o mesmo)
create or replace function public.estudio_pegar() returns setof public.estudio_pedidos
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o Estúdio pega pedidos.'; end if;
  -- pedido largado no meio (trabalhador caiu) volta pra fila depois de 30 min
  update estudio_pedidos set estado = 'fila', passo = null where estado = 'gerando' and atualizado_em < now() - interval '30 minutes';
  return query
    update estudio_pedidos set estado = 'gerando', passo = 'Começando', atualizado_em = now()
    where id = (select id from estudio_pedidos where estado = 'fila' order by criado_em limit 1 for update skip locked)
    returning *;
end $$;

-- entrega: anexa os arquivos (já no bucket anexos/<tarefa>/...), põe a legenda e deixa em aprovação.
-- Sem tarefa: cria uma para quem pediu, com canal e horário de publicar.
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
    insert into tasks (id, owner_id, created_by, title, notes, status, attachments, channel, publish_at, due, dept)
    values (tid, p.criado_por, p.criado_por, left(coalesce(nullif(titulo, ''), 'Carrossel do Estúdio'), 200), coalesce(legenda, ''),
            'review', anexos, canal, p.quando, (p.quando at time zone 'America/Sao_Paulo')::date, public.dept_of(p.criado_por));
  else
    update tasks set attachments = attachments || anexos,
      notes = case when coalesce(notes, '') = '' then coalesce(legenda, '') else notes || E'\n\n' || coalesce(legenda, '') end,
      channel = coalesce(channel, canal), status = 'review'
    where id = tid;
  end if;
  update estudio_pedidos set estado = 'pronto', passo = null, erro = null, task_id = tid, resultado = estudio_entregar.resultado, atualizado_em = now()
  where id = pid;
  return tid;
end $$;

grant execute on function public.estudio_pegar() to authenticated;
grant execute on function public.estudio_entregar(uuid, jsonb, text, text, text, jsonb) to authenticated;
