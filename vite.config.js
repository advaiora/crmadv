import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import sass from 'sass';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.API_PORT || '4000';
  const apiHost = env.API_HOST === '0.0.0.0' ? '127.0.0.1' : (env.API_HOST || '127.0.0.1');

  return {
    plugins: [react()],
    css: {
      preprocessorOptions: {
        scss: {
          implementation: sass,
          logger: {
            warn: (message) => {
              if (
                !message.includes('Deprecation Warning') &&
                !message.includes('@import rules are deprecated') &&
                !message.includes('Global built-in functions are deprecated and will be removed') &&
                !message.includes('The legacy JS API is deprecated and will be removed') &&
                !message.includes('https://sass-lang.com/d/color-functions') &&
                !message.includes('repetitive deprecation warnings omitted')
              ) {
                console.warn(message); // Only log non-deprecation warnings
              }
            },
          },
        },
      },
    },
    server: {
      // Onora la porta assegnata dall'ambiente (es. anteprima) se presente;
      // altrimenti Vite usa il suo default (5173). Non cambia `npm run dev`.
      port: process.env.PORT ? Number(process.env.PORT) : undefined,
      proxy: {
        '/api': {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    resolve: {
      alias: {
        moment: 'moment/moment.js', // Adjust path if needed
      },
    },
    // Test frontend (Vitest legge questa stessa config: stesso transform di Vite,
    // niente configurazione doppia). Si lanciano con `npm run test:frontend`.
    test: {
      environment: 'jsdom',
      // Su questa macchina l'avvio dell'ambiente jsdom e' cronicamente lento
      // (~20s a file, antivirus): col timeout di default (5s) un test puo'
      // diventare rosso a caso sotto carico. 15s = margine, non licenza di lentezza.
      testTimeout: 15000,
      setupFiles: ['src/test/setup.js'],
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      // La libreria "vendored" @hk-gantt ha test propri in stile Jest (globali
      // test/expect, non nostri): esclusi, come gia' fa eslint.config.js.
      exclude: ['**/node_modules/**', 'src/components/@hk-gantt/**'],
    },
  };
})
