// Local remark plugin: turn GitHub-style alert blockquotes (> [!NOTE] ...) into
// styled callout containers. No external deps — keeps the public repo clean and
// avoids pulling registry mirrors into the lockfile.

const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

const LABELS = {
  NOTE: '说明',
  TIP: '提示',
  IMPORTANT: '重点',
  WARNING: '注意',
  CAUTION: '警告',
};

export default function remarkCallout() {
  return (tree) => {
    visit(tree, 'blockquote', (node) => {
      const first = node.children?.[0];
      if (!first || first.type !== 'paragraph') return;
      const lead = first.children?.[0];
      if (!lead || lead.type !== 'text') return;
      const match = lead.value.match(ALERT);
      if (!match) return;

      const kind = match[1];
      // Strip the "[!NOTE]" marker (and a following newline) from the text.
      lead.value = lead.value.replace(ALERT, '').replace(/^\n+/, '');
      if (lead.value === '') first.children.shift();

      node.data = node.data || {};
      node.data.hName = 'div';
      node.data.hProperties = {
        className: ['callout', `callout-${kind.toLowerCase()}`],
      };
      // Prepend a label element.
      node.children.unshift({
        type: 'paragraph',
        data: {
          hName: 'div',
          hProperties: { className: ['callout-label'] },
        },
        children: [{ type: 'text', value: LABELS[kind] || kind }],
      });
    });
  };
}

// Minimal unist visitor (avoids adding the `unist-util-visit` dependency).
function visit(node, type, fn) {
  if (!node || typeof node !== 'object') return;
  if (node.type === type) fn(node);
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) visit(child, type, fn);
  }
}
