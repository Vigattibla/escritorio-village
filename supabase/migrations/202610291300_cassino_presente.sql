-- presente do gerente do cassino: dá cafezinho (1 a 30) ou um item do Almoxarifado pra alguém, do próprio saldo
--   teto: 3 presentes e 90 ☕ por dia; não dá pra si mesmo; o aviso sai no canal geral
--   cafezinho: -X pra ele ('presente', 'p:<id>') e +X pra pessoa ('presente', 'r:<id>')
--   item: -preço pra ele e a pessoa ganha o item ('compra' com 0, igual prêmio do bolão)
-- espelho na demo: src/data/demo.ts (cassinoPresente)

alter table public.coffee_log drop constraint if exists coffee_log_reason_check;
alter table public.coffee_log add constraint coffee_log_reason_check
  check (reason in ('dia', 'boasvindas', 'fase', 'meta', 'compra', 'aposta', 'premio', 'bilhete', 'bolao', 'troca', 'bingo', 'poder', 'coringa',
    'mesada', 'casa', 'torneio', 'presente'));

create or replace function public.cassino_presente(p_para uuid, p_valor int, p_item text, p_rotulo text, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bal int; v int; n int; dado int; nome text; it text; pid uuid := gen_random_uuid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date; nota text := left(trim(coalesce(p_nota, '')), 80);
begin
  if not public.e_cassino(me) then raise exception 'Só o gerente do cassino dá presente.'; end if;
  if p_para is null or p_para = me then raise exception 'Escolha outra pessoa.'; end if;
  select name into nome from profiles where id = p_para and not cassino;
  if nome is null then raise exception 'Essa pessoa não está no escritório.'; end if;
  if p_item is not null then
    select price into v from shop_items where id = p_item;
    if v is null then raise exception 'Esse item não está no Almoxarifado.'; end if;
    it := coalesce(nullif(left(trim(coalesce(p_rotulo, '')), 40), ''), 'um item do Almoxarifado');
    if exists (select 1 from coffee_log where user_id = p_para and reason = 'compra' and ref = p_item) then raise exception '% já tem esse item.', nome; end if;
  else
    if p_valor is null or p_valor < 1 or p_valor > 30 then raise exception 'O presente vai de 1 a 30 cafezinhos.'; end if;
    v := p_valor;
  end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  select count(*), coalesce(-sum(amount), 0) into n, dado from coffee_log
    where user_id = me and reason = 'presente' and (created_at at time zone 'America/Sao_Paulo')::date = hoje;
  if n >= 3 then raise exception 'Já foram 3 presentes hoje. Amanhã tem mais.'; end if;
  if dado + v > 90 then raise exception 'O teto é 90 cafezinhos de presente por dia: sobram % hoje.', greatest(0, 90 - dado); end if;
  select coalesce(sum(amount), 0) into bal from coffee_log where user_id = me;
  if bal < v then raise exception 'O presente sai do seu saldo: faltam % cafezinhos.', v - bal; end if;
  insert into coffee_log (user_id, amount, reason, ref) values (me, -v, 'presente', 'p:' || pid || ':' || p_para);
  if p_item is not null then
    insert into coffee_log (user_id, amount, reason, ref) values (p_para, 0, 'compra', p_item);
  else
    insert into coffee_log (user_id, amount, reason, ref) values (p_para, v, 'presente', 'r:' || pid);
  end if;
  insert into messages (id, channel, sender_id, body) values (gen_random_uuid(), 'geral', me,
    '🎁 Presente do cassino pra ' || nome || ': ' || coalesce(it, v || ' ☕') || case when nota <> '' then ' — “' || nota || '”' else '' end);
end $$;
revoke all on function public.cassino_presente(uuid, int, text, text, text) from public, anon;
grant execute on function public.cassino_presente(uuid, int, text, text, text) to authenticated;
