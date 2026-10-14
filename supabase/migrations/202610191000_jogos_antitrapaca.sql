-- sala de jogos sem trapaça: o navegador não grava mais pontuação.
-- cada partida nasce no servidor (jogos_iniciar), o relógio é do servidor e o total passa por teto plausível;
-- a Memória é jogada no servidor (as cartas ficam escondidas até virar).

revoke insert, update, delete, truncate on public.jogos_pontos from anon, authenticated;
drop policy if exists "jogos: criar" on public.jogos_pontos;
drop policy if exists "jogos: editar" on public.jogos_pontos;

create table if not exists public.jogos_partidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  jogo text not null check (jogo in ('cobrinha', 'penalti', 'memoria', 'reflexo')),
  inicio timestamptz not null default now(),
  t0 timestamptz,                         -- memória: primeira carta virada
  cartas smallint[],                      -- memória: 16 posições, figura 0..7
  pendente smallint,                      -- memória: carta aberta esperando o par
  achadas smallint[] not null default '{}',
  erros int not null default 0,
  pontos int,
  fim timestamptz
);
create index if not exists jogos_partidas_user on public.jogos_partidas (user_id, inicio desc);
alter table public.jogos_partidas enable row level security;
revoke all on public.jogos_partidas from anon, authenticated;

-- grava o recorde do mês (só sobe) e conta a partida
create or replace function public.jogos_gravar(me uuid, p_jogo text, p_pontos int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_mes text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'); antes int;
begin
  select pontos into antes from public.jogos_pontos where user_id = me and jogo = p_jogo and mes = v_mes;
  insert into public.jogos_pontos (id, user_id, jogo, mes, pontos, partidas)
    values (me || ':' || p_jogo || ':' || v_mes, me, p_jogo, v_mes, p_pontos, 1)
    on conflict (user_id, jogo, mes) do update set pontos = greatest(jogos_pontos.pontos, excluded.pontos), partidas = jogos_pontos.partidas + 1;
  return p_pontos > 0 and p_pontos > coalesce(antes, 0);
end $$;

create or replace function public.jogos_iniciar(p_jogo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid; ult timestamptz;
begin
  if me is null then raise exception 'Entre de novo para jogar.'; end if;
  if p_jogo not in ('cobrinha', 'penalti', 'memoria', 'reflexo') then raise exception 'Jogo desconhecido.'; end if;
  perform pg_advisory_xact_lock(hashtext('jogos:' || me::text));
  select max(inicio) into ult from public.jogos_partidas where user_id = me;
  if ult > now() - interval '2 seconds' then raise exception 'Calma: uma partida por vez.'; end if;
  if (select count(*) from public.jogos_partidas where user_id = me and inicio > now() - interval '1 day') >= 400 then
    raise exception 'Chega de jogo por hoje.';
  end if;
  -- partida largada no meio não vale mais
  update public.jogos_partidas set fim = now() where user_id = me and fim is null;
  insert into public.jogos_partidas (user_id, jogo, cartas) values (me, p_jogo,
    case when p_jogo = 'memoria' then (select array_agg(f order by random()) from (select (x % 8)::smallint f from generate_series(0, 15) x) z) end)
    returning id into rid;
  delete from public.jogos_partidas where user_id = me and inicio < now() - interval '3 days';
  return jsonb_build_object('id', rid);
end $$;

-- cobrinha, pênalti e reflexo: o total passa pelo relógio do servidor e pelo teto do jogo
create or replace function public.jogos_fim(p_id uuid, p_pontos int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jogos_partidas; s numeric; teto int; p int;
begin
  if me is null then raise exception 'Entre de novo para jogar.'; end if;
  perform pg_advisory_xact_lock(hashtext('jogos:' || me::text));
  select * into r from public.jogos_partidas where id = p_id and user_id = me;
  if r.id is null or r.fim is not null or r.jogo = 'memoria' then raise exception 'Partida não encontrada.'; end if;
  s := extract(epoch from now() - r.inicio);
  p := greatest(0, coalesce(p_pontos, 0));
  teto := case r.jogo
    -- 10 por café; a cobra anda no máximo 1 casa a cada 70 ms e o café nunca nasce colado
    when 'cobrinha' then least(3230, 10 * floor(s * 3)::int)
    -- 10 cobranças de no máximo 150, cada uma leva 420 ms no ar
    when 'penalti' then case when s < 4 then 0 else 1500 end
    -- 30 s de alvos; acima disso não é mão humana
    when 'reflexo' then case when s < 29 then 0 else 1200 end
  end;
  if r.jogo = 'cobrinha' and p % 10 <> 0 then p := 0; end if;
  if p > teto then p := 0; end if;  -- passou do possível: a partida não vale
  update public.jogos_partidas set fim = now(), pontos = p where id = r.id;
  return jsonb_build_object('pontos', p, 'recorde', public.jogos_gravar(me, r.jogo, p), 'valeu', p = greatest(0, coalesce(p_pontos, 0)));
end $$;

-- memória: vira uma carta; o servidor diz a figura, conta erros e o tempo
create or replace function public.jogos_virar(p_id uuid, p_pos int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.jogos_partidas; outra int; par boolean; s int; p int;
begin
  if me is null then raise exception 'Entre de novo para jogar.'; end if;
  perform pg_advisory_xact_lock(hashtext('jogos:' || me::text));
  select * into r from public.jogos_partidas where id = p_id and user_id = me;
  if r.id is null or r.fim is not null or r.jogo <> 'memoria' then raise exception 'Partida não encontrada.'; end if;
  if p_pos is null or p_pos < 0 or p_pos > 15 or p_pos::smallint = any(r.achadas) then raise exception 'Carta inválida.'; end if;
  if r.t0 is null then update public.jogos_partidas set t0 = now() where id = r.id; r.t0 := now(); end if;
  if r.pendente is null or r.pendente = p_pos then
    update public.jogos_partidas set pendente = p_pos where id = r.id;
    return jsonb_build_object('pos', p_pos, 'f', r.cartas[p_pos + 1], 'erros', r.erros);
  end if;
  outra := r.pendente;
  par := r.cartas[outra + 1] = r.cartas[p_pos + 1];
  if par then r.achadas := r.achadas || outra::smallint || p_pos::smallint; else r.erros := r.erros + 1; end if;
  update public.jogos_partidas set pendente = null, achadas = r.achadas, erros = r.erros where id = r.id;
  if cardinality(r.achadas) = 16 then
    s := floor(extract(epoch from now() - r.t0))::int;
    p := greatest(100, 1000 - r.erros * 30 - s * 5);
    update public.jogos_partidas set fim = now(), pontos = p where id = r.id;
    return jsonb_build_object('pos', p_pos, 'f', r.cartas[p_pos + 1], 'outra', outra, 'par', true, 'erros', r.erros,
      'fim', true, 'seg', s, 'pontos', p, 'recorde', public.jogos_gravar(me, 'memoria', p));
  end if;
  return jsonb_build_object('pos', p_pos, 'f', r.cartas[p_pos + 1], 'outra', outra, 'par', par, 'erros', r.erros);
end $$;

revoke all on function public.jogos_gravar(uuid, text, int) from public, anon, authenticated;
revoke all on function public.jogos_iniciar(text), public.jogos_fim(uuid, int), public.jogos_virar(uuid, int) from public, anon;
grant execute on function public.jogos_iniciar(text), public.jogos_fim(uuid, int), public.jogos_virar(uuid, int) to authenticated;
