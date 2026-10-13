-- Publicação direta no LinkedIn. Post = tarefa com canal 'linkedin': a legenda é a descrição, as imagens são os anexos.
-- Aprovou (última revisão ok) → entra na fila; sai na data de publicação (ou na hora, sem data).
-- A função linkedin (supabase/functions/linkedin) publica; o pg_cron chama ela a cada 5 min.
do $$ begin
  alter table public.tasks drop constraint if exists tasks_channel_chk;
  alter table public.tasks add constraint tasks_channel_chk check (channel is null or channel in ('feed', 'reels', 'stories', 'facebook', 'site', 'linkedin'));
end $$;

-- conta conectada (sem segredo): todo mundo vê se está conectada e até quando
create table if not exists public.redes (
  id text primary key check (id in ('linkedin')),
  nome text not null default '',
  autor text not null default '',
  modo text not null default 'pessoal' check (modo in ('pessoal', 'empresa')),
  expira timestamptz,
  refresh_expira timestamptz,
  conectado_por uuid references public.profiles(id) on delete set null,
  em timestamptz not null default now()
);
alter table public.redes enable row level security;
drop policy if exists "redes: ver" on public.redes;
create policy "redes: ver" on public.redes for select to authenticated using (true);
do $$ begin alter publication supabase_realtime add table public.redes; exception when duplicate_object then null; end $$;

-- tokens (cifrados pela função): ninguém do site lê nem grava, só a função
create table if not exists public.social_tokens (
  id text primary key references public.redes(id) on delete cascade,
  dados text not null,
  em timestamptz not null default now()
);
alter table public.social_tokens enable row level security;
revoke all on public.social_tokens from anon, authenticated;

-- fila: uma postagem por tarefa
create table if not exists public.postagens (
  id uuid primary key references public.tasks(id) on delete cascade,
  rede text not null default 'linkedin',
  quando timestamptz not null default now(),
  estado text not null default 'agendado' check (estado in ('agendado', 'publicando', 'publicado', 'erro')),
  urn text,
  link text,
  erro text,
  tentativas int not null default 0,
  aprovado_por uuid references public.profiles(id) on delete set null,
  em timestamptz not null default now()
);
alter table public.postagens enable row level security;
drop policy if exists "postagens: ver" on public.postagens;
create policy "postagens: ver" on public.postagens for select to authenticated using (exists (select 1 from public.tasks t where t.id = postagens.id));
do $$ begin alter publication supabase_realtime add table public.postagens; exception when duplicate_object then null; end $$;

-- chama a função agora (pg_net); sem pg_net, o cron das 5 em 5 min resolve
create or replace function public.linkedin_tick() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(url := 'https://dfqcdyjovwncpvdwvioo.supabase.co/functions/v1/linkedin/tick', body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb);
exception when others then null;
end $$;
revoke all on function public.linkedin_tick() from public, anon, authenticated;

-- aprovação → fila; saiu de concluída antes de publicar → sai da fila; mudou a data → muda o horário
create or replace function public.postagem_fila() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ok boolean := coalesce((new.reviews -> -1 ->> 'ok')::boolean, false);
  quem uuid := nullif(new.reviews -> -1 ->> 'by', '')::uuid;
  q timestamptz := greatest(coalesce(new.publish_at, now()), now());
begin
  if new.channel is distinct from 'linkedin' or new.status <> 'done' then
    delete from public.postagens where id = new.id and estado = 'agendado';
    return new;
  end if;
  if old.status is distinct from 'done' and ok then
    insert into public.postagens (id, quando, aprovado_por) values (new.id, q, quem)
      on conflict (id) do update set quando = excluded.quando, aprovado_por = excluded.aprovado_por, estado = 'agendado', erro = null
      where postagens.estado in ('agendado', 'erro');
    if q <= now() + interval '1 minute' then perform public.linkedin_tick(); end if;
  elsif new.publish_at is distinct from old.publish_at then
    update public.postagens set quando = q where id = new.id and estado = 'agendado';
  end if;
  return new;
exception when invalid_text_representation then return new;
end $$;
drop trigger if exists postagem_fila on public.tasks;
create trigger postagem_fila after update on public.tasks for each row execute function public.postagem_fila();

-- a função pega até n postagens vencidas (sem pegar a mesma duas vezes)
create or replace function public.postagens_pegar(n int default 5) returns setof public.postagens
language sql security definer set search_path = public as $$
  update public.postagens p set estado = 'publicando', tentativas = p.tentativas + 1, em = now()
  where p.id in (select id from public.postagens where estado = 'agendado' and quando <= now() order by quando limit n for update skip locked)
  returning p.*
$$;
revoke all on function public.postagens_pegar(int) from public, anon, authenticated;

-- pg_cron + pg_net: se não der pra ligar aqui, o resto funciona e a publicação fica só na hora da aprovação
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then raise notice 'pg_net: %', sqlerrm; end $$;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'linkedin-tick';
  perform cron.schedule('linkedin-tick', '*/5 * * * *', 'select public.linkedin_tick()');
exception when others then raise notice 'pg_cron: %', sqlerrm; end $$;
