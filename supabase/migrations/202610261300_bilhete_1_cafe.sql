-- Bolão: bilhete comprado passa a custar 1 cafezinho. O pote soma o que foi pago de fato (bilhetes antigos valiam 15).
create or replace function public.bolao_pote(f timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select 30
    + greatest(0, -coalesce((select sum(amount) from public.coffee_log
        where reason in ('aposta', 'premio') and created_at >= f - interval '7 days' and created_at < f), 0))::int
    + (-coalesce((select sum(amount) from public.coffee_log where reason = 'bilhete' and created_at >= f - interval '7 days' and created_at < f), 0))::int
    + coalesce((select s.pote from public.bolao_sorteios s where s.fim = f - interval '7 days' and s.vencedor is null), 0)
$$;

create or replace function public.bolao_comprar() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f timestamptz := public.bolao_fim(now()); n int; bal int;
begin
  if me is null then raise exception 'Entre de novo.'; end if;
  perform pg_advisory_xact_lock(hashtext('bilhete:' || me));
  select count(*) into n from public.coffee_log where user_id = me and reason = 'bilhete' and created_at >= f - interval '7 days';
  if n >= 5 then raise exception 'Limite de 5 bilhetes comprados por semana. Bater meta dá bilhete grátis!'; end if;
  select coalesce(sum(amount), 0) into bal from public.coffee_log where user_id = me;
  if bal < 1 then raise exception 'Falta 1 cafezinho para um bilhete.'; end if;
  insert into public.coffee_log (user_id, amount, reason, ref) values (me, -1, 'bilhete', to_char(f, 'YYYY-MM-DD') || ':' || (n + 1));
  return public.bolao_estado();
end $$;

revoke all on function public.bolao_pote(timestamptz), public.bolao_comprar() from public, anon;
