-- Poderes temporários (roguelike): toda segunda 9h (Brasília) o servidor sorteia 3 pessoas.
--   chance = 1 + fases + 2 × metas batidas nos 7 dias antes; sem repetir pessoa no mesmo sorteio.
--   evento: bater meta ou ganhar no bingo tem 25% de chance de dar um poder de 24h (se a pessoa não tiver nenhum ativo).
--   poderes: ima (+50% nos cafezinhos de dia/fase/meta), coringa (1 bilhete grátis por dia no bolão),
--            mesada (+15 ☕ por dia), megafone (1 aviso pro escritório inteiro), turbo (anda 2×),
--            chefe (arruma qualquer sala), visao (vê quem tem mais bilhetes no bolão).
--   Quem sorteia e paga é o servidor. Ninguém escreve na tabela direto.

alter table public.coffee_log drop constraint if exists coffee_log_reason_check;
alter table public.coffee_log add constraint coffee_log_reason_check
  check (reason in ('dia', 'boasvindas', 'fase', 'meta', 'compra', 'aposta', 'premio', 'bilhete', 'bolao', 'troca', 'bingo', 'poder', 'coringa'));

create table if not exists public.poderes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('ima', 'coringa', 'mesada', 'megafone', 'turbo', 'chefe', 'visao')),
  motivo text not null default 'sorteio' check (motivo in ('sorteio', 'evento')),
  semana timestamptz,
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  aviso text check (aviso is null or length(aviso) between 1 and 200),
  avisado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists poderes_fim on public.poderes (fim desc);
create unique index if not exists poderes_semana_user on public.poderes (semana, user_id) where semana is not null;
alter table public.poderes enable row level security;
drop policy if exists "poderes: todo mundo vê" on public.poderes;
create policy "poderes: todo mundo vê" on public.poderes for select to authenticated using (true);
grant select on public.poderes to authenticated;
do $$ begin alter publication supabase_realtime add table public.poderes; exception when duplicate_object then null; end $$;

create or replace function public.tem_poder(uid uuid, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.poderes where user_id = uid and tipo = t and inicio <= now() and fim > now())
$$;

-- segunda 9h (Brasília) da semana de ts
create or replace function public.poderes_semana(ts timestamptz) returns timestamptz
language sql stable as $$
  select ((date_trunc('week', (ts at time zone 'America/Sao_Paulo') - interval '9 hours') + interval '9 hours') at time zone 'America/Sao_Paulo')
$$;

create or replace function public.poder_horas(t text) returns int
language sql immutable as $$
  select case t when 'ima' then 48 when 'coringa' then 72 when 'mesada' then 72 when 'megafone' then 24
    when 'turbo' then 168 when 'chefe' then 24 when 'visao' then 96 else 24 end
$$;

create or replace function public.poder_nome(t text) returns text
language sql immutable as $$
  select case t when 'ima' then 'Ímã' when 'coringa' then 'Coringa' when 'mesada' then 'Mesada' when 'megafone' then 'Megafone'
    when 'turbo' then 'Turbo' when 'chefe' then 'Chefe por um dia' when 'visao' then 'Visão' else t end
$$;

-- dá o poder e avisa no canal geral
create or replace function public.poder_dar(uid uuid, t text, mot text, sem timestamptz, horas int) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.poderes (user_id, tipo, motivo, semana, fim) values (uid, t, mot, sem, now() + make_interval(hours => horas))
    on conflict do nothing;
  if found then
    insert into public.messages (id, channel, sender_id, body) values (gen_random_uuid(), 'geral', uid,
      '✨ Ganhei o poder ' || public.poder_nome(t) || (case when mot = 'evento' then ' (sorte do dia)' else ' no sorteio da semana' end)
      || ' até ' || to_char((now() + make_interval(hours => horas)) at time zone 'America/Sao_Paulo', 'DD/MM HH24"h"') || '.');
  end if;
end $$;

-- sorteio da semana, se ainda não saiu
create or replace function public.poderes_sortear() returns void
language plpgsql security definer set search_path = public as $$
declare s timestamptz := public.poderes_semana(now()); w record; tipos text[] := array['ima', 'coringa', 'mesada', 'megafone', 'turbo', 'chefe', 'visao']; t text;
begin
  if exists (select 1 from public.poderes where semana = s) then return; end if;
  perform pg_advisory_xact_lock(hashtext('poderes'));
  if exists (select 1 from public.poderes where semana = s) then return; end if;
  for w in
    select p.id from public.profiles p
    left join (select user_id, count(*) filter (where reason = 'fase') + 2 * count(*) filter (where reason = 'meta') as pts
      from public.coffee_log where reason in ('fase', 'meta') and created_at >= s - interval '7 days' and created_at < s group by user_id) c
      on c.user_id = p.id
    where p.avatar is not null
    order by power(random(), 1.0 / (1 + coalesce(c.pts, 0))) desc
    limit 3
  loop
    t := tipos[1 + floor(random() * array_length(tipos, 1))::int];
    tipos := array_remove(tipos, t);
    perform public.poder_dar(w.id, t, 'sorteio', s, public.poder_horas(t));
  end loop;
