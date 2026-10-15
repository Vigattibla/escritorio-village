-- Critérios para entrar numa etapa: checklist que quem move a tarefa precisa confirmar.
alter table public.stages add column if not exists criteria jsonb not null default '[]'::jsonb;
