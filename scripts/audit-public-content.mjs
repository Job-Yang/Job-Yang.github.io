import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/content', 'src/pages', 'src/components', 'src/layouts', 'src/data'];
const blockedPatterns = [
  ['疑似内部链接', /https?:\/\/(?:[^/.\s]+\.)*(?:internal|intranet|corp|private)(?:\.[^/\s]+)+(?:\/[^\s)\]>"']*)?/i],
  ['脱敏占位符', /ph_(?:REAL_NAME|EMAIL|PHONE|TOKEN|ID)_\d+_ph/i],
  ['疑似访问令牌', /\b(?:Bearer\s+[A-Za-z0-9._-]{16,}|sk-[A-Za-z0-9_-]{16,})\b/],
  ['私有文件路径', /\/(?:Users|home)\/[^/\s]+\//],
  ['飞书内部资源链接', /(?:https?:\/\/[^/\s]*(?:larkoffice\.com|feishu\.cn)|feishu:\/\/)/i],
  ['未转换的飞书画板', /<whiteboard\b/i],
];

// 组织专属规则只存本机 .git 目录，避免审计器本身泄露内部标识。
const localConfigPath = path.join('.git', 'push-secret-guard.local.json');
if (fs.existsSync(localConfigPath)) {
  const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
  for (const item of localConfig.patterns || []) {
    if (!item.label || !item.regex) continue;
    blockedPatterns.push([
      item.label,
      new RegExp(item.regex, (item.flags || 'i').replaceAll('g', '')),
    ]);
  }
}

const files = [];

function collect(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (/\.(?:astro|json|md|mdx|js|ts)$/.test(entry.name)) files.push(fullPath);
  }
}

roots.forEach(collect);

const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of blockedPatterns) {
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
  if (!file.startsWith(`src${path.sep}content${path.sep}`)) continue;
  for (const match of content.matchAll(/!\[[^\]]*\]\((\/(?:assets|images)\/[^)\s]+)\)/g)) {
    const asset = path.join('public', decodeURIComponent(match[1]));
    if (!fs.existsSync(asset)) findings.push(`${file}: 缺失图片 ${match[1]}`);
  }
}

if (findings.length) {
  console.error('Public content audit failed:\n' + findings.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Public content audit passed (${files.length} files).`);
