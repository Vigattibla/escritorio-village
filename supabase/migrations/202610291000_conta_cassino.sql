-- Conta do cassino: a pessoa que só joga e cuida do cassino. Tudo com teto, porque quem paga é o servidor.
--   marca: profiles.cassino (só o adm liga/desliga; no máximo uma conta assim)
--   mesada: +20 ☕ por dia ('mesada'), fora de ranking e do sorteio de poderes
--   imposto: o gerente escolhe de 0 a 15% (começa em 10%, muda 1x por dia) sobre toda aposta PERDIDA por outra pessoa
--            nos 5 jogos do cassino ('casa'); sai do que a casa já ficaria, o jogador não paga a mais; teto de 50 ☕ por dia
--   vigia: só o limite do dia sobe (240 → 480 min); ritmo de robô e maratona continuam iguais
--   torneio: maior lucro num jogo (ou em todos) por 1 a 12 h; prêmio de 10 a 100 ☕ sai do bolso dele na hora;
--            1 aberto por vez, 3 por semana; ele não concorre; menos de 2 jogadores com lucro → devolve; só o adm cancela
-- espelho na demo: src/data/demo.ts (casa/torneio) e src/game/vigia.ts

alter table public.coffee_log drop constraint if exists coffee_log_reason_check;
alter table public.coffee_log add constraint coffee_log_reason_check
  check (reason in ('dia', 'boasvindas', 'fase', 'meta', 'compra', 'aposta', 'premio', 'bilhete', 'bolao', 'troca', 'bingo', 'poder', 'coringa',
    'mesada', 'casa', 'torneio'));

alter table public.profiles add column if not exists cassino boolean not null default false;
create unique index if not exists profiles_um_cassino on public.profiles ((cassino)) where cassino;

-- a marca só muda pela função do adm
create or replace function public.cassino_guard_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('ev.cassino_op', true) = '1' or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.cassino := false; return new; end if;
  new.cassino := old.cassino;
  return new;
end $$;
drop trigger if exists cassino_guard_perfil on public.profiles;
create trigger cassino_guard_perfil before insert or update on public.profiles for each row execute function public.cassino_guard_perfil();

create or replace function public.admin_set_cassino(target uuid, sim boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm marca a conta do cassino.'; end if;
  if sim and public.is_admin(target) then raise exception 'Conta de adm não pode ser a conta do cassino.'; end if;
  if sim and exists (select 1 from profiles where cassino and id <> target) then raise exception 'Já existe uma conta do cassino. Desmarque a outra primeiro.'; end if;
  perform set_config('ev.cassino_op', '1', true);
  update profiles set cassino = sim where id = target;
end $$;
revoke all on function public.admin_set_cassino(uuid, boolean) from public, anon;
grant execute on function public.admin_set_cassino(uuid, boolean) to authenticated;

create or replace function public.e_cassino(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select cassino from profiles where id = u), false)
$$;
revoke all on function public.e_cassino(uuid) from public, anon, authenticated;

-- ---------- comissão da casa ----------
create table if not exists public.cassino_casa (
  dia date primary key,
  gerente uuid not null references public.profiles(id) on delete cascade,
  perdido int not null default 0,  -- soma das apostas perdidas pelos outros no dia
  pago int not null default 0      -- comissão já creditada (≤ 50)
);
alter table public.cassino_casa add column if not exists devido int not null default 0; -- em centésimos: aposta × taxa da hora

-- imposto escolhido pelo gerente (uma linha só)
create table if not exists public.cassino_config (
  id boolean primary key default true check (id),
  taxa int not null default 10 check (taxa between 0 and 15),
  mudou date
);
insert into public.cassino_config (id) values (true) on conflict do nothing;
alter table public.cassino_config enable row level security;
revoke all on public.cassino_config from anon, authenticated;

create or replace function public.cassino_taxa(p_taxa int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); hoje date := (now() at time zone 'America/Sao_Paulo')::date; c cassino_config;
begin
  if not public.e_cassino(me) then raise exception 'Só a conta do cassino muda o imposto.'; end if;
  if p_taxa is null or p_taxa < 0 or p_taxa > 15 then raise exception 'O imposto vai de 0 a 15 por cento.'; end if;
  select * into c from cassino_config for update;
  if c.taxa = p_taxa then return; end if;
  if c.mudou = hoje then raise exception 'O imposto só muda uma vez por dia. Amanhã dá pra trocar de novo.'; end if;
  update cassino_config set taxa = p_taxa, mudou = hoje;
  insert into messages (id, channel, sender_id, body) values (gen_random_uuid(), 'geral', me,
    '🎰 Imposto do cassino agora é ' || p_taxa || '% das apostas perdidas.');
