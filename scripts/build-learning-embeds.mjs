import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, transform } from 'esbuild';

const root = process.cwd();
const outputArg = process.argv[2];
const outputDir = path.resolve(outputArg || path.join(os.tmpdir(), 'ai-foundations-embeds'));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/learning/ai-foundations.json'), 'utf8')
);
const rawCss = fs.readFileSync(path.join(root, 'src/styles/learning.css'), 'utf8');
const css = (await transform(rawCss, {
  loader: 'css',
  minify: true,
  target: ['es2020']
})).code;

const heightByExperiment = {
  journey: 660,
  attention: 660,
  'attention-systems': 660,
  multimodal: 700,
  'on-device': 680,
  'client-api': 720
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function buildRuntime(lesson) {
  const embedCourse = {
    id: manifest.id,
    version: manifest.version,
    lessons: manifest.lessons.map((item) => item.id === lesson.id
      ? item
      : {
          id: item.id,
          order: item.order,
          number: item.number,
          shortTitle: item.shortTitle
        })
  };
  const result = await build({
    entryPoints: [path.join(root, 'src/scripts/learning/runtime.mjs')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    minify: true,
    write: false,
    target: ['es2020'],
    plugins: [{
      name: 'single-lesson-manifest',
      setup(builder) {
        builder.onResolve({ filter: /ai-foundations\.json$/ }, () => ({
          path: 'embed-course',
          namespace: 'embed-course'
        }));
        builder.onLoad({ filter: /.*/, namespace: 'embed-course' }, () => ({
          contents: `export default ${JSON.stringify(embedCourse)};`,
          loader: 'js'
        }));
      }
    }]
  });
  return result.outputFiles[0].text;
}

fs.mkdirSync(outputDir, { recursive: true });
const artifacts = [];

for (const lesson of manifest.lessons.filter((item) => item.feishuPlacement)) {
  const frameHeight = heightByExperiment[lesson.experimentId] || 560;
  const runtime = await buildRuntime(lesson);
  const html = `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(lesson.shortTitle)} · ${escapeHtml(manifest.title)}</title>
<style>
:root{color-scheme:dark;--bg:#030303;--surface:#090909;--ink:#eef0f6;--ink-dim:#aaa7a2;--ink-faint:#66635f;--line:rgba(255,255,255,.09);--accent:#f5b971;--serif:"Songti SC","STSong","Noto Serif SC",serif;--sans:-apple-system,"SF Pro Text","PingFang SC","Helvetica Neue",sans-serif;--mono:"SF Mono","JetBrains Mono",ui-monospace,monospace}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:${frameHeight}px;overflow:hidden;background:#030303;font-family:var(--sans)}body{padding:8px}.learning-experiment{margin:0!important}
${css}
html[data-learning-host="lark"] .learning-widget__head{display:none}
html[data-learning-host="lark"] .learning-mission{min-height:106px;padding:14px 18px;grid-template-columns:44px minmax(0,1fr) auto;gap:14px}
html[data-learning-host="lark"] .learning-mission__index{width:42px;height:42px}
html[data-learning-host="lark"] .learning-mission strong{font-size:16px}
html[data-learning-host="lark"] .learning-mission p{font-size:14px}
html[data-learning-host="lark"] .learning-mission small{display:none}
html[data-learning-host="lark"] .learning-start{min-width:120px;min-height:46px}
html[data-learning-host="lark"] .learning-panel-heading{min-height:58px;padding:10px 16px}
html[data-learning-host="lark"] .learning-control-panel{border-right:1px solid var(--learn-rule);border-bottom:0}
html[data-learning-host="lark"] .learning-controls{display:flex;padding:16px;gap:12px}
html[data-learning-host="lark"] .learning-controls>.learning-segmented,html[data-learning-host="lark"] .learning-controls>.learning-command{grid-column:auto}
html[data-learning-host="lark"] .learning-stage{min-height:272px;padding:18px}
html[data-learning-host="lark"] .learning-lab{min-height:330px;grid-template-columns:minmax(250px,.34fr) minmax(0,1fr)}
html[data-learning-host="lark"] .learning-result{min-height:92px;padding:14px 18px;grid-template-columns:1fr}
html[data-learning-host="lark"] .learning-result__why{display:none!important}
html[data-learning-host="lark"] .learning-article-foot{display:none}
</style>
<div class="learning-experiment" data-learning-experiment="${escapeHtml(lesson.id)}" data-mode="article">
  <div class="learning-fallback">
    <span>${escapeHtml(lesson.number)} · 互动实验</span>
    <strong>${escapeHtml(lesson.shortTitle)}</strong>
    <p>${escapeHtml(lesson.mission.target)}</p>
  </div>
</div>
<script>document.documentElement.dataset.learningHost='lark';</script>
<script>${runtime}</script>`;
  const filename = `${lesson.id}.html`;
  const target = path.join(outputDir, filename);
  fs.writeFileSync(target, html);
  artifacts.push({
    lessonId: lesson.id,
    experimentId: lesson.experimentId,
    filename,
    bytes: Buffer.byteLength(html),
    sha256: sha256(html),
    recommendedHeight: frameHeight
  });
}

const artifactManifest = {
  schema: 'AiFoundationsEmbeds:v1',
  courseVersion: manifest.version,
  generatedAt: new Date().toISOString(),
  artifacts
};
fs.writeFileSync(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify(artifactManifest, null, 2)}\n`
);

for (const artifact of artifacts) {
  console.log(`${artifact.lessonId}: ${artifact.bytes} bytes ${artifact.sha256.slice(0, 12)} height=${artifact.recommendedHeight}`);
}
console.log(`Built ${artifacts.length} embeds -> ${outputDir}`);
