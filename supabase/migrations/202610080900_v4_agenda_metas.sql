-- v4: agenda (canal/horário de post + eventos), metas, adesivos e fluxos
alter table public.tasks add column if not exists channel text;
alter table public.tasks add column if not exists publish_at timestamptz;
do $$ begin
  alter table public.tasks add constraint tasks_channel_chk check (channel is null or channel in ('feed', 'reels', 'stories', 'facebook', 'site'));
exception when duplicate_object then null; end $$;

create table if not exists public.events (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 140),
  day date not null,
  time text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 140),
  target int not null check (target > 0),
  metric text not null default 'posts' check (metric in ('posts', 'tasks', 'manual')),
  month text not null,
  reward text not null default '',
  value int not null default 0,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.stickers (
  id uuid primary key,
  to_id uuid not null references public.profiles(id) on delete cascade,
  by_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  text text not null default '',
  x real not null default 0.7,
  y real not null default 0.7,
  created_at timestamptz not null default now()
);

create table if not exists public.flows (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 140),
  objective text not null default '',
  nodes jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.goals enable row level security;
alter table public.stickers enable row level security;
alter table public.flows enable row level security;

drop policy if exists "eventos: ver" on public.events;
drop policy if exists "eventos: criar" on public.events;
drop policy if exists "eventos: editar" on public.events;
drop policy if exists "eventos: apagar" on public.events;
create policy "eventos: ver" on public.events for select to authenticated using (true);
create policy "eventos: criar" on public.events for insert to authenticated with check (created_by = auth.uid());
create policy "eventos: editar" on public.events for update to authenticated using (created_by = auth.uid() or public.rank_of(auth.uid()) >= 3);
create policy "eventos: apagar" on public.events for delete to authenticated using (created_by = auth.uid() or public.rank_of(auth.uid()) >= 3);

drop policy if exists "metas: ver" on public.goals;
drop policy if exists "metas: criar" on public.goals;
drop policy if exists "metas: editar" on public.goals;
drop policy if exists "metas: apagar" on public.goals;
create policy "metas: ver" on public.goals for select to authenticated using (true);
create policy "metas: criar" on public.goals for insert to authenticated with check (created_by = auth.uid() and public.rank_of(auth.uid()) >= 2);
create policy "metas: editar" on public.goals for update to authenticated using (public.rank_of(auth.uid()) >= 2);
create policy "metas: apagar" on public.goals for delete to authenticated using (created_by = auth.uid() or public.rank_of(auth.uid()) >= 3);

drop policy if exists "adesivos: ver" on public.stickers;
drop policy if exists "adesivos: colar" on public.stickers;
drop policy if exists "adesivos: mover" on public.stickers;
drop policy if exists "adesivos: tirar" on public.stickers;
create policy "adesivos: ver" on public.stickers for select to authenticated using (true);
create policy "adesivos: colar" on public.stickers for insert to authenticated with check (by_id = auth.uid() and public.rank_of(auth.uid()) >= 2);
create policy "adesivos: mover" on public.stickers for update to authenticated using (to_id = auth.uid() or by_id = auth.uid());
create policy "adesivos: tirar" on public.stickers for delete to authenticated using (to_id = auth.uid() or by_id = auth.uid());

drop policy if exists "fluxos: ver" on public.flows;
drop policy if exists "fluxos: criar" on public.flows;
drop policy if exists "fluxos: editar" on public.flows;
drop policy if exists "fluxos: apagar" on public.flows;
create policy "fluxos: ver" on public.flows for select to authenticated using (true);
create policy "fluxos: criar" on public.flows for insert to authenticated with check (created_by = auth.uid() and public.rank_of(auth.uid()) >= 2);
create policy "fluxos: editar" on public.flows for update to authenticated using (created_by = auth.uid() or public.rank_of(auth.uid()) >= 3);
create policy "fluxos: apagar" on public.flows for delete to authenticated using (created_by = auth.uid() or public.rank_of(auth.uid()) >= 3);

do $$ begin alter publication supabase_realtime add table public.events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.goals; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.stickers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.flows; exception when duplicate_object then null; end $$;
