-- Almoxarifado: cafezinhos (só o servidor credita), metas em fases, compras, sala editável e carpinteiro.
-- Ganho: +60 de boas-vindas (1×), +10 por dia de ponto, meta = +5 a cada fase (25/50/75%) e +20 ao bater (35 por meta).

-- ---------- extrato ----------
create table if not exists public.coffee_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('dia', 'boasvindas', 'fase', 'meta', 'compra')),
  -- dia: AAAA-MM-DD · fase: AAAA-MM:<meta>:<n> · meta: AAAA-MM:<meta> · compra: id do item
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
alter table public.coffee_log enable row level security;
revoke insert, update, delete, truncate on public.coffee_log from anon, authenticated;
grant select on public.coffee_log to authenticated;
drop policy if exists "cafezinhos: só o meu" on public.coffee_log;
create policy "cafezinhos: só o meu" on public.coffee_log for select to authenticated using (user_id = auth.uid());

-- ---------- preços (o cliente não escolhe o preço) ----------
create table if not exists public.shop_items (id text primary key, price int not null check (price > 0));
alter table public.shop_items enable row level security;
revoke insert, update, delete, truncate on public.shop_items from anon, authenticated;
grant select on public.shop_items to authenticated;
drop policy if exists "almoxarifado: ver" on public.shop_items;
create policy "almoxarifado: ver" on public.shop_items for select to authenticated using (true);

-- ---------- metas congeladas ----------
-- base = progresso que já existia no dia da criação (fase batida no dia em que a meta nasceu não paga)
alter table public.goals add column if not exists base int not null default 0;

create or replace function public.goal_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now(); -- sem data retroativa
    new.base := case when new.metric = 'manual' then new.value else 0 end;
    return new;
  end if;
  if new.target is distinct from old.target or new.metric is distinct from old.metric or new.month is distinct from old.month then
    raise exception 'Meta congelada: para mudar o alvo, a contagem ou o mês, apague e crie outra.';
  end if;
  new.created_at := old.created_at;
  new.base := old.base;
  if new.metric = 'manual' and new.value is distinct from old.value and auth.uid() is not null and public.rank_of(auth.uid()) < 4 then
    raise exception 'Só a Chefe atualiza o número de uma meta manual.';
  end if;
  return new;
end $$;
drop trigger if exists goal_guard on public.goals;
create trigger goal_guard before insert or update on public.goals for each row execute function public.goal_guard();

