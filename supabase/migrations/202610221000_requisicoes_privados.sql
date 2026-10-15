-- Pedidos: o pessoal (não coletivo) só aparece para quem pediu e para quem decide.
-- Lista coletiva continua aberta para a sala toda; apoio (+1) só em lista coletiva.
create or replace function public.ve_req(u uuid, p_por uuid, p_dept text, p_coletivo boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and (p_por = u or public.gere_equipe(u, p_dept) or (p_coletivo and public.dept_of(u) = p_dept))
$$;

drop policy if exists "requisicoes: ver" on public.requisicoes;
create policy "requisicoes: ver" on public.requisicoes for select to authenticated using (public.ve_req(auth.uid(), por, dept, coletivo));

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
  if not found or not public.ve_req(u, r.por, r.dept, r.coletivo) then raise exception 'Esse pedido não existe mais.'; end if;
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
    if not r.coletivo then raise exception 'Apoio só em lista coletiva.'; end if;
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

drop function if exists public.ve_requisicao(uuid, uuid, text, text);
