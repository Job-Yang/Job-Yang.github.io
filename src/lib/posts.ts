import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'posts'>;

const categoryRank: Record<string, number> = {
  'AI / 工程': 700,
  '【淬火·观点硬文】': 650,
  'iOS / AI': 600,
  '【汤山·畅想】': 500,
  '【费曼·实战复盘】': 400,
  'AI 底层原理连载 · 合集': 350,
  'AI 底层原理连载': 300,
  '实验 / 3D': 250,
  '锻造手记': 200,
  '【费曼·调研】': 100,
};

export function comparePosts(a: Post, b: Post): number {
  if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;

  const editorial = b.data.editorialRank - a.data.editorialRank;
  if (editorial !== 0) return editorial;

  const category = (categoryRank[b.data.category] ?? 0) - (categoryRank[a.data.category] ?? 0);
  if (category !== 0) return category;

  const date = b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf();
  if (date !== 0) return date;

  return a.data.title.localeCompare(b.data.title, 'zh-CN');
}
