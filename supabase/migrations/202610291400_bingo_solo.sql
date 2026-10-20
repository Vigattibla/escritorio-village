-- Bingo funciona com uma pessoa. Sem cartelas, cancela; premios e regras existentes preservados.
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
      if nj < 1 then
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
