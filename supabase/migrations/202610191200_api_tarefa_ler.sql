-- Pedido inteiro pra fora do app (pílula → Estúdio): texto, checklist, comentários e anexos.
-- Os anexos saem só com o caminho no bucket; quem assina o link é a função tarefas, depois desta checagem.
create or replace function public.api_tarefa_ler(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.api_quem(p_token); t public.tasks;
begin
  select * into t from public.tasks where id = p_id;
  if t.id is null or not (t.owner_id = me or t.created_by = me or me = any(t.collaborators)) then raise exception 'Você não participa dessa tarefa.'; end if;
  return jsonb_build_object('id', t.id, 'titulo', t.title, 'texto', coalesce(t.notes, ''), 'situacao', t.status,
    'prazo', t.due, 'prioridade', t.priority, 'minha', t.owner_id = me,
    'de', (select name from public.profiles where id = t.created_by),
    'projeto', (select name from public.projects where id = t.project_id),
    'checklist', coalesce(to_jsonb(t.checklist), '[]'::jsonb),
    'anexos', coalesce((select jsonb_agg(jsonb_build_object('nome', a->>'name', 'caminho', a->>'path', 'tipo', a->>'type', 'tamanho', a->'size'))
                          from jsonb_array_elements(coalesce(to_jsonb(t.attachments), '[]'::jsonb)) a), '[]'::jsonb),
    'comentarios', coalesce((select jsonb_agg(jsonb_build_object('de', p.name, 'texto', n.body, 'em', n.created_at) order by n.created_at)
                               from public.task_notes n left join public.profiles p on p.id = n.author_id where n.task_id = t.id), '[]'::jsonb));
end $$;
grant execute on function public.api_tarefa_ler(text, uuid) to anon, authenticated;
