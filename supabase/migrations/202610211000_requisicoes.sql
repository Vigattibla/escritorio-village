-- Pedidos ao gerente (aba Pedidos): material/compra, folga e outros. Fica tudo registrado:
-- o histórico é escrito só pelo servidor e ninguém apaga. Pedido coletivo = lista aberta do
-- setor (cada um põe seus itens); qualquer pedido aberto recebe apoio (+1) de quem vê.
-- Quem decide: o gerente da sala (rank 3), a Chefe ou o adm (gere_equipe).
create table if not exists public.requisicoes (
  id uuid primary key default gen_random_uuid(),
  dept text not null default 'marketing',
  tipo text not null check (tipo in ('material', 'folga', 'livre')),
  titulo text not null check (char_length(titulo) between 1 and 120),
  detalhe text not null default '' check (char_length(detalhe) <= 4000),
  coletivo boolean not null default false,
  -- [{id, nome, qtd, por}]
  itens jsonb not null default '[]' check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) <= 300),
  apoios uuid[] not null default '{}',
  fecha date,
  de date,
  ate date,
  status text not null default 'aberto' check (status in ('aberto', 'aprovado', 'recusado', 'entregue', 'cancelado')),
  motivo text not null default '' check (char_length(motivo) <= 1000),
  por uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  decidido_por uuid references public.profiles(id) on delete set null,
  historico jsonb not null default '[]',
  created_at timestamptz not null default now(),
  em timestamptz not null default now(),
  check (tipo <> 'folga' or (de is not null and (ate is null or ate >= de)))
);
create index if not exists requisicoes_dept on public.requisicoes (dept, status);

-- folga é pessoal: só quem pediu e quem decide veem
create or replace function public.ve_requisicao(u uuid, p_por uuid, p_dept text, p_tipo text) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and (p_por = u or public.gere_equipe(u, p_dept) or (p_tipo <> 'folga' and public.dept_of(u) = p_dept))
$$;

-- criar: o servidor carimba autor, status e a primeira linha do histórico
create or replace function public.nova_requisicao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.por := auth.uid();
  new.status := 'aberto'; new.motivo := ''; new.decidido_por := null; new.apoios := '{}';
  new.created_at := now(); new.em := now();
  new.itens := coalesce((select jsonb_agg(i || jsonb_build_object('por', new.por)) from jsonb_array_elements(new.itens) i), '[]');
  new.historico := jsonb_build_array(jsonb_build_object('em', now(), 'por', new.por, 'txt', 'Pedido feito'));
  return new;
end $$;
drop trigger if exists nova_requisicao on public.requisicoes;
create trigger nova_requisicao before insert on public.requisicoes for each row execute function public.nova_requisicao();

alter table public.requisicoes enable row level security;
drop policy if exists "requisicoes: ver" on public.requisicoes;
drop policy if exists "requisicoes: criar" on public.requisicoes;
create policy "requisicoes: ver" on public.requisicoes for select to authenticated using (public.ve_requisicao(auth.uid(), por, dept, tipo));
create policy "requisicoes: criar" on public.requisicoes for insert to authenticated
  with check (por = auth.uid() and (dept = public.dept_of(auth.uid()) or public.gere_equipe(auth.uid(), dept)));
-- sem update/delete direto: tudo passa por requisicao_mudar (registro)
do $$ begin alter publication supabase_realtime add table public.requisicoes; exception when duplicate_object then null; end $$;

-- p_acao: 'editar' | 'itens' | 'apoio' | 'status'
create or replace function public.requisicao_mudar(p_id uuid, p_acao text, p jsonb default '{}') returns public.requisicoes
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  r public.requisicoes;
  g boolean;
  autor boolean;
  novo text;
  txt text;
  meus jsonb;
