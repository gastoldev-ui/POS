// frontend/vite.config.js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Imágenes locales del catálogo (backend/data/pos/img).
      // Sin esto, /img/productos/<hash>.jpg lo pide a Vite (5174) y da 404.
      '/img': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})