-- cards que contam: feitos no mês da meta e com outra pessoa no meio (pediu, aprovou ou é mestre do projeto)
create or replace function public.goal_count(g public.goals, upto timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.tasks t
  left join public.projects p on p.id = t.project_id
  where t.status = 'done' and t.done_at is not null and t.done_at < upto
    and to_char(t.done_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = g.month
    and (g.metric <> 'posts' or t.channel is not null)
    and (t.created_by <> t.owner_id
      or (p.master_id is not null and p.master_id <> t.owner_id)
      or exists (select 1 from jsonb_array_elements(coalesce(t.reviews, '[]'::jsonb)) r
                 where coalesce((r->>'ok')::boolean, false) and r->>'by' <> t.owner_id::text))
$$;

-- fases: alvo ≥ 4 → 25/50/75/100%; alvo menor → só o final
create or replace function public.goal_steps(target int) returns int[]
language sql immutable as $$
  select case when target >= 4
    then array[ceil(target * 0.25)::int, ceil(target * 0.5)::int, ceil(target * 0.75)::int, target]
    else array[target] end
$$;

-- ---------- crédito: só aqui ----------
create or replace function public.claim_coffee() returns setof public.coffee_log
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  tz text := 'America/Sao_Paulo';
  g public.goals;
  v int; b int; s int[]; n int; paid int;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then return; end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  return query with x as (insert into public.coffee_log (user_id, amount, reason, ref) values (me, 60, 'boasvindas', '1') on conflict do nothing returning *) select * from x;
  return query with x as (insert into public.coffee_log (user_id, amount, reason, ref)
    values (me, 10, 'dia', to_char(now() at time zone tz, 'YYYY-MM-DD')) on conflict do nothing returning *) select * from x;
  for g in select * from public.goals where month >= to_char((now() at time zone tz) - interval '1 month', 'YYYY-MM') order by created_at loop
    -- teto: 3 metas pagas por mês para cada pessoa (a que já começou a pagar continua)
    if not exists (select 1 from public.coffee_log where user_id = me and reason in ('fase', 'meta') and split_part(ref, ':', 2) = g.id::text) then
      select count(distinct split_part(ref, ':', 2)) into paid from public.coffee_log
        where user_id = me and reason in ('fase', 'meta') and split_part(ref, ':', 1) = g.month;
      if paid >= 3 then continue; end if;
    end if;
    v := case when g.metric = 'manual' then g.value else public.goal_count(g, 'infinity') end;
    if v <= 0 then continue; end if;
    b := case when g.metric = 'manual' then g.base
      else public.goal_count(g, (((g.created_at at time zone tz)::date + 1)::timestamp at time zone tz)) end;
    s := public.goal_steps(g.target);
    n := array_length(s, 1);
    for i in 1..n loop
      if s[i] > b and v >= s[i] then
        if i < n then
          return query with x as (insert into public.coffee_log (user_id, amount, reason, ref)
            values (me, 5, 'fase', g.month || ':' || g.id || ':' || i) on conflict do nothing returning *) select * from x;
        else
          return query with x as (insert into public.coffee_log (user_id, amount, reason, ref)
            values (me, 20, 'meta', g.month || ':' || g.id) on conflict do nothing returning *) select * from x;
        end if;
      end if;
    end loop;
  end loop;
end $$;
revoke all on function public.claim_coffee() from public, anon;
grant execute on function public.claim_coffee() to authenticated;

create or replace function public.buy_item(item text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pr int; bal int;
begin
  if me is null then raise exception 'Entre de novo para comprar.'; end if;
  select price into pr from public.shop_items where id = item;
  if pr is null then raise exception 'Esse item não está no Almoxarifado.'; end if;
  perform pg_advisory_xact_lock(hashtext('coffee:' || me::text));
  if exists (select 1 from public.coffee_log where user_id = me and reason = 'compra' and ref = item) then return; end if;
  select coalesce(sum(amount), 0) into bal from public.coffee_log where user_id = me;
  if bal < pr then raise exception 'Faltam % cafezinhos.', pr - bal; end if;
  insert into public.coffee_log (user_id, amount, reason, ref) values (me, -pr, 'compra', item);
end $$;
revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;

-- ---------- só veste o que comprou ----------
create or replace function public.gear_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owned text[]; k text; v text;
begin
  if new.avatar is null or auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and new.avatar is not distinct from old.avatar then return new; end if;
  select coalesce(array_agg(ref), '{}') into owned from public.coffee_log where user_id = new.id and reason = 'compra';
  v := new.avatar->>'hair';
  if v is not null and v not in ('curto', 'longo', 'coque', 'cacheado', 'raspado') and not ('cabelo:' || v) = any(owned) then
    raise exception 'Esse cabelo ainda não é seu: compre no Almoxarifado.';
  end if;
  v := new.avatar->>'outfit';
  if v is not null and v not in ('camiseta', 'moletom', 'social', 'vestido', 'terno') and not ('roupa:' || v) = any(owned) then
    raise exception 'Essa roupa ainda não é sua: compre no Almoxarifado.';
  end if;
  for k, v in select key, value from jsonb_each_text(case when jsonb_typeof(new.avatar->'gear') = 'object' then new.avatar->'gear' else '{}'::jsonb end) loop
    if v is not null and v <> '' and not (k || ':' || v) = any(owned) then
      raise exception 'Esse item ainda não é seu: compre no Almoxarifado.';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists gear_guard on public.profiles;
create trigger gear_guard before insert or update on public.profiles for each row execute function public.gear_guard();

-- ---------- sala editável: Chefe, gerentes e quem estiver de carpinteiro ----------
create table if not exists public.carpenters (
  id uuid primary key references public.profiles(id) on delete cascade, -- quem ganhou o cargo
  until timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.rooms (
  id text primary key,
  data jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.can_edit_office(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rank_of(uid) >= 3 or exists (select 1 from public.carpenters c where c.id = uid and c.until > now())
$$;

alter table public.carpenters enable row level security;
alter table public.rooms enable row level security;
drop policy if exists "carpinteiro: ver" on public.carpenters;
drop policy if exists "carpinteiro: dar" on public.carpenters;
drop policy if exists "carpinteiro: mudar" on public.carpenters;
drop policy if exists "carpinteiro: tirar" on public.carpenters;
create policy "carpinteiro: ver" on public.carpenters for select to authenticated using (true);
create policy "carpinteiro: dar" on public.carpenters for insert to authenticated
  with check (created_by = auth.uid() and public.rank_of(auth.uid()) >= 3 and until <= now() + interval '4 hours');
create policy "carpinteiro: mudar" on public.carpenters for update to authenticated
  using (public.rank_of(auth.uid()) >= 3) with check (created_by = auth.uid() and until <= now() + interval '4 hours');
create policy "carpinteiro: tirar" on public.carpenters for delete to authenticated using (public.rank_of(auth.uid()) >= 3 or id = auth.uid());

drop policy if exists "sala: ver" on public.rooms;
drop policy if exists "sala: criar" on public.rooms;
drop policy if exists "sala: arrumar" on public.rooms;
create policy "sala: ver" on public.rooms for select to authenticated using (true);
create policy "sala: criar" on public.rooms for insert to authenticated with check (public.can_edit_office(auth.uid()));
create policy "sala: arrumar" on public.rooms for update to authenticated using (public.can_edit_office(auth.uid())) with check (public.can_edit_office(auth.uid()));

do $$ begin alter publication supabase_realtime add table public.carpenters; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rooms; exception when duplicate_object then null; end $$;

-- ---------- catálogo (gerado de src/shop/catalog.ts; item novo = migração nova com o preço) ----------
insert into public.shop_items (id, price) values
  ('cabelo:franja', 30),
  ('cabelo:rabo', 30),
  ('cabelo:chanel', 30),
  ('cabelo:topete', 30),
  ('cabelo:ondulado', 30),
  ('cabelo:careca', 30),
  ('cabelo:moicano', 60),
  ('cabelo:tranca', 60),
  ('cabelo:black', 60),
  ('cabelo:chiquinha', 60),
  ('cabelo:espetado', 60),
  ('cabelo:mullet', 120),
  ('cabelo:samurai', 120),
  ('cabelo:dread', 120),
  ('roupa:regata', 30),
  ('roupa:polo', 30),
  ('roupa:listrada', 30),
  ('roupa:avental', 30),
  ('roupa:xadrez', 60),
  ('roupa:jaqueta', 60),
  ('roupa:colete', 60),
  ('roupa:uniforme', 60),
  ('roupa:jardineira', 60),
  ('roupa:cardiga', 60),
  ('roupa:time', 60),
  ('roupa:macacao', 120),
  ('roupa:havaiana', 120),
  ('roupa:blazer', 120),
  ('roupa:salvavidas', 120),
  ('roupa:chef', 120),
  ('chapeu:bone-azul', 30),
  ('chapeu:bone-vermelho', 30),
  ('chapeu:bone-amarelo', 30),
  ('chapeu:bone-preto', 30),
  ('chapeu:gorro-vermelho', 30),
  ('chapeu:gorro-azul', 30),
  ('chapeu:gorro-verde', 30),
  ('chapeu:laco-rosa', 30),
  ('chapeu:laco-vermelho', 30),
  ('chapeu:viseira', 30),
  ('chapeu:bandana', 30),
  ('chapeu:palha', 60),
  ('chapeu:flores', 60),
  ('chapeu:fone-preto', 60),
  ('chapeu:fone-rosa', 60),
  ('chapeu:capacete', 60),
  ('chapeu:gato', 60),
  ('chapeu:antena', 60),
  ('chapeu:cozinheiro', 120),
  ('chapeu:cartola', 120),
  ('chapeu:cowboy', 120),
  ('chapeu:helice', 120),
  ('chapeu:coroa', 250),
  ('rosto:oculos-redondo', 30),
  ('rosto:oculos-quadrado', 30),
  ('rosto:bigode', 30),
  ('rosto:cavanhaque', 30),
  ('rosto:sardas', 30),
  ('rosto:oculos-escuro', 60),
  ('rosto:oculos-3d', 60),
  ('rosto:barba', 60),
  ('rosto:pirata', 60),
  ('rosto:monoculo', 120),
  ('rosto:mascara', 120),
  ('mesa:clara', 30),
  ('mesa:escura', 30),
  ('mesa:branca', 30),
  ('mesa:preta', 60),
  ('mesa:rustica', 60),
  ('mesa:rosa', 60),
  ('mesa:azul', 60),
  ('mesa:vidro', 120),
  ('mesa:marmore', 120),
  ('mesa:gamer', 250),
  ('cadeira:banquinho', 30),
  ('cadeira:rosa', 30),
  ('cadeira:verde', 30),
  ('cadeira:amarela', 30),
  ('cadeira:bola', 60),
  ('cadeira:poltrona', 60),
  ('cadeira:gamer-vermelha', 120),
  ('cadeira:gamer-azul', 120),
  ('cadeira:executiva', 120),
  ('cadeira:trono', 250),
  ('notebook:preto', 30),
  ('notebook:rosa', 30),
  ('notebook:azul', 30),
  ('notebook:branco', 60),
  ('notebook:adesivos', 60),
  ('notebook:dourado', 120),
  ('notebook:gamer', 120),
  ('notebook:retro', 120),
  ('notebook:maquina', 120),
  ('notebook:duplo', 250),
  ('enfeite:cacto', 30),
  ('enfeite:suculenta', 30),
  ('enfeite:caneca', 30),
  ('enfeite:retrato', 30),
  ('enfeite:pato', 30),
  ('enfeite:abacaxi', 30),
  ('enfeite:livros', 30),
  ('enfeite:cubo', 30),
  ('enfeite:flores', 30),
  ('enfeite:cafe', 60),
  ('enfeite:luminaria', 60),
  ('enfeite:globo', 60),
  ('enfeite:coqueiro', 60),
  ('enfeite:radio', 60),
  ('enfeite:ampulheta', 60),
  ('enfeite:dino', 60),
  ('enfeite:porquinho', 60),
  ('enfeite:trofeu', 120),
  ('enfeite:aquario', 120),
  ('enfeite:lava', 120),
  ('enfeite:bonsai', 120),
  ('enfeite:gato', 250),
  ('chao:planta', 30),
  ('chao:galao', 30),
  ('chao:skate', 30),
  ('chao:ventilador', 60),
  ('chao:basquete', 60),
  ('chao:boia', 60),
  ('chao:frigobar', 120),
  ('chao:guardasol', 120),
  ('chao:violao', 120),
  ('chao:cachorro', 250),
  ('animacao:folhas', 30),
  ('animacao:bolhas', 30),
  ('animacao:vapor', 30),
  ('animacao:coracoes', 60),
  ('animacao:estrelas', 60),
  ('animacao:notas', 60),
  ('animacao:faiscas', 120),
  ('animacao:nuvem', 120),
  ('animacao:raio', 120),
  ('animacao:borboletas', 120),
  ('animacao:arco', 250),
  ('animacao:aureola', 250),
  ('plaquinha:amarela', 30),
  ('plaquinha:verde', 30),
  ('plaquinha:rosa', 30),
  ('plaquinha:roxa', 30),
  ('plaquinha:laranja', 30),
  ('plaquinha:dourada', 120),
  ('plaquinha:neon', 120),
  ('plaquinha:arco', 250)
on conflict (id) do update set price = excluded.price;
