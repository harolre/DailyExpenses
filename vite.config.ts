import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: { preserveSymlinks: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Finanzas personales',
        short_name: 'Finanzas',
        description: 'Tus finanzas personales, con tus datos bajo tu control.',
        lang: 'es',
        theme_color: '#f6f7f8',
        background_color: '#f6f7f8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
