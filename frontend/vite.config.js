import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // FIX: usar 127.0.0.1 (IPv4) em vez de localhost
      // No Windows, 'localhost' pode resolver para ::1 (IPv6)
      // mas o uvicorn escuta em 127.0.0.1 (IPv4) → ECONNREFUSED
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
