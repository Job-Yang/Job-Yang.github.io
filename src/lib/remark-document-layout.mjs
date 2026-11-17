// Preserve exported document columns as blocks, so Markdown inside each column
// still goes through the site's normal table, code, image and callout pipeline.
const OPEN = /<(grid|callout)\b[^>]*>/g;

function maskCode(source) {
  let masked = source;
  let fence;
  for (const line of source.matchAll(/^([ \t]{0,3})(`{3,}|~{3,})[^\n]*$/gm)) {
    const marker = line[2];
    if (!fence) fence = { start: line.index, marker };
    else if (marker[0] === fence.marker[0] && marker.length >= fence.marker.length
      && /^[ \t]*$/.test(line[0].slice(line[1].length + marker.length))) {
      const end = line.index + line[0].length;
      masked = masked.slice(0, fence.start)
        + source.slice(fence.start, end).replace(/[^\n]/g, ' ')
        + masked.slice(end);
      fence = null;
    }
  }
  if (fence) masked = masked.slice(0, fence.start) + masked.slice(fence.start).replace(/[^\n]/g, ' ');
  return masked.replace(/(`+)([\s\S]*?)\1(?!`)/g, (match) => match.replace(/[^\n]/g, ' '));
}

function containerEnd(source, start, name) {
  source = maskCode(source);
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'g');
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(source); tag; tag = tags.exec(source)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  return -1;
}

function block(tagName, className, children, properties = {}) {
  return {
    type: 'documentLayout',
    data: {
      hName: tagName,
      hProperties: { ...(className.length ? { className } : {}), ...properties },
    },
    children,
  };
}

function addCaptions(node) {
  for (const child of node.children ?? []) addCaptions(child);
  if (node.type !== 'paragraph' || node.children?.length !== 1) return;
  const image = node.children[0];
  if (image.type !== 'image') return;
  node.data = {
    hName: 'figure',
    hProperties: { className: ['document-figure'] },
  };
  if (image.alt && image.alt.length <= 75) {
    node.children.push(block('figcaption', [], [{ type: 'text', value: image.alt }]));
  }
}

export default function remarkDocumentLayout() {
  const processor = this;

  function compile(source, parsed = processor.parse(source)) {
    const candidates = [];
    const visit = (node) => {
      if (node.type === 'html') {
        const openings = node.value.matchAll(OPEN);
        for (const opening of openings) {
          const start = node.position.start.offset + opening.index;
          const end = containerEnd(source, start, opening[1]);
          if (end !== -1) candidates.push({ start, end, name: opening[1], opening: opening[0] });
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(parsed);
    if (!candidates.length) return parsed;

    const containers = [];
    const spans = [];
    for (const candidate of candidates.sort((a, b) => a.start - b.start)) {
      if (spans.some((span) => candidate.start < span.end)) continue;
      const bodyStart = candidate.start + candidate.opening.length;
      const bodyEnd = candidate.end - `</${candidate.name}>`.length;
      const body = source.slice(bodyStart, bodyEnd);
      let container;
      if (candidate.name === 'grid') {
        const columns = [];
        const tags = /<column\b([^>]*)>/g;
        for (let tag = tags.exec(body); tag; tag = tags.exec(body)) {
          const end = containerEnd(body, tag.index, 'column');
          if (end === -1) break;
          const value = tag[1].match(/\bwidth-ratio\s*=\s*["']([^"']+)["']/)?.[1];
          const ratio = Number(value);
          const weight = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
          const children = compile(body.slice(tags.lastIndex, end - '</column>'.length)).children;
          const column = block('div', ['document-column'], children, {
            style: `--document-column-weight:${weight}`,
          });
          addCaptions(column);
          columns.push(column);
          tags.lastIndex = end;
        }
        if (!columns.length) continue;
        container = block('div', ['document-columns'], columns, {
          'data-columns': columns.length,
        });
      } else {
        const emoji = candidate.opening.match(/\bemoji\s*=\s*["']([^"']*)["']/)?.[1];
        const children = [];
        if (emoji) children.push(block('span', ['document-callout-icon'], [{ type: 'text', value: emoji }]));
        children.push(block('div', ['document-callout-body'], compile(body).children));
        container = block('aside', ['callout', 'document-callout'], children);
      }
      spans.push(candidate);
      containers.push(container);
    }
    if (!spans.length) return parsed;
    const children = [];
    const preserveOutside = (start, end) => {
      for (const node of parsed.children) {
        const a = node.position.start.offset, b = node.position.end.offset;
        if (b <= start || a >= end) continue;
        if (a >= start && b <= end) children.push(node);
        else {
          const fragment = source.slice(Math.max(start, a), Math.min(end, b));
          if (fragment.trim()) children.push(...processor.parse(fragment).children);
        }
      }
    };
    let cursor = 0;
    for (let i = 0; i < spans.length; i++) {
      preserveOutside(cursor, spans[i].start);
      children.push(containers[i]);
      cursor = spans[i].end;
    }
    preserveOutside(cursor, source.length);
    return { ...parsed, children };
  }

  return (tree, file) => {
    if (!/<(?:grid|callout)\b/.test(String(file))) return;
    const result = compile(String(file), tree);
    tree.children = result.children;
  };
}
