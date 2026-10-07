import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa: funciona no GitHub Pages em qualquer subpasta
export default defineConfig({
  base: './',
  plugins: [react()],
})
