import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outputFlag = args.indexOf('--output');
const outputDir = outputFlag >= 0 ? args[outputFlag + 1] : '';

if (!outputDir) {
  console.error('Usage: node scripts/build-algorithm-embeds.mjs --output <directory>');
  process.exit(2);
}

const data = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/learning/algorithms.json'), 'utf8')
);
const visualizerCss = fs.readFileSync(
  path.join(root, 'src/styles/algorithm-visualizer.css'),
  'utf8'
);
const rendererSource = fs.readFileSync(
  path.join(root, 'src/scripts/learning/algorithm-renderer.mjs'),
  'utf8'
);

const target = path.resolve(outputDir);
fs.mkdirSync(target, { recursive: true });

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll('</', '<\\/');
}

function slug(number) {
  return String(number).padStart(2, '0');
}

function embedProblem(problem) {
  return {
    number: problem.number,
    id: problem.id,
    title: problem.title,
    lc: problem.lc,
    difficulty: problem.difficulty,
    pattern: problem.pattern,
    core: problem.core,
    lens: problem.lens,
    exampleInput: problem.exampleInput,
    expected: problem.expected,
    family: problem.family,
    runner: {
      entry: problem.runner.entry,
    },
    visual: problem.visual,
    tips: problem.tips,
    steps: problem.steps,
  };
}

function buildHtml(sourceProblem) {
  const problem = embedProblem(sourceProblem);
  const marker = `iloop-algo-${slug(problem.number)}-lc-${String(problem.lc).replace('/', '-')}`;
  return `<!DOCTYPE html>
<html lang="zh-CN" data-learning-host="lark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${problem.title} · 算法思路训练场</title>
<style>
:root {
  color-scheme: dark;
  --bg: #030303;
  --surface: #090909;
  --ink: #eef0f6;
  --ink-dim: #aaa7a2;
  --ink-faint: #66635f;
  --line: rgba(255,255,255,.09);
  --accent: #f5b971;
  --learn-blue: #72a7ff;
  --learn-green: #65d6a6;
  --learn-red: #ff7d72;
  --learn-purple: #b99bff;
  --learn-gold: #f5b971;
  --learn-gold-strong: #ffc57d;
  --learn-gold-ink: #20160b;
  --learn-panel: #0b0c0f;
  --learn-panel-hi: #111318;
  --learn-control: #171a20;
  --learn-rule: rgba(255,255,255,.2);
  --sans: -apple-system, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif;
  --mono: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; letter-spacing: 0; }
html, body { width: 100%; height: 720px; margin: 0; overflow: hidden; background: var(--bg); color: var(--ink); font-family: var(--sans); }
${visualizerCss}
.algorithm-embed { height: 720px; padding: 14px; background: #030303; }
.algorithm-embed__head { display:flex; min-height:62px; padding:0 4px 12px; align-items:center; justify-content:space-between; gap:16px; }
.algorithm-embed__head div { min-width:0; }
.algorithm-embed__head span { color:var(--learn-gold); font:10px var(--mono); }
.algorithm-embed__head h1 { margin:5px 0 0; overflow:hidden; font-size:20px; text-overflow:ellipsis; white-space:nowrap; }
.algorithm-embed__head p { max-width:48%; margin:0; color:var(--ink-dim); font-size:12px; line-height:1.5; text-align:right; }
.algorithm-embed .algorithm-instrument { box-shadow:none; }
.algorithm-embed .algorithm-stage__canvas { min-height:276px; }
.algorithm-embed .algorithm-instrument__head { min-height:70px; }
.algorithm-embed .algorithm-instrument__foot { min-height:78px; }
</style>
</head>
<body>
<div class="algorithm-embed" data-iloop-algorithm-id="${marker}">
  <header class="algorithm-embed__head">
    <div>
      <span>${problem.difficulty.toUpperCase()} · LC ${problem.lc} · ${problem.pattern}</span>
      <h1>${problem.title}</h1>
    </div>
    <p>${problem.core}</p>
  </header>
  <div id="algorithm-embed-root"></div>
</div>
<script type="module">
${rendererSource}
const problem = ${escapeScriptJson(problem)};
mountAlgorithmVisualizer(document.getElementById('algorithm-embed-root'), problem, {
  host: 'embed',
  playInterval: 1300,
});
</script>
</body>
</html>
`;
}

const manifest = [];
for (const problem of data.problems) {
  const html = buildHtml(problem);
  const filename = `${slug(problem.number)}.html`;
  fs.writeFileSync(path.join(target, filename), html);
  manifest.push({
    number: problem.number,
    title: problem.title,
    filename,
    bytes: Buffer.byteLength(html),
    marker: `iloop-algo-${slug(problem.number)}-lc-${String(problem.lc).replace('/', '-')}`,
    sha256: crypto.createHash('sha256').update(html).digest('hex'),
  });
}

fs.writeFileSync(
  path.join(target, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(JSON.stringify({
  output: target,
  count: manifest.length,
  maxBytes: Math.max(...manifest.map((item) => item.bytes)),
}));
