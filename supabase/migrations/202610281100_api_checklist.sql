-- Checklist pela chave pessoal (pílula / IA): a lista vem junto no listar e dá pra marcar, adicionar e tirar item.
create or replace function public.api_tarefas(p_token text, p_situacao text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.title, 'situacao', t.status, 'prazo', t.due,
            'prioridade', t.priority, 'de', (select name from public.profiles where id = t.created_by),
            'minha', t.owner_id = me, 'checklist', coalesce(to_jsonb(t.checklist), '[]'::jsonb)) order by t.due nulls last, t.position), '[]')
    from (select * from public.tasks
           where (owner_id = me or me = any(collaborators))
             and (case when p_situacao is null then status not in ('declined') and (status <> 'done' or done_at > now() - interval '7 days')
                       else status = p_situacao end)
           order by due nulls last, position limit 60) t);
end $$;

-- p_item: id do item ou o texto (sem diferença de maiúsculas); p_feito null = inverte
create or replace function public.api_tarefa_checklist(p_token text, p_id uuid, p_item text default null, p_feito boolean default null,
  p_adicionar jsonb default null, p_tirar text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token); t public.tasks; l jsonb; achou boolean := false; x text;
begin
  select * into t from public.tasks where id = p_id;
  if t.id is null or not (t.owner_id = me or t.created_by = me or me = any(t.collaborators)) then raise exception 'Você não participa dessa tarefa.'; end if;
  l := coalesce(to_jsonb(t.checklist), '[]'::jsonb);
  if p_item is not null then
    select coalesce(jsonb_agg(case when (e->>'id' = p_item or lower(trim(e->>'text')) = lower(trim(p_item)))
                                   then jsonb_set(e, '{done}', to_jsonb(coalesce(p_feito, not coalesce((e->>'done')::boolean, false)))) else e end
                              order by n), '[]'::jsonb),
           bool_or(e->>'id' = p_item or lower(trim(e->>'text')) = lower(trim(p_item)))
      into l, achou
      from jsonb_array_elements(l) with ordinality a(e, n);
    if not coalesce(achou, false) then raise exception 'Não achei esse item no checklist.'; end if;
  end if;
  if p_tirar is not null then
    l := coalesce((select jsonb_agg(e order by n) from jsonb_array_elements(l) with ordinality a(e, n)
                    where not (e->>'id' = p_tirar or lower(trim(e->>'text')) = lower(trim(p_tirar)))), '[]'::jsonb);
  end if;
  if p_adicionar is not null and jsonb_typeof(p_adicionar) = 'array' then
    for x in select trim(v) from jsonb_array_elements_text(p_adicionar) v where trim(v) <> '' loop
      if jsonb_array_length(l) >= 200 then exit; end if;
      l := l || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'text', left(x, 300), 'done', false));
    end loop;
  end if;
  update public.tasks set checklist = l where id = p_id;
  return jsonb_build_object('id', p_id, 'titulo', t.title, 'checklist', l);
end $$;

grant execute on function public.api_tarefas(text, text), public.api_tarefa_checklist(text, uuid, text, boolean, jsonb, text) to anon, authenticated;
