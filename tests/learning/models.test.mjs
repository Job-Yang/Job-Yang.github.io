import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attentionState,
  bytesToGiB,
  deviceFit,
  estimateJourney,
  kvCacheBytes,
  mambaMemory,
  patchBudget,
  reasoningBudget,
  sampleTokens,
  softmax,
  toyTokenize,
  trainingState
} from '../../src/scripts/learning/models.mjs';

test('softmax returns a normalized distribution', () => {
  const values = softmax([1, 2, 3]);
  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
  assert.ok(values[2] > values[1]);
  assert.ok(values[1] > values[0]);
});

test('journey separates input-sensitive TTFT from output-sensitive decode time', () => {
  const shortInput = estimateJourney(512, 128);
  const longInput = estimateJourney(8192, 128);
  const longOutput = estimateJourney(512, 512);
  assert.ok(longInput.ttftMs > shortInput.ttftMs);
  assert.ok(longOutput.decodeMs > shortInput.decodeMs);
});

test('toy tokenizer merges known frequent pieces', () => {
  const granular = toyTokenize('tokenization', 0);
  const merged = toyTokenize('tokenization', 4);
  assert.ok(merged.length < granular.length);
  assert.deepEqual(merged, ['token', 'ization']);
});

test('stable training steps reduce loss', () => {
  assert.ok(trainingState(12, 0.2).loss < trainingState(1, 0.2).loss);
});

test('causal attention removes future positions', () => {
  const state = attentionState('pronoun', 2, true, true);
  assert.equal(state.weights[3], 0);
  assert.equal(state.weights[4], 0);
  assert.ok(Math.abs(state.weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
});

test('Llama 3.1 70B teaching KV formula uses 8 KV heads', () => {
  const bytes = kvCacheBytes({
    layers: 80,
    kvHeads: 8,
    headDim: 128,
    bytesPerElement: 2,
    tokens: 128000
  });
  assert.equal(bytes, 41943040000);
  assert.equal(bytesToGiB(bytes), 39.0625);
});

test('halving both image dimensions quarters patch count', () => {
  const large = patchBudget(1024, 16, 1);
  const small = patchBudget(512, 16, 1);
  assert.equal(large.patches, 4096);
  assert.equal(small.patches, 1024);
});

test('reasoning teaching model responds to verifier reliability', () => {
  const weak = reasoningBudget('math', 8, 0.3);
  const strong = reasoningBudget('math', 8, 0.9);
  assert.ok(strong.success > weak.success);
});

test('device fit includes weights, KV cache and runtime reserve', () => {
  const fit = deviceFit({
    deviceGiB: 16,
    modelKey: '7',
    bitWidth: 4,
    context: 32768
  });
  assert.ok(fit.totalGiB > fit.weightsGiB + fit.kvGiB);
  assert.equal(fit.status, 'fit');
});

test('Mamba teaching state remains fixed while Transformer history grows', () => {
  const short = mambaMemory(4096, 0.7, 0.1);
  const long = mambaMemory(131072, 0.7, 0.1);
  assert.ok(long.transformerUnits > short.transformerUnits);
  assert.equal(long.mambaUnits, short.mambaUnits);
});

test('sampling is deterministic with a fixed seed', () => {
  const first = sampleTokens({ temperature: 0.8, topK: 5, topP: 0.9, seed: 42 });
  const second = sampleTokens({ temperature: 0.8, topK: 5, topP: 0.9, seed: 42 });
  assert.deepEqual(first, second);
});
