import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkCallout from './src/lib/remark-callout.mjs';

export default defineConfig({
  site: 'https://job-yang.github.io',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkCallout],
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 950,
    },
  },
});
