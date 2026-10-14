-- Canais do Estúdio: cada rede/marca tem molde, ritmo e pilares; o Estúdio segue o calendário sozinho
-- e a coordenação só encaixa publicações no meio (vira item agendado, gerado na hora certa).

create table if not exists public.estudio_canais (
  id text primary key,
  nome text not null,
  rede text not null default 'linkedin',
  molde text,                                   -- sem molde = ainda não gera
  ativo boolean not null default false,
  dias int[] not null default '{}',             -- dia da semana (0 = domingo)
  hora time not null default '10:00',
  antecedencia int not null default 3 check (antecedencia between 0 and 30),
  pilares jsonb not null default '[]',          -- [{ id, nome, temas: [] }]
  sequencia text[] not null default '{}',       -- ordem dos pilares no calendário (vazia = ordem de pilares)
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.estudio_canais enable row level security;
drop policy if exists "canais: ver" on public.estudio_canais;
create policy "canais: ver" on public.estudio_canais for select to authenticated using (true);
drop policy if exists "canais: adm" on public.estudio_canais;
create policy "canais: adm" on public.estudio_canais for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

alter table public.estudio_pedidos add column if not exists canal text references public.estudio_canais(id) on delete set null;
alter table public.estudio_pedidos add column if not exists origem text not null default 'avulso';
alter table public.estudio_pedidos add column if not exists gerar_em timestamptz;
alter table public.estudio_pedidos drop constraint if exists estudio_pedidos_origem_check;
alter table public.estudio_pedidos add constraint estudio_pedidos_origem_check check (origem in ('avulso', 'calendario', 'extra'));
alter table public.estudio_pedidos drop constraint if exists estudio_pedidos_estado_check;
alter table public.estudio_pedidos add constraint estudio_pedidos_estado_check check (estado in ('fila', 'gerando', 'pronto', 'erro', 'pulado'));
create unique index if not exists estudio_pedidos_vaga on public.estudio_pedidos (canal, quando) where origem = 'calendario';
create index if not exists estudio_pedidos_canal on public.estudio_pedidos (canal, quando);

-- pedido de canal herda o molde e ganha a hora de gerar (antecedência antes de publicar)
create or replace function public.estudio_pedido_canal() returns trigger
language plpgsql security definer set search_path = public as $$
declare c estudio_canais;
begin
  if new.canal is null then return new; end if;
  select * into c from estudio_canais where id = new.canal;
  if c.molde is null then raise exception 'Esse canal ainda não tem molde.'; end if;
  if new.quando is null then raise exception 'Escolha o dia de publicar.'; end if;
  new.molde := c.molde;
  new.gerar_em := coalesce(new.gerar_em, greatest(now(), new.quando - make_interval(days => c.antecedencia)));
  return new;
end $$;
drop trigger if exists estudio_pedido_canal on public.estudio_pedidos;
create trigger estudio_pedido_canal before insert on public.estudio_pedidos for each row execute function public.estudio_pedido_canal();

-- coordenação não pede solto: só encaixa publicação no meio de um canal
drop policy if exists "estudio: pedir" on public.estudio_pedidos;
create policy "estudio: pedir" on public.estudio_pedidos for insert to authenticated
  with check (criado_por = auth.uid() and estado = 'fila' and (public.is_admin(auth.uid())
    or (public.rank_of(auth.uid()) >= 2 and canal is not null and origem = 'extra')));

-- fila respeita a hora de gerar
create or replace function public.estudio_pegar() returns setof public.estudio_pedidos
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o Estúdio pega pedidos.'; end if;
  update estudio_pedidos set estado = 'fila', passo = null where estado = 'gerando' and atualizado_em < now() - interval '30 minutes';
  return query
    update estudio_pedidos set estado = 'gerando', passo = 'Começando', atualizado_em = now()
    where id = (select id from estudio_pedidos where estado = 'fila' and coalesce(gerar_em, criado_em) <= now()
                order by coalesce(gerar_em, criado_em) limit 1 for update skip locked)
    returning *;
end $$;

-- preenche o calendário dos canais ativos (idempotente; o trabalhador chama de tempos em tempos)
create or replace function public.estudio_planejar(frente int default 35) returns int
language plpgsql security definer set search_path = public as $$
declare c estudio_canais; d date; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  q timestamptz; seq text[]; pil text; temas jsonb; k int; kp int; n int := 0;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Só o adm planeja.'; end if;
  -- o que ainda não começou e não bate mais com o canal (dia/hora mudou, canal desligado) sai do calendário
  delete from estudio_pedidos p using estudio_canais c
  where p.canal = c.id and p.origem = 'calendario' and p.estado = 'fila' and p.gerar_em > now()
    and (not c.ativo or c.molde is null
      or not (extract(dow from p.quando at time zone 'America/Sao_Paulo')::int = any (c.dias))
      or (p.quando at time zone 'America/Sao_Paulo')::time <> c.hora);
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
      insert into estudio_pedidos (canal, origem, pilar, quando, texto)
      values (c.id, 'calendario', pil, q,
        coalesce(case when jsonb_array_length(coalesce(temas, '[]')) > 0 then temas->>(kp % jsonb_array_length(temas)) end,
                 'Tema livre do canal: o Estúdio escolhe'));
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
grant execute on function public.estudio_planejar(int) to authenticated;

insert into public.estudio_canais (id, nome, rede, molde, ativo, dias, hora, antecedencia, pilares, sequencia, ordem) values
('convention-linkedin', 'Village Convention', 'linkedin', 'convention-linkedin', true, '{2,4}', '10:00', 3,
 '[{"id":"rh","nome":"RH: integração e treinamento","temas":["Integração de equipes: por que tirar o time do escritório","Treinamento que fica: aprendizado fora da sala de sempre","SIPAT e convenção com atividade ao ar livre","Kick-off do ano: alinhar o time num lugar só"]},
   {"id":"estrutura","nome":"Estrutura e capacidade","temas":["Do workshop de 20 à plenária de 1.500 pessoas","14 salas modulares e 3 foyers: um evento, várias trilhas","Centro de Eventos Bernardo Antônio por dentro"]},
   {"id":"experiencia","nome":"Experiência completa","temas":["Entre uma sessão e outra: gastronomia, piscina e aventura","Hospedagem no mesmo lugar do evento: imersão total","Village Adventure: trekking, stand up e ponte tibetana para o time"]},
   {"id":"prova","nome":"Prova e confiança","temas":["Mais de 1.000 eventos: o que aprendemos","O maior complexo de eventos da Serra do Cipó","Checklist do RH para escolher o local do evento"]},
   {"id":"logistica","nome":"Logística sem dor","temas":["59 km de BH e 42 km de Confins: logística simples","Tudo no mesmo lugar: menos deslocamento, mais evento","Evento fora da cidade sem dor de cabeça"]}]',
 '{rh,estrutura,experiencia,prova,logistica,rh,experiencia,estrutura}', 1),
('village-linkedin', 'Village · empresa', 'linkedin', null, false, '{3}', '10:00', 3,
 '[{"id":"gente","nome":"Gente da casa","temas":[]},{"id":"bastidores","nome":"Bastidores","temas":[]},{"id":"conquistas","nome":"Conquistas","temas":[]},{"id":"cultura","nome":"Cultura e treinamento","temas":[]}]',
 '{}', 2)
on conflict (id) do nothing;
