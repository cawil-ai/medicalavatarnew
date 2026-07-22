import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],

  // Allow phone testing through HTTPS tunnels (loca.lt / cloudflare / ngrok).
  // Leading "." matches the domain and all of its subdomains.
  server: {
    host: true,
    allowedHosts: ['.loca.lt', '.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io'],
    // Fall-alert emails are triggered by server/index.mjs (`npm start`), which
    // holds NOVU_API_KEY. Proxy /api so `npm run dev` hits it too.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
