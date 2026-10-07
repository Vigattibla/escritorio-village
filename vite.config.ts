import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// base relativa: funciona no GitHub Pages em qualquer subpasta
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: './',
    plugins: [react(), {
      // ponte/config.json: endereço e chave pública do Supabase para a ponte da IA baixada pelo instalador
      name: 'ponte-config', apply: 'build',
      generateBundle() {
        if (env.VITE_SUPABASE_URL) this.emitFile({ type: 'asset', fileName: 'ponte/config.json', source: JSON.stringify({ url: env.VITE_SUPABASE_URL, anon: env.VITE_SUPABASE_ANON_KEY }) })
      },
    }],
  }
})
