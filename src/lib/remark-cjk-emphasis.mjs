// 把 Markdown 解析器因中英文紧邻而漏掉的 **粗体** 还原成 strong 节点。
// 只处理文本节点，不影响代码块、行内代码和链接目标。
function splitBold(value) {
  const re = /\*\*([^*\n]+?)\*\*/g;
  const parts = [];
  let last = 0;
  let match;
  while ((match = re.exec(value))) {
    if (match.index > last) {
      parts.push({ type: 'text', value: value.slice(last, match.index) });
    }
    parts.push({
      type: 'strong',
      children: [{ type: 'text', value: match[1] }],
    });
    last = match.index + match[0].length;
  }
  if (!parts.length) return null;
  if (last < value.length) {
    parts.push({ type: 'text', value: value.slice(last) });
  }
  return parts;
}

function walk(node) {
  if (!Array.isArray(node.children)) return;
  const next = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      const parts = splitBold(child.value);
      if (parts) {
        next.push(...parts);
        continue;
      }
    }
    walk(child);
    next.push(child);
  }
  node.children = next;
}

export default function remarkCjkEmphasis() {
  return (tree) => {
    walk(tree);
  };
}
