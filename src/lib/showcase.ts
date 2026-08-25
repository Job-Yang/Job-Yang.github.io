import { getCollection } from 'astro:content';
import { comparePosts } from './posts';

const site = 'https://jobyang.cn';

function absolute(path: string): string {
  return new URL(path, site).href;
}

function excerpt(body: string, max = 88): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function buildShowcase() {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort(comparePosts)
    .slice(0, 3)
    .map((post) => ({
      title: post.data.title,
      description: post.data.description,
      publishedAt: post.data.publishedAt.toISOString(),
      url: absolute(`/writing/${post.id}/`),
    }));

  const notes = (await getCollection('notes', ({ data }) => !data.draft))
    .sort(
      (a, b) =>
        b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf() ||
        (a.data.title ?? '').localeCompare(b.data.title ?? '', 'zh-CN'),
    )
    .slice(0, 4)
    .map((note) => ({
      title: note.data.title ?? '一则新手记',
      excerpt: excerpt(note.body ?? ''),
      publishedAt: note.data.publishedAt.toISOString(),
      url: absolute('/notes/'),
    }));

  const projects = (await getCollection(
    'projects',
    ({ data }) => !data.draft && data.featured,
  ))
    .sort((a, b) => a.data.order - b.data.order)
    .map((project) => ({
      title: project.data.title,
      statement: project.data.statement,
      kind: project.data.kind,
      status: project.data.status,
      url: absolute(`/projects/${project.id}/`),
    }));

  return {
    schema: 'JobYangShowcase:v1',
    generatedAt: new Date().toISOString(),
    source: site,
    profile: {
      name: 'Job Yang.',
      alias: '老羊',
      role: '资深 iOS 工程师，正在全面转向 AI。',
      summary: '一边学习 AI，一边用它重做自己的工具链；长期记录 Agent、软件工程、iOS 与技术变化。',
      url: absolute('/about/'),
    },
    projects,
    latestPosts: posts,
    latestNotes: notes,
  };
}
