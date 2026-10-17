-- Tipos de setor (Reservas, Obras, Manutenção…) e registros dos módulos de cada tipo.
-- tipo nulo = o app deduz pelo nome da sala. Trocar o tipo volta as abas ao padrão do tipo.
alter table public.depts add column if not exists tipo text;

create or replace function public.set_dept_tipo(p_dept text, p_tipo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.gere_equipe(auth.uid(), p_dept) then
    raise exception 'Só o gerente da sala, a Chefe ou o adm mudam o tipo do setor.';
  end if;
  update public.depts set tipo = nullif(p_tipo, ''), abas = null where id = p_dept;
  if not found then raise exception 'Essa sala não existe.'; end if;
end $$;
revoke all on function public.set_dept_tipo(text, text) from public;
grant execute on function public.set_dept_tipo(text, text) to authenticated;

-- um registro = um cartão/linha de um módulo (reserva, obra, chamado, quarto, passagem de turno…)
create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  dept text not null references public.depts(id) on delete cascade,
  modulo text not null,
  titulo text not null default '',
  status text not null default '',
  campos jsonb not null default '{}'::jsonb,
  pos double precision not null default 0,
  por uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  em timestamptz not null default now()
);
create index if not exists registros_dept_mod on public.registros (dept, modulo);
alter table public.registros enable row level security;

-- vê: a própria sala, quem abriu (chamado pra outro setor), Chefe e adm
drop policy if exists "registros: ver" on public.registros;
create policy "registros: ver" on public.registros for select to authenticated
  using (dept = public.my_dept() or por = auth.uid() or public.rank_of(auth.uid()) >= 4 or public.is_admin(auth.uid()));
-- cria: na própria sala; chamado de manutenção/TI em qualquer sala
drop policy if exists "registros: criar" on public.registros;
create policy "registros: criar" on public.registros for insert to authenticated
  with check (dept = public.my_dept() or modulo in ('os', 'ti') or public.gere_equipe(auth.uid(), dept));
drop policy if exists "registros: editar" on public.registros;
create policy "registros: editar" on public.registros for update to authenticated
  using (dept = public.my_dept() or public.gere_equipe(auth.uid(), dept))
  with check (dept = public.my_dept() or public.gere_equipe(auth.uid(), dept));
drop policy if exists "registros: apagar" on public.registros;
create policy "registros: apagar" on public.registros for delete to authenticated
  using (por = auth.uid() or public.gere_equipe(auth.uid(), dept));

do $$ begin alter publication supabase_realtime add table public.registros; exception when duplicate_object then null; end $$;
