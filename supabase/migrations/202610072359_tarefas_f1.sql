-- F1: prioridade, checklist e lembrete na tarefa
alter table public.tasks add column if not exists priority text;
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists remind_at timestamptz;

do $$ begin
  alter table public.tasks add constraint tasks_priority_chk check (priority is null or priority in ('alta', 'media', 'baixa'));
exception when duplicate_object then null; end $$;
