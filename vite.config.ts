/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const isVitest = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VITEST;

export default defineConfig({
  base: './', // nisbiy yo'llar: istalgan papka yoki hostingda ishlaydi
  plugins: [
    react(),
    // PWA: maktab interneti uzilsa ham o'yin ochiladi (barcha fayllar oldindan keshlanadi).
    !isVitest &&
      VitePWA({
        injectRegister: null, // ro'yxatdan o'tkazish main.tsx'da (xavfsiz try/catch bilan)
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: "Ipak Yo'li sarguzashti",
          short_name: "Ipak Yo'li",
          description: "O'zbekiston maktablari uchun ta'limiy sarguzasht o'yini",
          lang: 'uz',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f6ead2',
          theme_color: '#1e9fb8',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest,mp3}'], // rasmlar ham: internetsiz o'ynash uchun
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // Phaser ~1.5 MB
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
  ],
  build: {
    target: 'es2018',
    rollupOptions: {
      output: {
        // Phaser is heavy (~1 MB): keep it in its own lazily-loaded chunk.
        manualChunks: { phaser: ['phaser'] },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['**/node_modules/**', 'server/**', 'e2e/**'],
  },
});
