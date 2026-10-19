import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5174, strictPort: true, proxy: { '/mcp': { target: 'http://127.0.0.1:3002', changeOrigin: false } } },
  preview: { port: 4174, strictPort: true, proxy: { '/mcp': { target: 'http://127.0.0.1:3002', changeOrigin: false } } },
  build: { outDir: 'dist' },
});
