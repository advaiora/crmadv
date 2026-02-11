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
  };
})