end $$;
revoke all on function public.cassino_taxa(int) from public, anon;
grant execute on function public.cassino_taxa(int) to authenticated;
alter table public.cassino_casa enable row level security;
revoke all on public.cassino_casa from anon, authenticated;

create or replace function public.cassino_comissao(perdedor uuid, valor int) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid; hoje date := (now() at time zone 'America/Sao_Paulo')::date; c cassino_casa; dev int;
  tx int := coalesce((select taxa from cassino_config), 10);
begin
  select id into g from profiles where cassino limit 1;
  if g is null or g = perdedor or valor < 1 then return; end if;
  insert into cassino_casa (dia, gerente, perdido, devido) values (hoje, g, valor, valor * tx)
    on conflict (dia) do update set perdido = cassino_casa.perdido + valor, devido = cassino_casa.devido + valor * tx
    returning * into c;
  dev := least(50, c.devido / 100) - c.pago;
  if dev < 1 then return; end if;
  update cassino_casa set pago = pago + dev where dia = hoje;
  insert into coffee_log (user_id, amount, reason, ref) values (g, dev, 'casa', to_char(hoje, 'YYYY-MM-DD') || ':' || (c.pago + dev));
end $$;
revoke all on function public.cassino_comissao(uuid, int) from public, anon, authenticated;

