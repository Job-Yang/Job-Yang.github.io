import { getCollection } from 'astro:content';

function plain(body: string, max = 140): string {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, max);
}

export async function GET() {
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).map((p) => ({
    type: 'article',
    title: p.data.title,
    category: p.data.category,
    tags: p.data.tags,
    url: `/writing/${p.id}/`,
    text: `${p.data.title} ${p.data.description} ${plain(p.body ?? '')}`,
    excerpt: p.data.description,
  }));
  const notes = (await getCollection('notes', ({ data }) => !data.draft)).map((n) => ({
    type: 'note',
    title: n.data.title ?? '',
    category: '手记',
    tags: n.data.tags,
    url: '/notes/',
    text: `${n.data.title ?? ''} ${plain(n.body ?? '')}`,
    excerpt: plain(n.body ?? '', 90),
  }));
  return new Response(JSON.stringify([...posts, ...notes]), {
    headers: { 'Content-Type': 'application/json' },
  });
}
