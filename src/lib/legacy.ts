import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const legacyDirectory = path.join(process.cwd(), '_posts');

export interface LegacyPost {
  slug: string;
  title: string;
  date: Date;
  year: string;
  month: string;
  html: string;
}

export async function getLegacyPosts(): Promise<LegacyPost[]> {
  const files = (await fs.readdir(legacyDirectory)).filter((file) => file.endsWith('.md'));
  return Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(path.join(legacyDirectory, file), 'utf8');
      const parsed = matter(raw);
      const match = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
      if (!match) throw new Error(`Unexpected legacy post filename: ${file}`);
      const [, year, month, day, titleFromFile] = match;
      const date = new Date(parsed.data.date ?? `${year}-${month}-${day}T00:00:00+08:00`);
      return {
        slug: titleFromFile,
        title: String(parsed.data.title ?? titleFromFile),
        date,
        year,
        month,
        html: await marked.parse(parsed.content, { gfm: true }),
      };
    }),
  ).then((posts) => posts.sort((a, b) => b.date.valueOf() - a.date.valueOf()));
}
