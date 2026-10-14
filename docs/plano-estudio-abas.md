# Plano — Estúdio em abas (Conversa · Peças · Vídeo & Motion)

Pedido de 14/10/2026: separar o Estúdio do Turmeo em abas e usar a VPS para render quando o Gustavo está fora.
Fase de plano: nada implementado.

## Hoje
- `src/components/Estudio.tsx`: grade com Conversa (só dono) à esquerda + lado direito com abas Aprovar/Canais.
- `src/data/estudio.ts`: REST direto nas tabelas `estudio_chat`, `estudio_pedidos`, `estudio_canais`, `estudio_sinal` + RPCs.
- VPS `vps-trabalho` (~/estudio, usuário `gustavo`): `tools/trabalhador.mjs` lê fila/chat/calendário; `servidor/servidor.mjs` em 127.0.0.1:4747.
  8 núcleos, 23 GB, 278 GB livres, ffmpeg + Chrome + node. Sem After Effects (só no PC).

## Abas
| Aba | Quem vê | Conteúdo |
|---|---|---|
| **Conversa** | dono | chat em tela cheia; topo com sinal da VPS (ligado/trabalhando/fila N) |
| **Peças** | coordenação + aprova | Canais + Aprovar como hoje (sub-abas) |
| **Vídeo & Motion** | dono (depois coordenação) | novo pedido de vídeo, fila de render com progresso, player + baixar |

Aba padrão: Peças se há algo pra aprovar, senão Conversa (dono) / Peças (resto). Lembrar última aba em localStorage.

## Vídeo & Motion — fluxo
1. **Novo pedido**: tipo (`reel-molde` | `edicao` | `motion`), marca/molde, texto/roteiro, material.
2. **Material**: sobe para a pasta do Drive do Turmeo (`Estúdio/material/<pedido>`), não para o Supabase (arquivo grande).
   VPS baixa para `~/material/<pedido>` antes de renderizar.
3. **Fila**: tabela nova `estudio_videos` (id, tipo, molde, texto, material jsonb, estado espera|fila|renderizando|pronto|erro, passo, progresso 0–100, eta_s, saida jsonb, criado_por, criado_em). RLS igual a `estudio_pedidos`.
4. **Trabalhador**: novo laço em `trabalhador.mjs` — pega 1 vídeo por vez (render é pesado; carrossel continua em paralelo só se a VPS estiver livre). Escreve `passo`/`progresso` a cada etapa (espera explícita: o que está fazendo, tempo típico, contador).
5. **Saída**: MP4 vai pro Drive + anexo na tarefa do Quadro (igual carrossel). Player na aba com botão Baixar.

## O que roda onde
- VPS: reel por molde (`servidor/reel.mjs`), motion HTML (HyperFrames/Chrome headless), edição com ffmpeg (cortes, legenda, trilha).
- PC só: tudo que usa After (`motor-ae.mjs`, `puxar-ae.mjs`). Na aba aparece "precisa do PC" e fica em espera até o PC pegar.

## Ordem
1. Separar abas (só tela, sem banco). Deploy.
2. `estudio_videos` + tela de pedido/fila (reel por molde primeiro — já existe, só rodar na VPS).
3. Material via Drive + edição ffmpeg.
4. Motion livre.

## Decidido (14/10)
- Só o dono pede vídeo por enquanto.
- Limite do celular desconhecido → sem limite fixo: o envio já é resumable direto no Google (Drive 5 TB).
  Hoje o PUT é inteiro (`src/data/drive.ts:76`); para vídeo grande no 4G, mandar em pedaços de 8 MB com
  `Content-Range` e retomar do último byte aceito se a conexão cair. Barra de progresso + MB enviados.
