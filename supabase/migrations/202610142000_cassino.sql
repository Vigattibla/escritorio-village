-- Cassino dos cafezinhos: caça-níquel, roleta, crash, blackjack e campo minado.
-- Quem sorteia, guarda as cartas/minas e paga é o servidor; o navegador só anima o resultado.
-- Extrato: 'aposta' (débito, ref = rodada[:dobro]) e 'premio' (crédito, ref = rodada).

alter table public.coffee_log drop constraint if exists coffee_log_reason_check;
alter table public.coffee_log add constraint coffee_log_reason_check
  check (reason in ('dia', 'boasvindas', 'fase', 'meta', 'compra', 'aposta', 'premio'));

create table if not exists public.cassino_rodadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  jogo text not null check (jogo in ('caca', 'roleta', 'crash', 'blackjack', 'minas')),
  aposta int not null,
  escolha jsonb not null default '{}',
  baralho int[], mao int[], banca int[], dobrou boolean not null default false, -- blackjack
  minas int[], abertas int[] not null default '{}',                              -- campo minado
  resultado jsonb not null default '{}',
  aberta boolean not null default true,
  premio int not null default 0,
  created_at timestamptz not null default now(),
  fim timestamptz
);
-- uma mão aberta por jogo; ninguém lê a tabela direto (as minas e o baralho ficam escondidos)
create unique index if not exists cassino_uma_aberta on public.cassino_rodadas (user_id, jogo) where aberta;
alter table public.cassino_rodadas enable row level security;
revoke all on public.cassino_rodadas from anon, authenticated;

-- ---------- peças internas (só as funções abaixo usam) ----------
create or replace function public.cassino_debita(me uuid, valor int, ref text) returns void
language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  if valor is null or valor < 1 or valor > 100 then raise exception 'Aposte de 1 a 100 cafezinhos.'; end if;
  select coalesce(sum(amount), 0) into bal from public.coffee_log where user_id = me;
  if bal < valor then raise exception 'Faltam % cafezinhos.', valor - bal; end if;
  insert into public.coffee_log (user_id, amount, reason, ref) values (me, -valor, 'aposta', ref);
end $$;

