import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // expose to network — accessible via IP
    port: 5173,
    proxy: {
      '/owm': {
        target: 'https://api.openweathermap.org/data/2.5',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/owm/, ''),
      }
    }
  }
})
