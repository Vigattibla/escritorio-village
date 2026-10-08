-- grupos no chat: canal 'g:<uuid>'; aberto (qualquer um entra) ou só convidados
create table if not exists public.groups (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'chat-circle-dots' check (char_length(icon) between 1 and 40),
  open boolean not null default true,
  members uuid[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;
grant select, insert, update, delete on public.groups to authenticated;

drop policy if exists "grupos: ver" on public.groups;
drop policy if exists "grupos: criar" on public.groups;
drop policy if exists "grupos: editar" on public.groups;
drop policy if exists "grupos: apagar" on public.groups;
create policy "grupos: ver" on public.groups for select to authenticated
  using (open or auth.uid() = any(members) or created_by = auth.uid());
create policy "grupos: criar" on public.groups for insert to authenticated
  with check (created_by = auth.uid() and auth.uid() = any(members));
create policy "grupos: editar" on public.groups for update to authenticated
  using (created_by = auth.uid() or public.rank_of(auth.uid()) >= 3);
create policy "grupos: apagar" on public.groups for delete to authenticated
  using (created_by = auth.uid() or public.rank_of(auth.uid()) >= 3);

-- entrar/sair: só a si mesmo; entrar só em grupo aberto
create or replace function public.group_join(gid uuid, p_join boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if p_join then
    update public.groups set members = array_append(members, auth.uid())
      where id = gid and open and not (auth.uid() = any(members));
  else
    update public.groups set members = array_remove(members, auth.uid()) where id = gid;
  end if;
end $$;
revoke all on function public.group_join(uuid, boolean) from public;
grant execute on function public.group_join(uuid, boolean) to authenticated;

-- canal de grupo: aberto ou membro (a leitura de groups já passa pelo RLS acima)
create or replace function public.can_see_channel(ch text) returns boolean
language sql stable as $$
  select ch = 'geral'
    or (ch like 'dm:%' and auth.uid()::text = any(string_to_array(substr(ch, 4), ':')))
    or (ch ~ '^g:[0-9a-f-]{36}$' and exists (
      select 1 from public.groups g where g.id = substr(ch, 3)::uuid and (g.open or auth.uid() = any(g.members))))
$$;

do $$ begin alter publication supabase_realtime add table public.groups; exception when duplicate_object then null; end $$;
