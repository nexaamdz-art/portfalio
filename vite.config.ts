import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function assetRewritePlugin(): Plugin {
  return {
    name: 'asset-rewrite-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url) {
          const match = req.url.match(/^(?:\/(?:work|works)(?:\/[^/]+)*)?(\/assets\/.*)$/);
          if (match && req.url !== match[1]) {
            req.url = match[1];
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [assetRewritePlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
