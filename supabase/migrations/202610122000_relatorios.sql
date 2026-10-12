-- Último relatório (texto da IA) de cada pessoa: vale em qualquer computador. Uma linha por pessoa, sobrescrita a cada novo texto.
-- Todo mundo vê (o relatório sai das tarefas, que já são visíveis); grava a própria pessoa, quem está acima dela ou adm.
create table if not exists public.relatorios (
  id uuid primary key references public.profiles(id) on delete cascade,
  de text not null check (de ~ '^\d{4}-\d{2}-\d{2}$'),
  ate text not null check (ate ~ '^\d{4}-\d{2}-\d{2}$'),
  semana text not null default '' check (char_length(semana) <= 80),
  texto text not null default '' check (char_length(texto) <= 20000),
  resumo text not null default '' check (char_length(resumo) <= 4000),
  em timestamptz not null default now(),
  feito_por uuid default auth.uid() references public.profiles(id) on delete set null
);
create or replace function public.grava_relatorio(u uuid, p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u is not null and (u = p or public.is_admin(u) or public.outranks(u, p))
$$;
alter table public.relatorios enable row level security;
drop policy if exists "relatorios: ver" on public.relatorios;
drop policy if exists "relatorios: criar" on public.relatorios;
drop policy if exists "relatorios: editar" on public.relatorios;
create policy "relatorios: ver" on public.relatorios for select to authenticated using (true);
create policy "relatorios: criar" on public.relatorios for insert to authenticated with check (public.grava_relatorio(auth.uid(), id));
create policy "relatorios: editar" on public.relatorios for update to authenticated using (public.grava_relatorio(auth.uid(), id)) with check (public.grava_relatorio(auth.uid(), id));
do $$ begin alter publication supabase_realtime add table public.relatorios; exception when duplicate_object then null; end $$;
