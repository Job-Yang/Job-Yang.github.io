import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    readingMinutes: z.number().int().positive().optional(),
    source: z.enum(['public-rewrite', 'legacy']).default('public-rewrite'),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    order: z.number().int().optional(),
    draft: z.boolean().default(false),
    source: z.enum(['public-rewrite', 'legacy']).default('public-rewrite'),
    source_id: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string(),
    description: z.string(),
    statement: z.string(),
    github: z.string().url(),
    install: z.string(),
    tags: z.array(z.string()).default([]),
    order: z.number().int().default(0),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    visual: z.enum(['writing', 'video']),
  }),
});

export const collections = { posts, notes, projects };
