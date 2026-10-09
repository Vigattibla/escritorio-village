-- horário de entrega da tarefa/pedido (opcional, junto do prazo)
alter table public.tasks add column if not exists due_time text;
alter table public.tasks drop constraint if exists tasks_due_time_ok;
alter table public.tasks add constraint tasks_due_time_ok check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
