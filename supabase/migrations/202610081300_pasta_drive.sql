-- pasta do Drive ligada à tarefa ou ao projeto: {"crumbs":[{"id","name"},…]} desde a raiz "Escritório Village"
alter table public.tasks add column if not exists drive jsonb;
alter table public.projects add column if not exists drive jsonb;
