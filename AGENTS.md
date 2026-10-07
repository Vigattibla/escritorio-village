# Escritório Village — agentes

Diretiva geral: ver `C:\Users\Vigatti\AGENTS.md` (saída enxuta, PT-BR, confirmar push/publicação).

- Memory bank: este arquivo · `docs/product_requirement_docs.md` · `tasks/active_context.md`.
- Dev: `npm run dev` (porta 5180 no launch do Claude). Build: `npm run build`. Lint: `npx oxlint`.
- TS: `erasableSyntaxOnly` + `verbatimModuleSyntax` → nada de enum/parameter properties; `import type`.
- StrictMode ligado: efeitos de boot precisam ser idempotentes.
- Toda mudança de dados passa pela interface `Backend` (`src/types.ts`) — implementar nos dois: demo e supabase.
- Nunca commitar `.env.local`.
