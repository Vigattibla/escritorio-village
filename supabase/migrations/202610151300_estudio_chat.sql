-- Chat com o Estúdio: o adm escreve no Turmeo, o trabalhador da VPS roda o Claude lá e responde aqui.
-- Executa comandos na máquina do Estúdio, então só adm lê e escreve.

create table if not exists public.estudio_chat (
  id uuid primary key default gen_random_uuid(),
  autor uuid default auth.uid() references public.profiles(id) on delete set null,
  papel text not null check (papel in ('eu', 'estudio')),
  texto text not null default '' check (length(texto) <= 20000),
  estado text not null default 'novo' check (estado in ('novo', 'lendo', 'feito', 'erro')),
  sessao text,
  criado_em timestamptz not null default now()
);
create index if not exists estudio_chat_ordem on public.estudio_chat (criado_em);
alter table public.estudio_chat enable row level security;
drop policy if exists "estudio chat: adm" on public.estudio_chat;
create policy "estudio chat: adm" on public.estudio_chat for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

do $$ begin alter publication supabase_realtime add table public.estudio_chat; exception when duplicate_object then null; end $$;
