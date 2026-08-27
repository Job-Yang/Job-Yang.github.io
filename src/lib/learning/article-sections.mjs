import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

export const AI_FOUNDATIONS_ARTICLE_PATH = path.join(
  process.cwd(),
  'src/content/posts/写给客户端工程师的-ai-底层原理.md',
);

const EXPERIMENT_MARKER =
  /^\s*<div\b[^>]*\bdata-learning-experiment=(?:"[^"]*"|'[^']*')[^>]*><\/div>\s*$/gm;

export function normalizeArticleHeading(value) {
  return String(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function readArticleSections() {
  const source = fs.readFileSync(AI_FOUNDATIONS_ARTICLE_PATH, 'utf8');
  const body = matter(source).content;
  const headings = Array.from(body.matchAll(/^##\s+(.+?)\s*$/gm));

  return headings.map((match, index) => {
    const title = match[1].trim();
    const contentStart = match.index + match[0].length;
    const contentEnd = headings[index + 1]?.index ?? body.length;
    const markdown = body.slice(contentStart, contentEnd).trim();

    return {
      title,
      normalizedTitle: normalizeArticleHeading(title),
      markdown,
    };
  });
}

export function extractArticleSection(sourceAnchor) {
  const normalizedAnchor = normalizeArticleHeading(sourceAnchor);
  const matches = readArticleSections().filter(
    (section) => section.normalizedTitle === normalizedAnchor,
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected one article section for "${sourceAnchor}", found ${matches.length}`,
    );
  }

  const section = matches[0];
  return {
    ...section,
    markdown: section.markdown.replace(EXPERIMENT_MARKER, '').trim(),
  };
}

export async function renderArticleSection(sourceAnchor) {
  const section = extractArticleSection(sourceAnchor);
  return {
    ...section,
    html: await marked.parse(section.markdown, { gfm: true }),
  };
}
