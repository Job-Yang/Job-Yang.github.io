import fs from 'node:fs';
import path from 'node:path';
import {
  extractArticleSection,
  readArticleSections,
} from '../src/lib/learning/article-sections.mjs';

const root = process.cwd();
const manifestPath = path.join(root, 'src/data/learning/ai-foundations.json');
const duplicateStudyPath = path.join(root, 'src/data/learning/ai-foundations-study.json');
const articlePath = path.join(root, 'src/content/posts/写给客户端工程师的-ai-底层原理.md');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const article = fs.readFileSync(articlePath, 'utf8');
const failures = [];

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

requireValue(manifest.id === 'ai-foundations', 'course id must be ai-foundations');
requireValue(/^\d+\.\d+\.\d+$/.test(manifest.version), 'course version must use semver');
requireValue(manifest.lessons.length === 12, `expected 12 lessons, found ${manifest.lessons.length}`);
requireValue(
  !fs.existsSync(duplicateStudyPath),
  'course teaching copy must not be duplicated in ai-foundations-study.json'
);

const lessonIds = new Set();
const experimentIds = new Set();
const claimIds = new Set(manifest.claims.map((claim) => claim.id));

for (const claim of manifest.claims) {
  requireValue(Boolean(claim.statement), `claim ${claim.id} has no statement`);
  requireValue(Boolean(claim.sourceUrl), `claim ${claim.id} has no source`);
  requireValue(Boolean(claim.reviewedAt), `claim ${claim.id} has no reviewedAt`);
}

for (const lesson of manifest.lessons) {
  requireValue(!lessonIds.has(lesson.id), `duplicate lesson id: ${lesson.id}`);
  requireValue(!experimentIds.has(lesson.experimentId), `duplicate experiment id: ${lesson.experimentId}`);
  lessonIds.add(lesson.id);
  experimentIds.add(lesson.experimentId);

  for (const field of ['shortTitle', 'sourceAnchor']) {
    requireValue(Boolean(lesson[field]), `lesson ${lesson.id} missing ${field}`);
  }
  for (const field of ['title', 'question', 'thesis', 'misconception', 'primer', 'takeaway']) {
    requireValue(
      !(field in lesson),
      `lesson ${lesson.id} duplicates article content in ${field}`
    );
  }
  for (const field of ['instruction', 'target', 'successSignal']) {
    requireValue(Boolean(lesson.mission?.[field]), `lesson ${lesson.id} missing mission.${field}`);
  }
  requireValue(Array.isArray(lesson.controls) && lesson.controls.length > 0, `lesson ${lesson.id} has no controls`);
  requireValue(Array.isArray(lesson.observations) && lesson.observations.length > 0, `lesson ${lesson.id} has no observations`);
  requireValue(Array.isArray(lesson.checkpoint.options) && lesson.checkpoint.options.length >= 3, `lesson ${lesson.id} needs at least 3 checkpoint options`);
  requireValue(
    lesson.checkpoint.answer >= 0 && lesson.checkpoint.answer < lesson.checkpoint.options.length,
    `lesson ${lesson.id} has invalid checkpoint answer`
  );
  for (const claimId of lesson.claimIds) {
    requireValue(claimIds.has(claimId), `lesson ${lesson.id} references unknown claim ${claimId}`);
  }

  try {
    const section = extractArticleSection(lesson.sourceAnchor);
    requireValue(
      section.markdown.length > 0,
      `article section for lesson ${lesson.id} is empty`
    );
  } catch (error) {
    failures.push(`lesson ${lesson.id}: ${error.message}`);
  }
}

requireValue(
  readArticleSections().length === manifest.lessons.length,
  `article section count ${readArticleSections().length} does not match manifest ${manifest.lessons.length}`
);
const journeySection = extractArticleSection(
  manifest.lessons.find((lesson) => lesson.id === 'journey').sourceAnchor
);
requireValue(
  journeySection.markdown.includes('let reply = await llm.chat(prompt: "今天天气怎么样？")'),
  'journey article section must contain the reviewed weather API example'
);
requireValue(
  (journeySection.markdown.match(/^\d+\.\s+\*\*/gm) || []).length === 7,
  'journey article section must contain exactly seven numbered steps'
);
for (const required of ['Tokenizer', 'Embedding', '位置编码', 'Transformer', 'Softmax', '自回归', 'De-tokenize', 'Prefill', 'Decode']) {
  requireValue(journeySection.markdown.includes(required), `journey article section missing: ${required}`);
}

const articleExperiments = manifest.lessons
  .filter((lesson) => lesson.articlePlacement === 'expanded')
  .map((lesson) => lesson.experimentId);
requireValue(articleExperiments.length >= 6, `expected at least 6 article experiments, found ${articleExperiments.length}`);

const feishuExperiments = manifest.lessons.filter((lesson) => lesson.feishuPlacement);
requireValue(feishuExperiments.length === 6, `expected 6 Feishu experiments, found ${feishuExperiments.length}`);

for (const experimentId of articleExperiments) {
  const marker = `data-learning-experiment="${experimentId}"`;
  requireValue(article.includes(marker), `article is missing experiment marker: ${experimentId}`);
}

const markerCount = (article.match(/data-learning-experiment="/g) || []).length;
requireValue(markerCount === articleExperiments.length, `article marker count ${markerCount} does not match manifest ${articleExperiments.length}`);
requireValue(
  article.indexOf('这两个阶段的瓶颈完全不同') < article.indexOf('data-learning-experiment="journey"'),
  'journey experiment must appear after the Prefill/Decode explanation'
);
requireValue(
  article.indexOf('关键创新叫"选择性"') < article.indexOf('data-learning-experiment="mamba"'),
  'Mamba experiment must appear after the fixed-state and selective-state explanation'
);

const imagePaths = Array.from(
  article.matchAll(/!\[[^\]]*\]\((\/assets\/content\/写给客户端工程师的-ai-底层原理\/\d{2}-image\.webp)\)/g),
  (match) => match[1]
);
const legacyImageDir = path.join(
  root,
  'public/assets/content/写给客户端工程师的-ai-底层原理'
);
const legacyImages = fs.existsSync(legacyImageDir)
  ? fs.readdirSync(legacyImageDir).filter((name) => /^\d{2}-image\.webp$/.test(name))
  : [];
requireValue(
  imagePaths.length === 0,
  `legacy Feishu-derived images must not be referenced, found ${imagePaths.length}`
);
requireValue(
  legacyImages.length === 0,
  `legacy Feishu-derived images must not be published, found ${legacyImages.length}`
);

if (failures.length) {
  console.error(`Learning content validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Learning content valid: ${manifest.lessons.length} lessons sourced from the canonical article, ${manifest.claims.length} claims, ${markerCount} article embeds, no legacy raster images.`);
