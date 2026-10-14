import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)),
  base:'/game-scam-guard/',
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': { target:'http://127.0.0.1:3001', changeOrigin:false, xfwd:true } } },
});