create or replace function public.cassino_fecha(rid uuid, valor int, res jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  update public.cassino_rodadas set aberta = false, premio = valor, resultado = resultado || coalesce(res, '{}'), fim = now()
    where id = rid returning user_id into me;
  if valor > 0 then
    insert into public.coffee_log (user_id, amount, reason, ref) values (me, valor, 'premio', rid::text) on conflict do nothing;
  end if;
end $$;

-- pontos de uma mão: A vale 11 ou 1, figuras 10. Carta = 0..51, valor = carta % 13 (0 = A, 9..12 = 10 J Q K)
create or replace function public.cassino_bj(m int[]) returns int language plpgsql immutable as $$
declare t int := 0; ases int := 0; c int;
begin
  foreach c in array coalesce(m, '{}'::int[]) loop
    if c % 13 = 0 then t := t + 11; ases := ases + 1;
    elsif c % 13 >= 9 then t := t + 10;
    else t := t + c % 13 + 1; end if;
  end loop;
  while t > 21 and ases > 0 loop t := t - 10; ases := ases - 1; end loop;
  return t;
end $$;

-- multiplicador do campo minado depois de k casas limpas (3% da casa)
create or replace function public.cassino_mult(n int, k int) returns numeric language plpgsql immutable as $$
declare m numeric := 0.97; i int;
begin
  if k <= 0 then return 1; end if;
  for i in 0 .. k - 1 loop m := m * (25 - i)::numeric / (25 - n - i); end loop;
  return round(m, 2);
end $$;

-- o que o jogador pode ver da rodada
create or replace function public.cassino_vista(rid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.cassino_rodadas; v jsonb;
begin
  select * into r from public.cassino_rodadas where id = rid;
  v := jsonb_build_object('id', r.id, 'jogo', r.jogo, 'aposta', r.aposta, 'aberta', r.aberta, 'premio', r.premio, 'resultado', r.resultado,
    'saldo', (select coalesce(sum(amount), 0) from public.coffee_log where user_id = r.user_id));
  if r.jogo = 'blackjack' then
    v := v || jsonb_build_object('mao', to_jsonb(r.mao), 'pontos', public.cassino_bj(r.mao), 'dobrou', r.dobrou,
      'banca', to_jsonb(case when r.aberta then r.banca[1:1] else r.banca end),
      'banca_pontos', case when r.aberta then public.cassino_bj(r.banca[1:1]) else public.cassino_bj(r.banca) end);
  elsif r.jogo = 'minas' then
    v := v || jsonb_build_object('n', cardinality(r.minas), 'abertas', to_jsonb(r.abertas),
      'mult', public.cassino_mult(cardinality(r.minas), cardinality(r.abertas)),
      'proximo', public.cassino_mult(cardinality(r.minas), cardinality(r.abertas) + 1),
      'minas', case when r.aberta then null else to_jsonb(r.minas) end);
  end if;
  return v;
end $$;

-- banca joga (para em 17) e paga: vitória 2x, empate devolve
create or replace function public.cassino_banca(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.cassino_rodadas; p int; b int; total int; res text;
begin
  select * into r from public.cassino_rodadas where id = rid;
  total := r.aposta * case when r.dobrou then 2 else 1 end;
  p := public.cassino_bj(r.mao);
  if p > 21 then perform public.cassino_fecha(rid, 0, '{"fim":"estourou"}'); return; end if;
  while public.cassino_bj(r.banca) < 17 loop
    r.banca := r.banca || r.baralho[1]; r.baralho := r.baralho[2:];
  end loop;
  update public.cassino_rodadas set banca = r.banca, baralho = r.baralho where id = rid;
  b := public.cassino_bj(r.banca);
  if b > 21 or p > b then res := case when b > 21 then 'banca_estourou' else 'ganhou' end; perform public.cassino_fecha(rid, total * 2, jsonb_build_object('fim', res));
  elsif p = b then perform public.cassino_fecha(rid, total, '{"fim":"empate"}');
  else perform public.cassino_fecha(rid, 0, '{"fim":"perdeu"}'); end if;
end $$;

revoke all on function public.cassino_debita(uuid, int, text), public.cassino_fecha(uuid, int, jsonb), public.cassino_vista(uuid), public.cassino_banca(uuid) from public, anon, authenticated;

-- ---------- jogos de uma jogada: caça-níquel, roleta, crash ----------
-- caça-níquel: 7 símbolos com peso (cereja 9, café 7, limão 6, sino 4, estrela 3, diamante 2, sete 1 em 32)
create or replace function public.cassino_jogar(p_jogo text, p_aposta int, p_escolha jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid := gen_random_uuid(); x int; rolos int[] := '{}'; i int; acc int; s int;
  tres numeric[] := '{4,6,10,15,25,50,100}'; dois numeric[] := '{1,1.5,1.5,2,3,4,8}'; pesos int[] := '{9,7,6,4,3,2,1}';
  mult numeric := 0; tipo text; n int; num int; alvo numeric; ponto numeric; u float8;
  vermelhos int[] := '{1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36}';
begin
  if me is null then raise exception 'Entre de novo para apostar.'; end if;
  if p_jogo not in ('caca', 'roleta', 'crash') then raise exception 'Jogo desconhecido.'; end if;
  if p_jogo = 'roleta' then
    tipo := p_escolha->>'tipo'; num := (p_escolha->>'n')::int;
    if tipo is null or tipo not in ('vermelho', 'preto', 'par', 'impar', 'baixo', 'alto', 'duzia1', 'duzia2', 'duzia3', 'numero')
      or (tipo = 'numero' and (num is null or num < 0 or num > 36)) then raise exception 'Escolha onde apostar na mesa.'; end if;
  elsif p_jogo = 'crash' then
    alvo := round((p_escolha->>'alvo')::numeric, 2);
    if alvo is null or alvo < 1.01 or alvo > 100 then raise exception 'O alvo vai de 1,01x a 100x.'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  insert into public.cassino_rodadas (id, user_id, jogo, aposta, escolha) values (rid, me, p_jogo, p_aposta, coalesce(p_escolha, '{}'));
  perform public.cassino_debita(me, p_aposta, rid::text);

  if p_jogo = 'caca' then
    for i in 1 .. 3 loop
      x := floor(random() * 32)::int; acc := 0;
      for s in 1 .. 7 loop acc := acc + pesos[s]; if x < acc then rolos := rolos || (s - 1); exit; end if; end loop;
    end loop;
    if rolos[1] = rolos[2] and rolos[2] = rolos[3] then mult := tres[rolos[1] + 1];
    elsif rolos[1] = rolos[2] or rolos[1] = rolos[3] then mult := dois[rolos[1] + 1];
    elsif rolos[2] = rolos[3] then mult := dois[rolos[2] + 1]; end if;
    perform public.cassino_fecha(rid, floor(p_aposta * mult)::int, jsonb_build_object('rolos', to_jsonb(rolos), 'mult', mult));
  elsif p_jogo = 'roleta' then
    n := floor(random() * 37)::int;
    mult := case
      when n = 0 then case when tipo = 'numero' and num = 0 then 36 else 0 end
      when tipo = 'numero' then case when num = n then 36 else 0 end
      when tipo = 'vermelho' then case when n = any(vermelhos) then 2 else 0 end
      when tipo = 'preto' then case when n <> all(vermelhos) then 2 else 0 end
      when tipo = 'par' then case when n % 2 = 0 then 2 else 0 end
      when tipo = 'impar' then case when n % 2 = 1 then 2 else 0 end
      when tipo = 'baixo' then case when n <= 18 then 2 else 0 end
      when tipo = 'alto' then case when n >= 19 then 2 else 0 end
      when tipo = 'duzia1' then case when n <= 12 then 3 else 0 end
      when tipo = 'duzia2' then case when n between 13 and 24 then 3 else 0 end
      when tipo = 'duzia3' then case when n >= 25 then 3 else 0 end
      else 0 end;
    perform public.cassino_fecha(rid, floor(p_aposta * mult)::int, jsonb_build_object('n', n, 'mult', mult));
  else
    -- P(chegar em x) = 0,97/x: com qualquer alvo a casa fica com 3%
    u := random();
    ponto := least(1000, greatest(1, floor(97 / (1 - u))::numeric / 100));
    mult := case when alvo <= ponto then alvo else 0 end;
    perform public.cassino_fecha(rid, floor(p_aposta * mult)::int, jsonb_build_object('ponto', ponto, 'alvo', alvo, 'mult', mult));
  end if;
  return public.cassino_vista(rid);
end $$;

-- ---------- jogos com várias jogadas: blackjack e campo minado ----------
create or replace function public.cassino_abrir(p_jogo text, p_aposta int, p_escolha jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid; d int[]; n int; p int; b int;
begin
  if me is null then raise exception 'Entre de novo para apostar.'; end if;
  if p_jogo not in ('blackjack', 'minas') then raise exception 'Jogo desconhecido.'; end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  -- rodada que ficou aberta continua de onde parou, sem cobrar de novo
  select id into rid from public.cassino_rodadas where user_id = me and jogo = p_jogo and aberta;
  if rid is not null then return public.cassino_vista(rid) || '{"retomada":true}'; end if;
  if p_jogo = 'minas' then
    n := (p_escolha->>'minas')::int;
    if n is null or n < 1 or n > 24 then raise exception 'Escolha de 1 a 24 minas.'; end if;
  end if;
  rid := gen_random_uuid();
  insert into public.cassino_rodadas (id, user_id, jogo, aposta, escolha) values (rid, me, p_jogo, p_aposta, coalesce(p_escolha, '{}'));
  perform public.cassino_debita(me, p_aposta, rid::text);
  if p_jogo = 'minas' then
    update public.cassino_rodadas set minas = (select array_agg(c) from (select c from generate_series(0, 24) c order by random() limit n) z) where id = rid;
  else
    select array_agg(c order by random()) into d from generate_series(0, 51) c;
    update public.cassino_rodadas set mao = array[d[1], d[3]], banca = array[d[2], d[4]], baralho = d[5:] where id = rid;
    p := public.cassino_bj(array[d[1], d[3]]); b := public.cassino_bj(array[d[2], d[4]]);
    -- blackjack de saída paga 3:2; se a banca também tiver, empata
    if p = 21 and b = 21 then perform public.cassino_fecha(rid, p_aposta, '{"fim":"empate"}');
    elsif p = 21 then perform public.cassino_fecha(rid, floor(p_aposta * 2.5)::int, '{"fim":"blackjack"}');
    elsif b = 21 then perform public.cassino_fecha(rid, 0, '{"fim":"banca_blackjack"}'); end if;
  end if;
  return public.cassino_vista(rid);
end $$;

create or replace function public.cassino_acao(p_rodada uuid, p_acao text, p_casa int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.cassino_rodadas;
begin
  if me is null then raise exception 'Entre de novo para apostar.'; end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  select * into r from public.cassino_rodadas where id = p_rodada and user_id = me;
  if r.id is null then raise exception 'Rodada não encontrada.'; end if;
  if not r.aberta then return public.cassino_vista(r.id); end if;

  if r.jogo = 'blackjack' then
    if p_acao = 'dobrar' then
      if cardinality(r.mao) <> 2 then raise exception 'Só dá pra dobrar com as 2 primeiras cartas.'; end if;
      perform public.cassino_debita(me, r.aposta, r.id::text || ':dobro');
      update public.cassino_rodadas set dobrou = true, mao = mao || baralho[1], baralho = baralho[2:] where id = r.id;
      perform public.cassino_banca(r.id);
    elsif p_acao = 'pedir' then
      r.mao := r.mao || r.baralho[1];
      update public.cassino_rodadas set mao = r.mao, baralho = baralho[2:] where id = r.id;
      if public.cassino_bj(r.mao) >= 21 then perform public.cassino_banca(r.id); end if;
    elsif p_acao = 'parar' then
      perform public.cassino_banca(r.id);
    else raise exception 'Jogada desconhecida.'; end if;
  else
    if p_acao = 'abrir' then
      if p_casa is null or p_casa < 0 or p_casa > 24 then raise exception 'Casa inválida.'; end if;
      if p_casa = any(r.abertas) then return public.cassino_vista(r.id); end if;
      r.abertas := r.abertas || p_casa;
      update public.cassino_rodadas set abertas = r.abertas where id = r.id;
      if p_casa = any(r.minas) then
        perform public.cassino_fecha(r.id, 0, jsonb_build_object('fim', 'mina', 'casa', p_casa));
      elsif cardinality(r.abertas) = 25 - cardinality(r.minas) then
        perform public.cassino_fecha(r.id, floor(r.aposta * public.cassino_mult(cardinality(r.minas), cardinality(r.abertas)))::int, '{"fim":"limpou"}');
      end if;
    elsif p_acao = 'sacar' then
      if cardinality(r.abertas) = 0 then raise exception 'Abra pelo menos uma casa antes de sacar.'; end if;
      perform public.cassino_fecha(r.id, floor(r.aposta * public.cassino_mult(cardinality(r.minas), cardinality(r.abertas)))::int, '{"fim":"sacou"}');
    else raise exception 'Jogada desconhecida.'; end if;
  end if;
  return public.cassino_vista(r.id);
end $$;

-- rodada aberta (blackjack/minas) pra continuar ao reabrir o cassino
create or replace function public.cassino_estado(p_jogo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from public.cassino_rodadas where user_id = auth.uid() and jogo = p_jogo and aberta;
  return case when rid is null then null else public.cassino_vista(rid) end;
end $$;

revoke all on function public.cassino_jogar(text, int, jsonb), public.cassino_abrir(text, int, jsonb), public.cassino_acao(uuid, text, int), public.cassino_estado(text) from public, anon;
grant execute on function public.cassino_jogar(text, int, jsonb), public.cassino_abrir(text, int, jsonb), public.cassino_acao(uuid, text, int), public.cassino_estado(text) to authenticated;

-- saldo direto no banco: com o cassino o extrato passa fácil das 2000 linhas que o app lia pra somar
create or replace function public.cafe_saldo() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.coffee_log where user_id = auth.uid()
$$;
revoke all on function public.cafe_saldo() from public, anon;
grant execute on function public.cafe_saldo() to authenticated;