begin
  select * into r from public.requisicoes where id = p_id for update;
  if not found or not public.ve_requisicao(u, r.por, r.dept, r.tipo) then raise exception 'Esse pedido não existe mais.'; end if;
  g := public.gere_equipe(u, r.dept);
  autor := r.por = u;

  if p_acao = 'editar' then
    if not autor then raise exception 'Só quem fez o pedido muda o texto.'; end if;
    if r.status <> 'aberto' then raise exception 'O pedido já foi decidido; peça para reabrir.'; end if;
    update public.requisicoes set
      titulo = coalesce(nullif(trim(p->>'titulo'), ''), titulo),
      detalhe = coalesce(p->>'detalhe', detalhe),
      coletivo = case when tipo = 'material' then coalesce((p->>'coletivo')::boolean, coletivo) else false end,
      fecha = case when p ? 'fecha' then (p->>'fecha')::date else fecha end,
      de = case when p ? 'de' then (p->>'de')::date else de end,
      ate = case when p ? 'ate' then (p->>'ate')::date else ate end,
      em = now()
    where id = p_id returning * into r;

  elsif p_acao = 'itens' then
    if r.status <> 'aberto' then raise exception 'Esse pedido não aceita mais itens.'; end if;
    if not (autor or g or (r.coletivo and (r.fecha is null or current_date <= r.fecha))) then
      raise exception 'Só dá para pôr itens em lista coletiva aberta.';
    end if;
    -- gestor com todos=true reescreve a lista; os outros trocam só os próprios itens
    if g and coalesce((p->>'todos')::boolean, false) then
      meus := coalesce(p->'itens', '[]');
      update public.requisicoes set itens = meus, em = now() where id = p_id returning * into r;
    else
      meus := coalesce((select jsonb_agg(i || jsonb_build_object('por', u)) from jsonb_array_elements(coalesce(p->'itens', '[]')) i), '[]');
      update public.requisicoes set
        itens = coalesce((select jsonb_agg(i) from jsonb_array_elements(itens) i where i->>'por' is distinct from u::text), '[]') || meus,
        em = now()
      where id = p_id returning * into r;
    end if;

  elsif p_acao = 'apoio' then
    if r.status <> 'aberto' then raise exception 'Esse pedido já foi decidido.'; end if;
    if autor then raise exception 'Quem pediu já conta.'; end if;
    update public.requisicoes set
      apoios = case when u = any(apoios) then array_remove(apoios, u) else apoios || u end
    where id = p_id returning * into r;

  elsif p_acao = 'status' then
    novo := p->>'status';
    if novo = r.status then return r; end if;
    if novo = 'cancelado' then
      if not autor or r.status <> 'aberto' then raise exception 'Só quem pediu cancela, e enquanto está aberto.'; end if;
      txt := 'Cancelado';
    elsif not g then
      raise exception 'Só o gerente decide o pedido.';
    elsif novo = 'aprovado' then txt := 'Aprovado';
    elsif novo = 'recusado' then
      if coalesce(trim(p->>'motivo'), '') = '' then raise exception 'Diga o motivo da recusa.'; end if;
      txt := 'Recusado: ' || left(trim(p->>'motivo'), 900);
    elsif novo = 'entregue' then
      if r.status <> 'aprovado' then raise exception 'Aprove antes de marcar como entregue.'; end if;
      txt := case when r.tipo = 'folga' then 'Concluído' else 'Entregue' end;
    elsif novo = 'aberto' then txt := 'Reaberto';
    else raise exception 'Status inválido.';
    end if;
    if coalesce(trim(p->>'motivo'), '') <> '' and novo <> 'recusado' then txt := txt || ' — ' || left(trim(p->>'motivo'), 900); end if;
    update public.requisicoes set
      status = novo,
      motivo = case when novo = 'aberto' then '' else coalesce(left(trim(p->>'motivo'), 1000), '') end,
      decidido_por = case when novo in ('aprovado', 'recusado', 'entregue') then u when novo = 'aberto' then null else decidido_por end,
      em = now(),
      historico = historico || jsonb_build_object('em', now(), 'por', u, 'txt', txt)
    where id = p_id returning * into r;

  else
    raise exception 'Ação inválida.';
  end if;
  return r;
end $$;
revoke all on function public.requisicao_mudar(uuid, text, jsonb) from public;
grant execute on function public.requisicao_mudar(uuid, text, jsonb) to authenticated;
