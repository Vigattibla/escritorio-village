-- Latinhas ⚡ (moeda rara) e o bolão do cassino.
-- Bolão: toda sexta 17h (Brasília) o servidor sorteia o pote entre os bilhetes da semana.
--   pote = 30 de semente + o que a casa ganhou no cassino na semana (apostas − prêmios, nunca negativo)
--          + bilhetes comprados + o que acumulou de semana sem bilhete.
--   bilhetes grátis: 1 por fase de meta e 2 por meta batida na semana; comprados: 15 cafezinhos, até 5 por semana.
--   prêmio: o pote em cafezinhos + latinhas (3 + pote/50, máx. 10) + selo Sortudo + um móvel raro que ainda não tenha.
-- O sorteio é preguiçoso: quem abrir o bolão depois das 17h dispara (uma vez só, com trava).
-- Latinhas: só entram pelo bolão ou pela troca (150 cafezinhos → 1, até 2 por semana). Ninguém transfere.

alter table public.coffee_log drop constraint if exists coffee_log_reason_check;
alter table public.coffee_log add constraint coffee_log_reason_check
  check (reason in ('dia', 'boasvindas', 'fase', 'meta', 'compra', 'aposta', 'premio', 'bilhete', 'bolao', 'troca'));

-- ---------- latinhas ----------
create table if not exists public.latinha_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('bolao', 'troca', 'compra')),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
alter table public.latinha_log enable row level security;
revoke insert, update, delete, truncate on public.latinha_log from anon, authenticated;
grant select on public.latinha_log to authenticated;
drop policy if exists "latinhas: só as minhas" on public.latinha_log;
create policy "latinhas: só as minhas" on public.latinha_log for select to authenticated using (user_id = auth.uid());

create or replace function public.latinha_saldo() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.latinha_log where user_id = auth.uid()
$$;

-- fim da janela que contém ts: a próxima sexta 17h de Brasília
create or replace function public.bolao_fim(ts timestamptz) returns timestamptz
language sql stable set search_path = public as $$
  select ((date_trunc('week', (ts at time zone 'America/Sao_Paulo') - interval '4 days 17 hours')
    + interval '11 days 17 hours') at time zone 'America/Sao_Paulo')
$$;

create or replace function public.trocar_latinha() returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bal int; fim timestamptz := public.bolao_fim(now()); n int; ref text;
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform pg_advisory_xact_lock(hashtext('latinha:' || me));
  select count(*) into n from public.latinha_log where user_id = me and reason = 'troca' and created_at >= fim - interval '7 days';
  if n >= 2 then raise exception 'Já trocou 2 latinhas nesta semana. Volta na sexta depois das 17h.'; end if;
  select coalesce(sum(amount), 0) into bal from public.coffee_log where user_id = me;
  if bal < 150 then raise exception 'Faltam % cafezinhos para uma latinha.', 150 - bal; end if;
  ref := to_char(fim, 'YYYY-MM-DD') || ':' || (n + 1);
  insert into public.coffee_log (user_id, amount, reason, ref) values (me, -150, 'troca', ref);
  insert into public.latinha_log (user_id, amount, reason, ref) values (me, 1, 'troca', ref);
  return public.latinha_saldo();
end $$;

-- ---------- bolão ----------
create table if not exists public.bolao_sorteios (
  fim timestamptz primary key,
  pote int not null,
  bilhetes int not null,
  vencedor uuid references public.profiles(id) on delete set null,
  latinhas int not null default 0,
  item text,
  roleta jsonb not null default '[]', -- [{u, n}] de quem concorreu, na ordem da roleta
  sorteado_em timestamptz not null default now()
);
alter table public.bolao_sorteios enable row level security;
revoke insert, update, delete, truncate on public.bolao_sorteios from anon, authenticated;
grant select on public.bolao_sorteios to authenticated;
drop policy if exists "bolão: todo mundo vê" on public.bolao_sorteios;
create policy "bolão: todo mundo vê" on public.bolao_sorteios for select to authenticated using (true);

-- bilhetes de cada pessoa na janela que termina em f
create or replace function public.bolao_bilhetes(f timestamptz)
returns table (u uuid, gratis int, comprados int)
language sql stable security definer set search_path = public as $$
  select user_id,
    (count(*) filter (where reason = 'fase') + 2 * count(*) filter (where reason = 'meta'))::int,
    count(*) filter (where reason = 'bilhete')::int
  from public.coffee_log
  where reason in ('fase', 'meta', 'bilhete') and created_at >= f - interval '7 days' and created_at < f
  group by user_id
$$;

