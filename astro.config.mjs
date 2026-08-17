import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkCallout from './src/lib/remark-callout.mjs';
import rehypeLazyImages from './src/lib/rehype-lazy-images.mjs';

export default defineConfig({
  site: 'https://jobyang.cn',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkCallout],
    rehypePlugins: [rehypeLazyImages],
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 950,
    },
  },
});
