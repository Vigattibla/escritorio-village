-- Console do Estúdio (painel 4848): conversa separada por fio (turmeo = página do app, criacao, pesquisa).
-- Cada fio tem sessão e instrução próprias no trabalhador (tools/turmeo-chat.mjs do estudio).
alter table public.estudio_chat add column if not exists fio text not null default 'turmeo';
alter table public.estudio_chat drop constraint if exists estudio_chat_fio_ck;
alter table public.estudio_chat add constraint estudio_chat_fio_ck check (fio in ('turmeo', 'criacao', 'pesquisa'));
create index if not exists estudio_chat_fio_idx on public.estudio_chat(fio, criado_em desc);
