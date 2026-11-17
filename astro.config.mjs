import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkCallout from './src/lib/remark-callout.mjs';
import remarkCjkEmphasis from './src/lib/remark-cjk-emphasis.mjs';
import remarkDocumentLayout from './src/lib/remark-document-layout.mjs';
import rehypeLazyImages from './src/lib/rehype-lazy-images.mjs';

export default defineConfig({
  site: 'https://jobyang.cn',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkDocumentLayout, remarkCallout, remarkCjkEmphasis],
    rehypePlugins: [rehypeLazyImages],
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 950,
    },
  },
});