create or replace function public.bolao_pote(f timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select 30
    + greatest(0, -coalesce((select sum(amount) from public.coffee_log
        where reason in ('aposta', 'premio') and created_at >= f - interval '7 days' and created_at < f), 0))::int
    + 15 * (select count(*) from public.coffee_log where reason = 'bilhete' and created_at >= f - interval '7 days' and created_at < f)::int
    + coalesce((select s.pote from public.bolao_sorteios s where s.fim = f - interval '7 days' and s.vencedor is null), 0)
$$;

-- sorteia a última janela fechada, se ainda não foi
create or replace function public.bolao_sortear() returns void
language plpgsql security definer set search_path = public as $$
declare f timestamptz := public.bolao_fim(now()) - interval '7 days'; pote int; total int; alvo int; acc int := 0;
  w uuid; rol jsonb; lat int; it text; b record;
begin
  if f < '2026-10-16 20:00+00' then return; end if; -- o primeiro bolão fecha na sexta 16/10
  if exists (select 1 from public.bolao_sorteios where fim = f) then return; end if;
  perform pg_advisory_xact_lock(hashtext('bolao'));
  if exists (select 1 from public.bolao_sorteios where fim = f) then return; end if;
  pote := public.bolao_pote(f);
  select coalesce(sum(gratis + comprados), 0), coalesce(jsonb_agg(jsonb_build_object('u', x.u, 'n', gratis + comprados) order by random()), '[]')
    into total, rol from public.bolao_bilhetes(f) x;
  if total > 0 then
    alvo := floor(random() * total)::int;
    for b in select (e->>'u')::uuid as u, (e->>'n')::int as n from jsonb_array_elements(rol) e loop
      acc := acc + b.n;
      if alvo < acc then w := b.u; exit; end if;
    end loop;
    lat := least(10, 3 + pote / 50);
    select x into it from unnest(array['enfeite:trevo', 'chao:pote-ouro', 'cadeira:trono-sortudo']) x
      where not exists (select 1 from public.coffee_log where user_id = w and reason = 'compra' and ref = x) limit 1;
    insert into public.coffee_log (user_id, amount, reason, ref) values (w, pote, 'bolao', to_char(f, 'YYYY-MM-DD'));
    insert into public.latinha_log (user_id, amount, reason, ref) values (w, lat, 'bolao', to_char(f, 'YYYY-MM-DD'));
    if it is not null then insert into public.coffee_log (user_id, amount, reason, ref) values (w, 0, 'compra', it) on conflict do nothing; end if;
  end if;
  insert into public.bolao_sorteios (fim, pote, bilhetes, vencedor, latinhas, item, roleta)
    values (f, pote, total, w, coalesce(lat, 0), it, rol);
end $$;

create or replace function public.bolao_estado() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f timestamptz := public.bolao_fim(now()); meu record; tot int; gente int;
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform public.bolao_sortear();
  select coalesce(sum(gratis + comprados), 0)::int, count(*)::int into tot, gente from public.bolao_bilhetes(f);
  select gratis, comprados into meu from public.bolao_bilhetes(f) where u = me;
  return jsonb_build_object(
    'fim', f, 'pote', public.bolao_pote(f), 'bilhetes', tot, 'gente', gente,
    'gratis', coalesce(meu.gratis, 0), 'comprados', coalesce(meu.comprados, 0),
    'latinhas', public.latinha_saldo(),
    'historico', coalesce((select jsonb_agg(to_jsonb(s) order by s.fim desc) from (select * from public.bolao_sorteios order by fim desc limit 10) s), '[]'));
end $$;

create or replace function public.bolao_comprar() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f timestamptz := public.bolao_fim(now()); n int; bal int;
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform pg_advisory_xact_lock(hashtext('bilhete:' || me));
  select count(*) into n from public.coffee_log where user_id = me and reason = 'bilhete' and created_at >= f - interval '7 days';
  if n >= 5 then raise exception 'Limite de 5 bilhetes comprados por semana. Bater meta dá bilhete grátis!'; end if;
  select coalesce(sum(amount), 0) into bal from public.coffee_log where user_id = me;
  if bal < 15 then raise exception 'Faltam % cafezinhos para um bilhete.', 15 - bal; end if;
  insert into public.coffee_log (user_id, amount, reason, ref) values (me, -15, 'bilhete', to_char(f, 'YYYY-MM-DD') || ':' || (n + 1));
  return public.bolao_estado();
end $$;

revoke all on function public.latinha_saldo(), public.trocar_latinha(), public.bolao_bilhetes(timestamptz), public.bolao_pote(timestamptz),
  public.bolao_sortear(), public.bolao_estado(), public.bolao_comprar() from public, anon;
grant execute on function public.latinha_saldo(), public.trocar_latinha(), public.bolao_estado(), public.bolao_comprar() to authenticated;