end $$;

-- meus extras do dia (mesada e coringa) + sorteio; devolve os poderes ativos e os da semana
create or replace function public.poderes_estado() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); hoje text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'); p record;
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform public.poderes_sortear();
  for p in select * from public.poderes where user_id = me and inicio <= now() and fim > now() and tipo in ('mesada', 'coringa') loop
    if not exists (select 1 from public.coffee_log where user_id = me and ref = p.tipo || ':' || p.id || ':' || hoje) then
      insert into public.coffee_log (user_id, amount, reason, ref)
        values (me, case when p.tipo = 'mesada' then 15 else 0 end, case when p.tipo = 'mesada' then 'poder' else 'coringa' end, p.tipo || ':' || p.id || ':' || hoje);
    end if;
  end loop;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.inicio desc) from public.poderes x where x.fim > now() - interval '7 days'), '[]');
end $$;

-- megafone: 1 aviso por poder
create or replace function public.megafone(texto text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pid uuid;
begin
  texto := btrim(coalesce(texto, ''));
  if length(texto) < 1 or length(texto) > 200 then raise exception 'O aviso precisa ter de 1 a 200 letras.'; end if;
  select id into pid from public.poderes where user_id = me and tipo = 'megafone' and inicio <= now() and fim > now() and aviso is null limit 1;
  if pid is null then raise exception 'Você não tem megafone para usar.'; end if;
  update public.poderes set aviso = texto, avisado_em = now() where id = pid;
  insert into public.messages (id, channel, sender_id, body) values (gen_random_uuid(), 'geral', me, '📣 ' || texto);
end $$;

-- visão: quem tem mais bilhetes no bolão desta semana
create or replace function public.visao_bolao() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.tem_poder(me, 'visao') then raise exception 'Só quem tem o poder Visão vê isso.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('u', u, 'n', gratis + comprados) order by gratis + comprados desc)
    from (select * from public.bolao_bilhetes(public.bolao_fim(now())) order by gratis + comprados desc limit 5) b), '[]');
end $$;

-- coringa conta como bilhete grátis
create or replace function public.bolao_bilhetes(f timestamptz)
returns table (u uuid, gratis int, comprados int)
language sql stable security definer set search_path = public as $$
  select user_id,
    (count(*) filter (where reason in ('fase', 'coringa')) + 2 * count(*) filter (where reason = 'meta'))::int,
    count(*) filter (where reason = 'bilhete')::int
  from public.coffee_log
  where reason in ('fase', 'meta', 'bilhete', 'coringa') and created_at >= f - interval '7 days' and created_at < f
  group by user_id
$$;

-- ímã: +50% no que entra por dia/fase/meta
create or replace function public.poder_ima() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.amount > 0 and new.reason in ('dia', 'fase', 'meta') and public.tem_poder(new.user_id, 'ima') then
    new.amount := new.amount + ceil(new.amount / 2.0)::int;
  end if;
  return new;
end $$;
drop trigger if exists poder_ima on public.coffee_log;
create trigger poder_ima before insert on public.coffee_log for each row execute function public.poder_ima();

-- sorte do dia: meta batida ou prêmio do bingo
create or replace function public.poder_evento() returns trigger
language plpgsql security definer set search_path = public as $$
declare tipos text[] := array['ima', 'coringa', 'mesada', 'megafone', 'turbo', 'chefe', 'visao'];
begin
  if (new.reason = 'meta' or (new.reason = 'bingo' and new.amount > 0)) and random() < 0.25
    and not exists (select 1 from public.poderes where user_id = new.user_id and fim > now()) then
    perform public.poder_dar(new.user_id, tipos[1 + floor(random() * 7)::int], 'evento', null, 24);
  end if;
  return null;
end $$;
drop trigger if exists poder_evento on public.coffee_log;
create trigger poder_evento after insert on public.coffee_log for each row execute function public.poder_evento();

-- chefe por um dia arruma qualquer sala
create or replace function public.can_edit_office(uid uuid, room text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rank_of(uid) = 4
    or public.tem_poder(uid, 'chefe')
    or (public.dept_of(uid) = room and (public.rank_of(uid) >= 2
      or exists (select 1 from public.carpenters c where c.id = uid and c.until > now())))
$$;

revoke all on function public.poder_dar(uuid, text, text, timestamptz, int), public.poderes_sortear(), public.poder_ima(), public.poder_evento() from public, anon, authenticated;
revoke all on function public.poderes_estado(), public.megafone(text), public.visao_bolao(), public.tem_poder(uuid, text) from public, anon;
grant execute on function public.poderes_estado(), public.megafone(text), public.visao_bolao(), public.tem_poder(uuid, text) to authenticated;
