import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { posturaApiPlugin } from './server/postura-api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY) {
    process.env.TAVILY_API_KEY = env.TAVILY_API_KEY;
  }
  if (env.YOUTUBE_API_KEY && !process.env.YOUTUBE_API_KEY) {
    process.env.YOUTUBE_API_KEY = env.YOUTUBE_API_KEY;
  }

  const pagesBase = process.env.GITHUB_PAGES === 'true' ? '/aurora/' : '/';

  return {
    base: pagesBase,
    plugins: [
      react(),
      posturaApiPlugin(),
      {
        name: 'github-pages-spa-fallback',
        closeBundle() {
          if (process.env.GITHUB_PAGES !== 'true') return;
            const dist = resolve(process.cwd(), 'dist');
            const index = resolve(dist, 'index.html');
            if (existsSync(index)) {
              copyFileSync(index, resolve(dist, '404.html'));
              writeFileSync(resolve(dist, '.nojekyll'), '');
            }
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      open: false,
    },
  };
});
