-- calendário não gera sozinho: cada vaga nasce em 'espera' (falta fotos e assunto) e só vai pra fila quando liberada
alter table public.estudio_pedidos drop constraint if exists estudio_pedidos_estado_check;
alter table public.estudio_pedidos add constraint estudio_pedidos_estado_check check (estado in ('espera', 'fila', 'gerando', 'pronto', 'erro', 'pulado'));
update public.estudio_pedidos set estado = 'espera', gerar_em = null where origem = 'calendario' and estado = 'fila';

-- a vaga liberada ganha a hora de gerar (antecedência), ou já, se estiver perto
create or replace function public.estudio_pedido_liberar() returns trigger
language plpgsql security definer set search_path = public as $$
declare a int;
begin
  if old.estado = 'espera' and new.estado = 'fila' and new.canal is not null then
    select antecedencia into a from estudio_canais where id = new.canal;
    new.gerar_em := greatest(now(), new.quando - make_interval(days => coalesce(a, 0)));
  end if;
  return new;
end $$;
drop trigger if exists estudio_pedido_liberar on public.estudio_pedidos;
create trigger estudio_pedido_liberar before update on public.estudio_pedidos for each row execute function public.estudio_pedido_liberar();

-- preenche o calendário dos canais ativos (idempotente; o trabalhador chama de tempos em tempos)
create or replace function public.estudio_planejar(frente int default 35) returns int
language plpgsql security definer set search_path = public as $$
declare c estudio_canais; d date; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  q timestamptz; seq text[]; pil text; temas jsonb; k int; kp int; n int := 0;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm planeja.'; end if;
  -- o que ainda não começou e não bate mais com o canal (dia/hora mudou, canal desligado) sai do calendário
  delete from estudio_pedidos p using estudio_canais ch
  where p.canal = ch.id and p.origem = 'calendario' and p.estado = 'espera'
    and (not ch.ativo or ch.molde is null
      or not (extract(dow from p.quando at time zone 'America/Sao_Paulo')::int = any (ch.dias))
      or (p.quando at time zone 'America/Sao_Paulo')::time <> ch.hora);
  for c in select * from estudio_canais where ativo and molde is not null and cardinality(dias) > 0 loop
    seq := case when cardinality(c.sequencia) > 0 then c.sequencia
                else array(select x->>'id' from jsonb_array_elements(c.pilares) x) end;
    for d in select g::date from generate_series(hoje + 1, hoje + frente, interval '1 day') g loop
      continue when not (extract(dow from d)::int = any (c.dias));
      q := (d + c.hora) at time zone 'America/Sao_Paulo';
      continue when exists (select 1 from estudio_pedidos where canal = c.id and origem = 'calendario' and quando = q);
      select count(*) into k from estudio_pedidos where canal = c.id and origem = 'calendario';
      pil := case when cardinality(seq) > 0 then seq[k % cardinality(seq) + 1] end;
      temas := null;
      select coalesce(x->'temas', '[]') into temas from jsonb_array_elements(c.pilares) x where x->>'id' = pil;
      select count(*) into kp from estudio_pedidos where canal = c.id and origem = 'calendario' and pilar = pil;
      insert into estudio_pedidos (canal, origem, estado, pilar, quando, texto)
      values (c.id, 'calendario', 'espera', pil, q,
        coalesce(case when jsonb_array_length(coalesce(temas, '[]')) > 0 then temas->>(kp % jsonb_array_length(temas)) end,
                 'Tema livre do canal: o Estúdio escolhe'));
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
