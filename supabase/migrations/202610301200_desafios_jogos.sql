-- Desafios diários: uma conclusão elegível por jogo, máximo total de 60 ☕/dia.
alter table public.coffee_log drop constraint if exists coffee_log_reason_check;
alter table public.coffee_log add constraint coffee_log_reason_check
  check (reason in ('dia','boasvindas','fase','meta','compra','aposta','premio','bilhete','bolao','troca','bingo','poder','coringa','mesada','casa','torneio','presente','desafio'));

create or replace function public.jogos_desafio_creditar(me uuid, p_jogo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare dia text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'); premio int; total int; recebido int := 0; ref_id text;
begin
  if me is null or p_jogo not in ('cobrinha','penalti','memoria','reflexo','sinuca','cartas','baralho') then
    raise exception 'Desafio de jogo inválido.';
  end if;
  perform pg_advisory_xact_lock(hashtext('desafios-jogos:' || me::text || ':' || dia));
  premio := case when p_jogo in ('cobrinha','penalti','memoria','reflexo') then 6 else 12 end;
  ref_id := dia || ':' || p_jogo;
  select coalesce(sum(amount), 0)::int into total from public.coffee_log where user_id = me and reason = 'desafio' and split_part(ref, ':', 1) = dia;
  if total < 60 and not exists (select 1 from public.coffee_log where user_id = me and reason = 'desafio' and ref = ref_id) then
    recebido := least(premio, 60 - total);
    insert into public.coffee_log (user_id, amount, reason, ref) values (me, recebido, 'desafio', ref_id) on conflict do nothing;
    if not found then recebido := 0; end if;
    total := total + recebido;
  end if;
  return jsonb_build_object('jogo',p_jogo,'dia',dia,'recebido',recebido,'total',total,'limite',60);
end $$;
revoke all on function public.jogos_desafio_creditar(uuid,text) from public, anon, authenticated;
grant execute on function public.jogos_desafio_creditar(uuid,text) to service_role;

-- Rodadas clássicas só chegam aqui ao concluir por funções que validam o servidor.
create or replace function public.jogos_desafio_partida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.fim is null and new.fim is not null and new.pontos > 0 then
    perform public.jogos_desafio_creditar(new.user_id,new.jogo);
  end if;
  return new;
end $$;
revoke all on function public.jogos_desafio_partida() from public, anon, authenticated;
drop trigger if exists jogos_desafio_partida on public.jogos_partidas;
create trigger jogos_desafio_partida after update of fim on public.jogos_partidas
for each row execute function public.jogos_desafio_partida();

-- Partida online paga ao vencedor depois do fechamento por vitória; abandono não conta.
create or replace function public.mesas_online_desafio() returns trigger
language plpgsql security definer set search_path = public as $$
declare c jsonb := coalesce(new.dados->'cartas', new.dados->'sinuca');
begin
  if old.estado = 'jogando' and new.estado = 'fim' and c->>'vencedor' is not null and coalesce(c->>'aviso','') not ilike '%saiu da partida%' then
    if c->>'vencedor' = '0' then perform public.jogos_desafio_creditar(new.dono,new.jogo);
    elsif c->>'vencedor' = '1' then perform public.jogos_desafio_creditar(new.convidado,new.jogo);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.mesas_online_desafio() from public, anon, authenticated;
drop trigger if exists mesas_online_desafio on public.mesas_online;
create trigger mesas_online_desafio after update of estado on public.mesas_online
for each row execute function public.mesas_online_desafio();
