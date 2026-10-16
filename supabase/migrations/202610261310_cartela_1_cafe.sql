-- Bingo: cartela passa a custar 1 cafezinho. Pote = 1 por cartela + 10 que a casa banca (senão o prêmio da linha zerava).
create or replace function public.bingo_rodar() returns void
language plpgsql security definer set search_path = public as $$
declare ini timestamptz; r bingo_rodadas; ep text; nj int; nc int; li int; ci int; lp int; kp int; nl int; nk int;
  w record; it text; itens jsonb;
begin
  for ini in select inicio from bingo_rodadas
    where (estado = 'aberta' and inicio <= now()) or (estado = 'jogando' and now() >= inicio + make_interval(secs => 8 + (cheia_idx - 1) * 3))
    order by inicio loop
    perform pg_advisory_xact_lock(hashtext('bingo:' || ini));
    select * into r from bingo_rodadas where inicio = ini;
    ep := extract(epoch from ini)::bigint::text;
    if r.estado = 'aberta' then
      select count(distinct user_id), count(*) into nj, nc from bingo_cartelas where rodada = ini;
      if nj < 2 then
        insert into coffee_log (user_id, amount, reason, ref)
          select user_id, 1, 'bingo', 'r:' || id from bingo_cartelas where rodada = ini and not gratis on conflict do nothing;
        update bingo_rodadas set estado = 'cancelada', jogadores = nj, cartelas = nc, pote = 0 where inicio = ini;
        continue;
      end if;
      update bingo_cartelas set (linha_idx, cheia_idx) = (select m.linha, m.cheia from bingo_marcas(numeros, r.bolas) m) where rodada = ini;
      select min(linha_idx), min(cheia_idx) into li, ci from bingo_cartelas where rodada = ini;
      lp := (nc + 10) * 3 / 10; kp := (nc + 10) - lp;
      select count(*) filter (where linha_idx = li), count(*) filter (where cheia_idx = ci) into nl, nk from bingo_cartelas where rodada = ini;
      update bingo_rodadas set estado = 'jogando', jogadores = nj, cartelas = nc, pote = nc + 10, linha_idx = li, cheia_idx = ci,
        linha_v = (select jsonb_agg(jsonb_build_object('u', user_id, 'n', n, 'premio', n * (lp / nl))) from
          (select user_id, count(*)::int n from bingo_cartelas where rodada = ini and linha_idx = li group by user_id) x),
        cheia_v = (select jsonb_agg(jsonb_build_object('u', user_id, 'n', n, 'premio', n * (kp / nk))) from
          (select user_id, count(*)::int n from bingo_cartelas where rodada = ini and cheia_idx = ci group by user_id) x)
      where inicio = ini;
      select * into r from bingo_rodadas where inicio = ini;
      if now() < ini + make_interval(secs => 8 + (r.cheia_idx - 1) * 3) then continue; end if;
    end if;
    if r.estado <> 'jogando' then continue; end if;
    for w in select (e->>'u')::uuid u, (e->>'premio')::int p from jsonb_array_elements(r.linha_v) e loop
      insert into coffee_log (user_id, amount, reason, ref) values (w.u, w.p, 'bingo', 'l:' || ep) on conflict do nothing;
    end loop;
    itens := '{}';
    for w in select (e->>'u')::uuid u, (e->>'premio')::int p from jsonb_array_elements(r.cheia_v) e loop
      insert into coffee_log (user_id, amount, reason, ref) values (w.u, w.p, 'bingo', 'k:' || ep) on conflict do nothing;
      insert into latinha_log (user_id, amount, reason, ref) values (w.u, 1, 'bingo', 'k:' || ep) on conflict do nothing;
      select x into it from unnest(array['roupa:paete', 'roupa:smoking', 'chapeu:cantor', 'rosto:oculos-estrela', 'animacao:confete', 'animacao:bolinhas']) x
        where not exists (select 1 from coffee_log where user_id = w.u and reason = 'compra' and ref = x) order by random() limit 1;
      if it is not null then
        insert into coffee_log (user_id, amount, reason, ref) values (w.u, 0, 'compra', it) on conflict do nothing;
        itens := itens || jsonb_build_object(w.u::text, it);
      end if;
    end loop;
    update bingo_rodadas set estado = 'paga', itens = bingo_rodar.itens where inicio = ini;
  end loop;
end $$;

