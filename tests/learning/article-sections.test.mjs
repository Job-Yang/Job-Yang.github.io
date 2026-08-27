import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  extractArticleSection,
  readArticleSections,
  renderArticleSection,
} from '../../src/lib/learning/article-sections.mjs';

const course = JSON.parse(
  fs.readFileSync('src/data/learning/ai-foundations.json', 'utf8'),
);

test('every lesson maps to exactly one canonical article section', () => {
  assert.equal(readArticleSections().length, course.lessons.length);

  for (const lesson of course.lessons) {
    const section = extractArticleSection(lesson.sourceAnchor);
    assert.ok(section.markdown.length > 0, `${lesson.id} section is empty`);
  }
});

test('heading matching tolerates straight and curly quotes', () => {
  const section = extractArticleSection('先读这一节：模型是怎么“学会”的');
  assert.equal(section.title, '先读这一节：模型是怎么"学会"的');
});

test('journey reuses the reviewed weather example and seven-step explanation', () => {
  const section = extractArticleSection('序章：一次 API 调用里发生了什么');
  const numberedSteps = section.markdown.match(/^\d+\.\s+\*\*/gm) ?? [];

  assert.match(
    section.markdown,
    /let reply = await llm\.chat\(prompt: "今天天气怎么样？"\)/,
  );
  assert.equal(numberedSteps.length, 7);
  assert.match(section.markdown, /\*\*Prefill\*\*/);
  assert.match(section.markdown, /\*\*Decode\*\*/);
});

test('course rendering removes only the article experiment mount point', async () => {
  const section = await renderArticleSection(
    '序章：一次 API 调用里发生了什么',
  );

  assert.doesNotMatch(section.html, /data-learning-experiment/);
  assert.match(section.html, /今天天气怎么样/);
  assert.match(section.html, /<ol>/);
});
