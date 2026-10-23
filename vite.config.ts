import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

// O site fica em web/. "base: './'" permite publicar em qualquer endereço (Vercel, Netlify, GitHub Pages).
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [preact()],
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2019', chunkSizeWarningLimit: 900 },
  server: { host: true, port: 5173 },
});
