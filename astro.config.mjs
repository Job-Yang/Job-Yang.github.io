import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://job-yang.github.io',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    build: {
      chunkSizeWarningLimit: 950,
    },
  },
});
