import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()], base: "/",
  server: {
    port: 5173, // ou a porta que você usa
    proxy: {
      // se precisar de proxy para a api
    }
  }
})