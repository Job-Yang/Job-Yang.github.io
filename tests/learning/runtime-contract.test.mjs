import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const runtime = fs.readFileSync('src/scripts/learning/runtime.mjs', 'utf8');
const styles = fs.readFileSync('src/styles/learning.css', 'utf8');

const rendererNames = [
  'Journey',
  'Training',
  'Embedding',
  'Attention',
  'AttentionSystems',
  'Multimodal',
  'Reasoning',
  'Device',
  'Mamba',
  'Transformer',
  'ClientApi',
  'Reference'
];

function rendererBody(name, nextName) {
  const start = runtime.indexOf(`function render${name}(`);
  const end = nextName
    ? runtime.indexOf(`function render${nextName}(`, start)
    : runtime.indexOf('const renderers =', start);
  return runtime.slice(start, end);
}

test('every lesson renderer supplies state-driven causal explanation', () => {
  rendererNames.forEach((name, index) => {
    const body = rendererBody(name, rendererNames[index + 1]);
    assert.match(body, /setExplanation\(shell,/, `${name} lacks dynamic explanation`);
  });
});

test('shared lab explains action, mechanism, evidence and impact', () => {
  for (const field of ['action', 'mechanism', 'evidence', 'impact']) {
    assert.match(runtime, new RegExp(`data-cause-${field}`));
  }
});

test('journey keeps the reviewed weather prompt through the process lab', () => {
  const body = rendererBody('Journey', 'Training');
  assert.match(body, /今天天气怎么样？/);
  assert.match(body, /Tokenizer/);
  assert.match(body, /De-tokenize/);
});

test('sound is opt-in and motion has a reduced-motion fallback', () => {
  assert.match(runtime, /localStorage\.getItem\(SOUND_KEY\) === 'on'/);
  assert.match(runtime, /window\.AudioContext/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('client next-step action advances non-stream workflows', () => {
  const body = rendererBody('ClientApi', 'Reference');
  assert.match(body, /actionStep = Math\.min\(actionStep \+ 1, 3\)/);
  assert.match(body, /actionStep = \(actionStep \+ 1\) % 3/);
});

test('reference search includes the terms shown in its placeholder', () => {
  const body = rendererBody('Reference');
  assert.match(body, /title: 'KV Cache'/);
  assert.match(body, /placeholder="例如：KV Cache"/);
});

test('device renderer passes the model bit-width contract', () => {
  const body = rendererBody('Device', 'Mamba');
  const wrongParameter = ['bi', 'ts:'].join('');
  assert.match(body, /deviceFit\(\{ deviceGiB, modelKey, bitWidth, context \}\)/);
  assert.equal(body.includes(wrongParameter), false);
});
