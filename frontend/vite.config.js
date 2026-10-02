import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['all', 'jawed-drier-composure.ngrok-free.dev'],
    proxy: {
      '/owm': {
        target: 'https://api.openweathermap.org/data/2.5',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/owm/, ''),
      }
    }
  }
})
