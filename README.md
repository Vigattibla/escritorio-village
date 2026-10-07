# Escritório Village

Escritório virtual da equipe Village Resort: personagem chibi em pixel, mesa com tarefas do dia, chat, pedidos entre colegas, XP — e o **Vila**, pintinho que avisa das novidades até fora da aba.

## Rodar

```bash
npm install
npm run dev
```

Sem `.env.local` roda em **modo demo**: tudo fica no navegador; cada aba pode ser um usuário diferente (bom para testar). Três colegas fictícios (Ana, Bruno, Carla) já vêm sentados.

## Ligar o Supabase (equipe real)

1. Criar projeto grátis em supabase.com.
2. SQL Editor → colar `supabase/schema.sql` → Run.
3. Authentication → Sign In / Providers → Email: decidir se exige confirmação de e-mail (com confirmação, a pessoa confirma e depois entra).
4. Authentication → URL Configuration → Site URL = endereço onde o app ficar publicado.
5. Copiar `.env.example` para `.env.local` e preencher URL + anon key (Project Settings → API).
6. `npm run dev` — a etiqueta "demo" some do topo.

> Qualquer pessoa com o link pode criar conta e entrar na equipe. Para fechar: desligar novos cadastros no Supabase depois que todos entrarem.

## Publicar

`npm run build` gera `dist/` com caminhos relativos — serve em GitHub Pages, Netlify ou qualquer hospedagem estática. A anon key é pública por design; a proteção é o RLS do `schema.sql`.

## Mapa do código

- `src/data/` — `demo.ts` (localStorage + BroadcastChannel) e `supabase.ts`, mesma interface `Backend`
- `src/store.ts` — estado global, ações e avisos
- `src/chibi/` — sprite do personagem e do mascote (desenhado por código)
- `src/office/world.ts` — mapa, mesas, colisão, caminho
- `src/components/Game.tsx` — canvas do escritório
- `src/components/Mascot.tsx` — Vila + Picture-in-Picture + notificações
- `src/game/xp.ts` — XP, níveis, sequência, meta do dia
