import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-server-middleware',
        configureServer(server) {
          import('./server/apiRouter.ts').then(({ apiRouter }) => {
            import('express').then((expressModule) => {
              const express = expressModule.default;
              server.middlewares.use(express.json() as unknown as import('vite').Connect.NextHandleFunction);
              server.middlewares.use('/api', ((req, res, next) => {
                (apiRouter as unknown as (r: unknown, s: unknown, n: unknown) => void)(req, res, next);
              }) as import('vite').Connect.NextHandleFunction);
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
