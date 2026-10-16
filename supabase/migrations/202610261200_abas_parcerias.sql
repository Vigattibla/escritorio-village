-- Abas por setor + parcerias entre setores.
-- Cada sala escolhe quais abas usa (null = padrão do setor). Quem escolhe: gerente da sala, Chefe ou adm.
-- Parceria: um setor pede pra acompanhar a Agenda, o Plano ou as Publicações de outro.
-- O dono aceita; o parceiro vê (marcado de quem é) e pode mandar pedido, mas não edita.

alter table public.depts add column if not exists abas text[];

create or replace function public.set_dept_abas(p_dept text, p_abas text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.gere_equipe(auth.uid(), p_dept) then
    raise exception 'Só o gerente da sala, a Chefe ou o adm escolhem as abas.';
  end if;
  update public.depts set abas = p_abas where id = p_dept;
  if not found then raise exception 'Essa sala não existe.'; end if;
end $$;
revoke all on function public.set_dept_abas(text, text[]) from public;
grant execute on function public.set_dept_abas(text, text[]) to authenticated;

create table if not exists public.parcerias (
  id uuid primary key default gen_random_uuid(),
  de text not null references public.depts(id) on delete cascade,
  para text not null references public.depts(id) on delete cascade,
  modulo text not null check (modulo in ('agenda', 'plano', 'redes')),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  por uuid default auth.uid() references public.profiles(id) on delete set null,
  decidido_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (de <> para),
  unique (de, para, modulo)
);
alter table public.parcerias enable row level security;

drop policy if exists "parcerias: ver" on public.parcerias;
create policy "parcerias: ver" on public.parcerias for select to authenticated using (true);
-- escrita só pela função abaixo (quem pede = lado "de"; quem aceita/recusa = lado "para"; sair = qualquer lado)

-- devolve a linha como ficou (null quando sai) pra tela atualizar sem esperar o realtime
drop function if exists public.parceria(text, text, text, text);
create or replace function public.parceria(p_de text, p_para text, p_modulo text, p_acao text) returns public.parcerias
language plpgsql security definer set search_path = public as $$
declare r public.parcerias;
begin
  if p_modulo not in ('agenda', 'plano', 'redes') then raise exception 'Módulo inválido.'; end if;
  if p_acao = 'pedir' then
    if not public.gere_equipe(auth.uid(), p_de) then raise exception 'Só o gerente da sala, a Chefe ou o adm pedem parceria.'; end if;
    insert into public.parcerias (de, para, modulo, status, por) values (p_de, p_para, p_modulo, 'pendente', auth.uid())
      on conflict (de, para, modulo) do update set status = 'pendente', por = auth.uid(), decidido_por = null, created_at = now()
      where public.parcerias.status = 'recusado';
    select * into r from public.parcerias where de = p_de and para = p_para and modulo = p_modulo;
  elsif p_acao in ('aceitar', 'recusar') then
    if not public.gere_equipe(auth.uid(), p_para) then raise exception 'Quem aceita é o gerente da sala dona, a Chefe ou o adm.'; end if;
    update public.parcerias set status = case p_acao when 'aceitar' then 'aceito' else 'recusado' end, decidido_por = auth.uid()
      where de = p_de and para = p_para and modulo = p_modulo returning * into r;
    if not found then raise exception 'Esse pedido não existe mais.'; end if;
  elsif p_acao = 'sair' then
    if not (public.gere_equipe(auth.uid(), p_de) or public.gere_equipe(auth.uid(), p_para)) then
      raise exception 'Só o gerente de um dos lados, a Chefe ou o adm encerram.'; end if;
    delete from public.parcerias where de = p_de and para = p_para and modulo = p_modulo;
  else
    raise exception 'Ação inválida.';
  end if;
  return r;
end $$;
revoke all on function public.parceria(text, text, text, text) from public;
grant execute on function public.parceria(text, text, text, text) to authenticated;

do $$ begin alter publication supabase_realtime add table public.parcerias; exception when duplicate_object then null; end $$;

-- u é de um setor que tem parceria aceita no módulo mod do setor dono
create or replace function public.parceiro(u uuid, dono text, mod text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parcerias p
    where p.de = public.dept_of(u) and p.para = dono and p.modulo = mod and p.status = 'aceito');
$$;
revoke all on function public.parceiro(uuid, text, text) from public;
grant execute on function public.parceiro(uuid, text, text) to authenticated;

drop policy if exists "eventos: ver" on public.events;
create policy "eventos: ver" on public.events for select to authenticated using (
  dept = public.my_dept() or public.rank_of(auth.uid()) = 4 or public.parceiro(auth.uid(), dept, 'agenda'));

drop policy if exists "tarefas: sala ou quem participa" on public.tasks;
create policy "tarefas: sala ou quem participa" on public.tasks for select to authenticated using (
  dept = public.my_dept() or owner_id = auth.uid() or created_by = auth.uid() or auth.uid() = any(collaborators)
  or public.rank_of(auth.uid()) = 4 or public.approver_of(project_id, owner_id) = auth.uid()
  or (equipe is not null and public.na_equipe(equipe, auth.uid()))
  or ((publish_at is not null or due is not null) and public.parceiro(auth.uid(), dept, 'agenda'))
  or (channel is not null and public.parceiro(auth.uid(), dept, 'redes')));