-- fechar a rodada: igual a antes + comissão quando a pessoa perde tudo
create or replace function public.cassino_fecha(rid uuid, valor int, res jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid; ap int; dob boolean;
begin
  update public.cassino_rodadas set aberta = false, premio = valor, resultado = resultado || coalesce(res, '{}'), fim = now()
    where id = rid returning user_id, aposta, dobrou into me, ap, dob;
  if valor > 0 then
    insert into public.coffee_log (user_id, amount, reason, ref) values (me, valor, 'premio', rid::text) on conflict do nothing;
  else
    perform public.cassino_comissao(me, ap * (case when dob then 2 else 1 end));
  end if;
end $$;

-- ---------- mesada (chamada junto com o claim do dia) ----------
create or replace function public.cassino_mesada() returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.e_cassino(me) then return 0; end if;
  insert into coffee_log (user_id, amount, reason, ref)
    values (me, 20, 'mesada', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')) on conflict do nothing;
  return case when found then 20 else 0 end;
end $$;
revoke all on function public.cassino_mesada() from public, anon;
grant execute on function public.cassino_mesada() to authenticated;

-- ---------- vigia: limite do dia maior só pra conta do cassino ----------
create or replace function public.jogos_vigia_estado(me uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l timestamptz; n int; ate timestamptz; motivo text; dia date; fim timestamptz; teto int;
begin
  select max(em) into l from public.jogos_vigia where user_id = me;
  if l is null then return null; end if;
  select count(*) into n from public.jogos_vigia where user_id = me and em > l - interval '60 seconds';
  if n >= 25 then ate := l + interval '1 hour'; motivo := 'ritmo'; end if;
  select count(distinct date_trunc('minute', em)) into n from public.jogos_vigia where user_id = me and em > l - interval '120 minutes';
  if n >= 100 and (ate is null or l + interval '3 hours' > ate) then ate := l + interval '3 hours'; motivo := 'seguido'; end if;
  dia := (l at time zone 'America/Sao_Paulo')::date;
  select count(distinct date_trunc('minute', em)) into n from public.jogos_vigia
    where user_id = me and (em at time zone 'America/Sao_Paulo')::date = dia;
  fim := ((dia + 1)::timestamp + interval '6 hours') at time zone 'America/Sao_Paulo';
  teto := case when public.e_cassino(me) then 480 else 240 end;
  if n >= teto and (ate is null or fim > ate) then ate := fim; motivo := 'dia'; end if;
  if ate is null or ate <= now() then return null; end if;
  return jsonb_build_object('ate', ate, 'motivo', motivo);
end $$;
revoke all on function public.jogos_vigia_estado(uuid) from public, anon, authenticated;

-- ---------- poderes: a conta do cassino fica fora do sorteio ----------
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
    where p.avatar is not null and not p.cassino
    order by power(random(), 1.0 / (1 + coalesce(c.pts, 0))) desc
    limit 3
  loop
    t := tipos[1 + floor(random() * array_length(tipos, 1))::int];
    tipos := array_remove(tipos, t);
    perform public.poder_dar(w.id, t, 'sorteio', s, public.poder_horas(t));
  end loop;
end $$;

-- ---------- torneios ----------
create table if not exists public.cassino_torneios (
  id uuid primary key default gen_random_uuid(),
  criado_por uuid not null references public.profiles(id) on delete cascade,
  jogo text not null check (jogo in ('todos', 'caca', 'roleta', 'crash', 'blackjack', 'minas')),
  premio int not null check (premio between 10 and 100),
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  estado text not null default 'aberto' check (estado in ('aberto', 'pago', 'devolvido', 'cancelado')),
  vencedor uuid references public.profiles(id) on delete set null,
  lucro int,
  cancelado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists cassino_um_torneio on public.cassino_torneios ((true)) where estado = 'aberto';
create index if not exists cassino_torneios_fim on public.cassino_torneios (fim desc);
alter table public.cassino_torneios enable row level security;
drop policy if exists "torneios: todo mundo vê" on public.cassino_torneios;
create policy "torneios: todo mundo vê" on public.cassino_torneios for select to authenticated using (true);
revoke insert, update, delete on public.cassino_torneios from anon, authenticated;
grant select on public.cassino_torneios to authenticated;

-- placar: lucro líquido das rodadas fechadas no período (a conta do cassino não entra)
create or replace function public.cassino_torneio_placar(t cassino_torneios) returns table (u uuid, lucro int, rodadas int)
language sql stable security definer set search_path = public as $$
  select r.user_id, (sum(r.premio) - sum(r.aposta * (case when r.dobrou then 2 else 1 end)))::int, count(*)::int
  from cassino_rodadas r join profiles p on p.id = r.user_id
  where not r.aberta and r.fim >= t.inicio and r.fim < t.fim and (t.jogo = 'todos' or r.jogo = t.jogo) and not p.cassino
  group by r.user_id
  order by 2 desc, 3 asc
$$;
revoke all on function public.cassino_torneio_placar(cassino_torneios) from public, anon, authenticated;

create or replace function public.cassino_torneio_fechar() returns void
language plpgsql security definer set search_path = public as $$
declare t cassino_torneios; w record; n int;
begin
  for t in select * from cassino_torneios where estado = 'aberto' and fim <= now() for update skip locked loop
    select count(*) into n from public.cassino_torneio_placar(t) x where x.lucro > 0;
    select * into w from public.cassino_torneio_placar(t) x limit 1;
    if n >= 2 then
      update cassino_torneios set estado = 'pago', vencedor = w.u, lucro = w.lucro where id = t.id;
      insert into coffee_log (user_id, amount, reason, ref) values (w.u, t.premio, 'torneio', 'v:' || t.id) on conflict do nothing;
      insert into messages (id, channel, sender_id, body) values (gen_random_uuid(), 'geral', t.criado_por,
        '🏆 ' || (select name from profiles where id = w.u) || ' venceu o torneio do cassino com +' || w.lucro || ' de lucro e levou ' || t.premio || ' ☕.');
    else
      update cassino_torneios set estado = 'devolvido' where id = t.id;
      insert into coffee_log (user_id, amount, reason, ref) values (t.criado_por, t.premio, 'torneio', 'd:' || t.id) on conflict do nothing;
    end if;
  end loop;
end $$;
revoke all on function public.cassino_torneio_fechar() from public, anon, authenticated;

create or replace function public.cassino_torneio_criar(p_jogo text, p_premio int, p_horas int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bal int; tid uuid := gen_random_uuid(); nome text;
begin
  if not public.e_cassino(me) then raise exception 'Só a conta do cassino cria torneio.'; end if;
  if p_jogo not in ('todos', 'caca', 'roleta', 'crash', 'blackjack', 'minas') then raise exception 'Jogo inválido.'; end if;
  if p_premio is null or p_premio < 10 or p_premio > 100 then raise exception 'O prêmio vai de 10 a 100 cafezinhos.'; end if;
  if p_horas is null or p_horas < 1 or p_horas > 12 then raise exception 'O torneio dura de 1 a 12 horas.'; end if;
  perform pg_advisory_xact_lock(hashtext('torneio'));
  perform public.cassino_torneio_fechar();
  if exists (select 1 from cassino_torneios where estado = 'aberto') then raise exception 'Já tem um torneio rolando. Espere ele acabar.'; end if;
  if (select count(*) from cassino_torneios where criado_por = me and estado <> 'cancelado' and created_at > now() - interval '7 days') >= 3 then
    raise exception 'Limite de 3 torneios por semana.'; end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  select coalesce(sum(amount), 0) into bal from coffee_log where user_id = me;
  if bal < p_premio then raise exception 'O prêmio sai do seu saldo: faltam % cafezinhos.', p_premio - bal; end if;
  insert into cassino_torneios (id, criado_por, jogo, premio, fim) values (tid, me, p_jogo, p_premio, now() + make_interval(hours => p_horas));
  insert into coffee_log (user_id, amount, reason, ref) values (me, -p_premio, 'torneio', 'p:' || tid);
  nome := case p_jogo when 'todos' then 'todos os jogos' when 'caca' then 'Caça-níquel' when 'roleta' then 'Roleta'
    when 'crash' then 'Crash' when 'blackjack' then 'Blackjack' else 'Minas' end;
  insert into messages (id, channel, sender_id, body) values (gen_random_uuid(), 'geral', me,
    '🎰 Torneio no cassino: maior lucro em ' || nome || ' até ' || to_char((now() + make_interval(hours => p_horas)) at time zone 'America/Sao_Paulo', 'HH24"h"MI')
    || ' leva ' || p_premio || ' ☕.');
end $$;
revoke all on function public.cassino_torneio_criar(text, int, int) from public, anon;
grant execute on function public.cassino_torneio_criar(text, int, int) to authenticated;

-- só o adm cancela (o prêmio volta pra conta do cassino)
create or replace function public.cassino_torneio_cancelar(tid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t cassino_torneios;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm cancela torneio.'; end if;
  select * into t from cassino_torneios where id = tid and estado = 'aberto' for update;
  if t.id is null then raise exception 'Esse torneio já acabou.'; end if;
  update cassino_torneios set estado = 'cancelado', cancelado_por = auth.uid() where id = tid;
  insert into coffee_log (user_id, amount, reason, ref) values (t.criado_por, t.premio, 'torneio', 'd:' || t.id) on conflict do nothing;
end $$;
revoke all on function public.cassino_torneio_cancelar(uuid) from public, anon;
grant execute on function public.cassino_torneio_cancelar(uuid) to authenticated;

-- painel: torneio aberto + placar + imposto pra todo mundo; números da casa só pra conta do cassino e o adm
create or replace function public.cassino_painel() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t cassino_torneios; hoje date := (now() at time zone 'America/Sao_Paulo')::date; c cassino_casa; casa jsonb;
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform public.cassino_torneio_fechar();
  select * into t from cassino_torneios where estado = 'aberto' limit 1;
  if public.e_cassino(me) or public.is_admin(me) then
    select * into c from cassino_casa where dia = hoje;
    casa := jsonb_build_object('perdido', coalesce(c.perdido, 0), 'pago', coalesce(c.pago, 0), 'teto', 50, 'mesada', 20,
      'podeMudar', coalesce((select mudou from cassino_config), hoje - 1) < hoje,
      'semana', (select count(*) from cassino_torneios where criado_por = (select id from profiles where cassino limit 1)
        and estado <> 'cancelado' and created_at > now() - interval '7 days'),
      'mesAberto', (select coalesce(sum(amount), 0) from coffee_log where reason = 'casa' and created_at > now() - interval '30 days'));
  end if;
  return jsonb_build_object(
    'torneio', case when t.id is null then null else to_jsonb(t) || jsonb_build_object('placar',
      coalesce((select jsonb_agg(jsonb_build_object('u', x.u, 'lucro', x.lucro, 'rodadas', x.rodadas)) from (select * from public.cassino_torneio_placar(t) limit 5) x), '[]')) end,
    'historico', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from (select * from cassino_torneios where estado <> 'aberto' order by created_at desc limit 8) h), '[]'),
    'taxa', coalesce((select taxa from cassino_config), 10),
    'casa', casa);
end $$;
revoke all on function public.cassino_painel() from public, anon;
grant execute on function public.cassino_painel() to authenticated;
