import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkDocumentLayout from '../src/lib/remark-document-layout.mjs';
import remarkCallout from '../src/lib/remark-callout.mjs';
import remarkCjkEmphasis from '../src/lib/remark-cjk-emphasis.mjs';
import rehypeLazyImages from '../src/lib/rehype-lazy-images.mjs';

async function render(markdown) {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkDocumentLayout, remarkCallout, remarkCjkEmphasis],
    rehypePlugins: [rehypeLazyImages],
  });
  return (await processor.render(markdown)).code;
}

test('preserves unequal column widths, Markdown content and adjacent paragraphs', async () => {
  const html = await render(`Before

<grid>
<column width-ratio="0.4">
![Architecture](/diagram.svg)
</column>
<column width-ratio="0.6">

- **Keep this point**
- [Source](https://example.com)

</column>
</grid>

After`);
  assert.match(html, /<div class="document-columns" data-columns="2">/);
  assert.match(html, /--document-column-weight:0\.4/);
  assert.match(html, /--document-column-weight:0\.6/);
  assert.match(html, /<strong>Keep this point<\/strong>/);
  assert.match(html, /<figcaption>Architecture<\/figcaption>/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /<p>Before<\/p>/);
  assert.match(html, /<p>After<\/p>/);
  assert.doesNotMatch(html, /data-document-layout-slot|<grid>|<column|<p><div/);
});

test('handles nested grids, callouts, tables and code through the existing pipeline', async () => {
  const html = await render(`<grid>
<column width-ratio="0.7">
<callout emoji="💡">
**The original conclusion.**
</callout>

<grid>
<column>
| A | B |
|---|---|
| 1 | 2 |
</column>
<column>
> [!NOTE]
> Preserve this note.
</column>
</grid>
</column>
<column width-ratio="0.3">
\`\`\`js
const x = 1;
\`\`\`
</column>
</grid>`);
  assert.equal((html.match(/class="document-columns"/g) ?? []).length, 2);
  assert.match(html, /class="callout document-callout"/);
  assert.match(html, /<table>/);
  assert.match(html, /class="callout callout-note"/);
  assert.match(html, /data-language="js"/);
  assert.match(html, /Preserve this note/);
});

test('leaves layout examples in fenced code untouched and rejects style injection in ratios', async () => {
  const html = await render(`\`\`\`html
<grid><column>literal</column></grid>
\`\`\`

<grid>
<column width-ratio="1;position:fixed">One</column>
<column width-ratio="-2">Two</column>
<column width-ratio="Infinity">Three</column>
</grid>`);
  assert.equal((html.match(/class="document-columns"/g) ?? []).length, 1);
  assert.equal((html.match(/--document-column-weight:1/g) ?? []).length, 3);
  assert.doesNotMatch(html, /position:fixed/);
  assert.match(html, /literal/);
});

test('does not discard an incomplete exported container', async () => {
  const markdown = 'Before\n\n<grid>\n<column>Keep this</column>\n\nAfter';
  const html = await render(markdown);
  assert.match(html, /Keep this/);
  assert.match(html, /After/);
  assert.doesNotMatch(html, /document-columns/);
});

test('handles adjacent containers without repeating content or changing surrounding typography', async () => {
  const html = await render(`"Original paragraph."

<grid><column>First</column></grid><grid><column>Second</column></grid>

"Last paragraph."`);
  assert.equal((html.match(/class="document-columns"/g) ?? []).length, 2);
  assert.equal((html.match(/First/g) ?? []).length, 1);
  assert.equal((html.match(/Second/g) ?? []).length, 1);
  assert.match(html, /“Original paragraph\.”/);
  assert.match(html, /“Last paragraph\.”/);
});

test('restores bold markers between CJK characters without touching code', async () => {
  const html = await render('**信息层：断崖**AI 在信息处理领域。\n\n```\n**literal**\n```');
  assert.match(html, /<strong>信息层：断崖<\/strong>AI/);
  assert.match(html, /\*\*literal\*\*/);
  assert.doesNotMatch(html, /\*\*信息层/);
});

test('layout tags in a column code sample cannot terminate the surrounding columns', async () => {
  const html = await render(`<grid>
<column>
\`\`\`html
</column></grid>
<column>Code sample</column>
\`\`\`
Text after code.
</column>
<column>
Second column with \`</column>\` in inline code.
</column>
</grid>`);
  assert.equal((html.match(/class="document-columns"/g) ?? []).length, 1);
  assert.equal((html.match(/class="document-column"/g) ?? []).length, 2);
  assert.match(html, /Text after code/);
  assert.match(html, /Second column/);
  assert.match(html, /data-language="html"/);
});
