create table if not exists public.mesas_online (
  id uuid primary key,
  jogo text not null check (jogo in ('sinuca','cartas','baralho')),
  dono uuid not null references public.profiles(id) on delete cascade,
  convidado uuid references public.profiles(id) on delete set null,
  estado text not null default 'espera' check (estado in ('espera','jogando','fim')),
  versao int not null default 0,
  dados jsonb not null,
  atualizado timestamptz not null default now(),
  constraint mesas_online_participantes check (convidado is null or dono <> convidado)
);

create index if not exists mesas_online_estado_jogo_atualizado on public.mesas_online (estado, jogo, atualizado desc);
create index if not exists mesas_online_dono on public.mesas_online (dono);
create index if not exists mesas_online_convidado on public.mesas_online (convidado);
create unique index if not exists mesas_online_espera_unica on public.mesas_online (dono, jogo) where estado = 'espera';

alter table public.mesas_online enable row level security;
revoke all on public.mesas_online from anon, authenticated;
grant all on public.mesas_online to service_role;
-- Serializa criações da mesma pessoa, incluindo pedidos simultâneos.
create or replace function public.mesas_online_limite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('mesas-online:' || new.dono::text));
  if (select count(*) from public.mesas_online where dono = new.dono and estado <> 'fim') >= 3 then
    raise exception 'Você já tem três mesas abertas. Saia de uma antes.';
  end if;
  return new;
end $$;
revoke all on function public.mesas_online_limite() from public, anon, authenticated;
create trigger mesas_online_limite before insert on public.mesas_online for each row execute function public.mesas_online_limite();
-- Sem policies e fora de realtime/snapshots: dados contêm mãos privadas; acesso só via edge function "mesas".
