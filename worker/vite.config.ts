import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    cloudflare({
      types: { generate: false },
      persistState: process.env.HOTAISLE_STATE_DIR ? { path: process.env.HOTAISLE_STATE_DIR } : true,
    }),
  ],
  envDir: '..',
  publicDir: '../web/dist',
  server: { host: '127.0.0.1', port: 8787, strictPort: true },
});
