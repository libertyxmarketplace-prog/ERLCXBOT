import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(webRoot, '..');

export default defineConfig({
  root: webRoot,
  publicDir: path.join(projectRoot, 'assets'),
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': process.env.VITE_BACKEND_URL || 'http://localhost:3001',
      '/auth/discord': process.env.VITE_BACKEND_URL || 'http://localhost:3001'
    }
  },
  build: {
    outDir: path.join(webRoot, 'dist'),
    emptyOutDir: true
  }
});