create or replace function public.bingo_rodada_json(ini timestamptz, me uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r bingo_rodadas; n int := 0; vistas smallint[] := '{}'; nj int; nc int;
begin
  select * into r from bingo_rodadas where inicio = ini;
  if not found then return jsonb_build_object('inicio', ini, 'estado', 'aberta', 'pote', 0, 'cartelas', 0, 'jogadores', 0, 'bolas', '[]'::jsonb, 'minhas', '[]'::jsonb); end if;
  if r.estado in ('jogando', 'paga') then
    n := least(r.cheia_idx, greatest(0, floor(extract(epoch from now() - r.inicio - interval '5 seconds') / 3)::int + 1));
    vistas := r.bolas[1:n];
  end if;
  select count(distinct user_id), count(*) into nj, nc from bingo_cartelas where rodada = ini;
  return jsonb_build_object(
    'inicio', r.inicio, 'estado', r.estado, 'pote', case when r.estado = 'cancelada' then 0 else nc + 10 end, 'cartelas', nc, 'jogadores', nj,
    'bolas', to_jsonb(vistas),
    'linha', case when n >= r.linha_idx then r.linha_v end, 'linha_idx', case when n >= r.linha_idx then r.linha_idx end,
    'cheia', case when n >= r.cheia_idx then r.cheia_v end, 'cheia_idx', case when n >= r.cheia_idx then r.cheia_idx end,
    'itens', case when n >= coalesce(r.cheia_idx, 99) then r.itens else '{}'::jsonb end,
    'gente', (select coalesce(jsonb_agg(jsonb_build_object('u', user_id, 'n', k)), '[]') from (select user_id, count(*)::int k from bingo_cartelas where rodada = ini group by user_id) g),
    'minhas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'numeros', numeros, 'gratis', gratis) order by id), '[]') from bingo_cartelas where rodada = ini and user_id = me));
end $$;

create or replace function public.bingo_estado() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); atual timestamptz := to_timestamp(floor(extract(epoch from now()) / 900) * 900);
  hoje text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform public.bingo_rodar();
  return jsonb_build_object(
    'agora', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'atual', public.bingo_rodada_json(atual, me),
    'proxima', public.bingo_rodada_json(public.bingo_proxima(), me),
    'gratis', not exists (select 1 from coffee_log where user_id = me and reason = 'bingo' and ref = 'g:' || hoje),
    'latinhas', public.latinha_saldo(),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('inicio', inicio, 'pote', pote, 'jogadores', jogadores, 'cartelas', cartelas,
        'linha', linha_v, 'cheia', cheia_v, 'itens', itens, 'bolas', cheia_idx) order by inicio desc)
      from (select * from bingo_rodadas where estado = 'paga' order by inicio desc limit 8) h), '[]'));
end $$;

create or replace function public.bingo_comprar(gratis boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); prox timestamptz := public.bingo_proxima(); n int; bal int;
  hoje text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'); cid bigint;
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me));
  insert into bingo_rodadas (inicio, bolas) values (prox, (select array_agg(x::smallint order by random()) from generate_series(1, 75) x))
    on conflict do nothing;
  select count(*) into n from bingo_cartelas where rodada = prox and user_id = me;
  if n >= 4 then raise exception 'Máximo de 4 cartelas por rodada.'; end if;
  if gratis then
    if exists (select 1 from coffee_log where user_id = me and reason = 'bingo' and ref = 'g:' || hoje) then
      raise exception 'A cartela grátis de hoje já foi. Volta amanhã!';
    end if;
    insert into bingo_cartelas (rodada, user_id, numeros, gratis) values (prox, me, public.bingo_nova_cartela(), true);
    insert into coffee_log (user_id, amount, reason, ref) values (me, 0, 'bingo', 'g:' || hoje);
  else
    select coalesce(sum(amount), 0) into bal from coffee_log where user_id = me;
    if bal < 1 then raise exception 'Falta 1 cafezinho para uma cartela.'; end if;
    insert into bingo_cartelas (rodada, user_id, numeros) values (prox, me, public.bingo_nova_cartela()) returning id into cid;
    insert into coffee_log (user_id, amount, reason, ref) values (me, -1, 'bingo', 'c:' || cid);
  end if;
  return public.bingo_estado();
end $$;
revoke all on function public.bingo_proxima(), public.bingo_nova_cartela(), public.bingo_marcas(smallint[], smallint[]), public.bingo_rodar(),
  public.bingo_rodada_json(timestamptz, uuid), public.bingo_estado(), public.bingo_comprar(boolean) from public, anon;
grant execute on function public.bingo_estado(), public.bingo_comprar(boolean) to authenticated;
