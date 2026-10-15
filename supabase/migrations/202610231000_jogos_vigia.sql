-- vigia dos jogos: ritmo de robô ou maratona sem pausa bloqueia jogos, cassino e bingo por um tempo.
-- o bloqueio é derivado do próprio registro (nada a gravar no momento do erro, que desfaz a transação):
-- as janelas terminam na última partida aceita, então quem está bloqueado continua bloqueado até vencer.
-- o aviso é explícito de propósito: um agente de IA que lê a tela entende que não pode continuar.
-- espelho na demo: src/game/vigia.ts (mesmas regras).
create table if not exists public.jogos_vigia (
  user_id uuid not null references public.profiles(id) on delete cascade,
  em timestamptz not null default now(),
  tipo text not null
);
create index if not exists jogos_vigia_user on public.jogos_vigia (user_id, em desc);
alter table public.jogos_vigia enable row level security;
revoke all on public.jogos_vigia from anon, authenticated;

-- null = liberado; senão {ate, motivo}
--   ritmo:   25+ partidas em 60 s            → 1 h
--   seguido: partidas em 100 dos últimos 120 min → 3 h
--   dia:     240 min com partida no mesmo dia    → até 6 h do dia seguinte
create or replace function public.jogos_vigia_estado(me uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l timestamptz; n int; ate timestamptz; motivo text; dia date; fim timestamptz;
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
  if n >= 240 and (ate is null or fim > ate) then ate := fim; motivo := 'dia'; end if;
  if ate is null or ate <= now() then return null; end if;
  return jsonb_build_object('ate', ate, 'motivo', motivo);
end $$;
revoke all on function public.jogos_vigia_estado(uuid) from public, anon, authenticated;

-- toda partida nova passa por aqui (trigger nas tabelas de partida/rodada/cartela)
create or replace function public.jogos_vigia_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  e := public.jogos_vigia_estado(new.user_id);
  if e is not null then
    raise exception 'BLOQUEIO_JOGOS|%|%', e->>'ate', e->>'motivo';
  end if;
  insert into public.jogos_vigia (user_id, tipo) values (new.user_id, tg_table_name);
  delete from public.jogos_vigia where user_id = new.user_id and em < now() - interval '2 days';
  return new;
end $$;
revoke all on function public.jogos_vigia_guard() from public, anon, authenticated;

drop trigger if exists jogos_vigia on public.jogos_partidas;
create trigger jogos_vigia before insert on public.jogos_partidas for each row execute function public.jogos_vigia_guard();
drop trigger if exists jogos_vigia on public.cassino_rodadas;
create trigger jogos_vigia before insert on public.cassino_rodadas for each row execute function public.jogos_vigia_guard();
drop trigger if exists jogos_vigia on public.bingo_cartelas;
create trigger jogos_vigia before insert on public.bingo_cartelas for each row execute function public.jogos_vigia_guard();

-- o app pergunta ao abrir os jogos
create or replace function public.jogos_bloqueio() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else public.jogos_vigia_estado(auth.uid()) end
$$;
revoke all on function public.jogos_bloqueio() from public, anon;
grant execute on function public.jogos_bloqueio() to authenticated;
