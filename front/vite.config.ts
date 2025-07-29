import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 6011,
    },
    preview: {
      port: 6011,
      host: '0.0.0.0',
      allowedHosts: ['df.mihouo.com'],
    },
    define: {
      __API_BASE_URL__: JSON.stringify(
        isDev ? 'http://localhost:6010/api' : 'https://df.mihouo.com/api'
      ),
    }
  }
})
