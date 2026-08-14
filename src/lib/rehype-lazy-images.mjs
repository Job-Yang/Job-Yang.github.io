// Local rehype plugin: add lazy-loading hints to content images.
// No external deps to keep the public lockfile free of registry mirrors.

export default function rehypeLazyImages() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return;
      node.properties = node.properties || {};
      if (node.properties.loading == null) node.properties.loading = 'lazy';
      if (node.properties.decoding == null) node.properties.decoding = 'async';
    });
  };
}

function visit(node, type, fn) {
  if (!node || typeof node !== 'object') return;
  if (node.type === type) fn(node);
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) visit(child, type, fn);
  }
}
