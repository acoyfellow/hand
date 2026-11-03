import { fileURLToPath } from 'node:url';
import { foldkit } from '@foldkit/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { PRERENDER_PATHS } from './src/pages.ts';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    foldkit({
      devToolsMcpPort: false,
      ssr: {
        serverEntry: '/src/entry.server.ts',
        build: { prerender: { paths: [...PRERENDER_PATHS], origin: 'https://hand.coey.dev' } },
      },
    }),
    tailwindcss(),
  ],
  server: { port: Number(process.env.PORT ?? 8799), host: '127.0.0.1' },
});
