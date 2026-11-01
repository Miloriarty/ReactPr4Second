import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // запросы фронтенда к /api уходят на Express-сервер (server/)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
