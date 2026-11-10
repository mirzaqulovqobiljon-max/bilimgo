/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './', // nisbiy yo'llar: istalgan papka yoki hostingda ishlaydi
  plugins: [react()],
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
  },
});
