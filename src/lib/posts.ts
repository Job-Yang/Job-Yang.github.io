import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'posts'>;

export function comparePosts(a: Post, b: Post): number {
  if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;

  if (a.data.pinned && b.data.pinned) {
    const pinOrder = (a.data.pinOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.data.pinOrder ?? Number.MAX_SAFE_INTEGER);
    if (pinOrder !== 0) return pinOrder;
  }

  const date = b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf();
  if (date !== 0) return date;

  return a.data.title.localeCompare(b.data.title, 'zh-CN');
}
