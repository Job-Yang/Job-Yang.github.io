import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TEXT_EXTENSIONS = new Set([
  '.astro',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yml',
  '.yaml',
]);
const IGNORED_FILES = new Set([
  'package-lock.json',
  'scripts/audit-public-content.mjs',
]);
const PRIVATE_PROJECTION_PATTERN = new RegExp([
  `\\b${['private', 'projection'].join('_')}\\b`,
  ['私有', '任务'].join(''),
  ['任务与验收', '回执'].join(''),
  ['宿主调度', '记录'].join(''),
  ['本机真实运行', '日志'].join(''),
].join('|'), 'i');
const HOST_EXECUTION_PATTERN = new RegExp(
  `\\b(?:${['spawn', 'list', 'wait']
    .map((action) => `${action}_${['ag', 'ent'].join('')}`)
    .join('|')})\\b`,
);
const BLOCKED_PATTERNS = [
  ['疑似内部链接', /https?:\/\/(?:[^/.\s]+\.)*(?:internal|intranet|corp|private)(?:\.[^/\s]+)+(?:\/[^\s)\]>"']*)?/i],
  ['脱敏占位符', /ph_(?:REAL_NAME|EMAIL|PHONE|TOKEN|ID)_\d+_ph/i],
  ['疑似访问令牌', /\b(?:Bearer\s+[A-Za-z0-9._-]{16,}|sk-[A-Za-z0-9_-]{16,})\b/],
  ['私有文件路径', /\/(?:Users|home|Volumes)\/[A-Za-z0-9._-]+\/(?![<])/],
  ['组织账号或消息标识', /\b(?:ou|oc|om)_[a-z0-9_-]{12,}\b/],
  ['未转换的飞书画板', /<whiteboard\b/i],
  ['内部工作流元数据', /^(?:source_id|review_required|migration_classification):/m],
  ['私有来源投影', PRIVATE_PROJECTION_PATTERN],
  ['内部运行产物路径', /\b(?:runtime-evidence|acceptance)\/[A-Za-z0-9._/-]+/i],
  ['内部样本版本号', /\brc\.\d+\b/i],
  ['宿主调度工具记录', HOST_EXECUTION_PATTERN],
  ['公开内容携带来源清单', /"(?:sourceSummary|sourceClass|sourceLabel)"\s*:/],
];

// Exact organization-only terms are stored as lowercase SHA-256 values so the
// public guard can reject them without republishing the terms in its own source.
const BLOCKED_TOKEN_HASHES = new Map([
  ['5d8b6f67702ce27d809993b201d6b0c5dcf77ba43d682a27fafb8ba6e939f142', '组织专属名词'],
  ['7fd9af62484204ed2418afeb6706fd21b7ff32e3a561c86a1e0a736721aeea22', '组织专属名词'],
  ['5388bc10736a0eff09be2ab9c8369a9c1cd14ef7916dafe4e177da6903aefdec', '组织专属域名'],
  ['f65b4875f5fd126aa79887f5d488d7065805d52fa17c2b63aaf5ba00fd1846fb', '组织专属域名'],
  ['89a2fc97c906d37f58d7cfb11d77b20e03e173f013031c6ed65577d2a4ef0ca6', '组织专属域名'],
  ['5ed0d740eb0d2ce6914f0f31415d8fc512dcaa579ff541bcc922459cde90e512', '组织专属域名'],
]);

function tokenHash(value) {
  return crypto.createHash('sha256').update(value.toLocaleLowerCase('en-US')).digest('hex');
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

export function scanText(content, file = '<memory>', extraPatterns = []) {
  const findings = [];
  for (const [label, pattern] of [...BLOCKED_PATTERNS, ...extraPatterns]) {
    const match = content.match(pattern);
    if (match) findings.push({ file, label, line: lineNumberAt(content, match.index ?? 0) });
  }

  for (const match of content.matchAll(/[\p{L}\p{N}_-]+/gu)) {
    const label = BLOCKED_TOKEN_HASHES.get(tokenHash(match[0]));
    if (label) findings.push({ file, label, line: lineNumberAt(content, match.index ?? 0) });
  }

  return findings;
}

function readLocalPatterns() {
  const localConfigPath = path.join('.git', 'push-secret-guard.local.json');
  if (!fs.existsSync(localConfigPath)) return [];
  const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
  return (localConfig.patterns || [])
    .filter((item) => item.label && item.regex)
    .map((item) => [
      item.label,
      new RegExp(item.regex, (item.flags || 'i').replaceAll('g', '')),
    ]);
}

function trackedTextFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' },
  );
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => !IGNORED_FILES.has(file))
    .filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function collectTextFiles(directory) {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectTextFiles(fullPath));
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

export function auditFiles(files, extraPatterns = []) {
  const findings = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const isBundledAsset = file.startsWith(`dist${path.sep}_astro${path.sep}`)
      && /\.(?:css|js)$/.test(file);
    findings.push(...scanText(content, file, isBundledAsset ? [] : extraPatterns));
    if (!file.startsWith(`src${path.sep}content${path.sep}`)) continue;
    for (const match of content.matchAll(/!\[[^\]]*\]\((\/(?:assets|images)\/[^)\s]+)\)/g)) {
      const asset = path.join('public', decodeURIComponent(match[1]));
      if (!fs.existsSync(asset)) {
        findings.push({
          file,
          label: `缺失图片 ${match[1]}`,
          line: lineNumberAt(content, match.index ?? 0),
        });
      }
    }
  }
  return findings;
}

export function runAudit({ includeDist = false } = {}) {
  const files = trackedTextFiles();
  if (includeDist) files.push(...collectTextFiles('dist'));
  const findings = auditFiles([...new Set(files)], readLocalPatterns());
  return { files, findings };
}

function main() {
  const includeDist = process.argv.includes('--include-dist');
  const { files, findings } = runAudit({ includeDist });
  if (findings.length) {
    const unique = [...new Set(findings.map(
      ({ file, label, line }) => `${file}:${line}: ${label}`,
    ))];
    console.error(`Public content audit failed:\n${unique.map((item) => `- ${item}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Public content audit passed (${files.length} files${includeDist ? ', including dist' : ''}).`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
