export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(value, digits = 1) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
  }).format(value);
}

export function softmax(values, temperature = 1) {
  const safeTemperature = Math.max(temperature, 0.0001);
  const scaled = values.map((value) => value / safeTemperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function estimateJourney(inputTokens, outputTokens) {
  const input = clamp(Number(inputTokens) || 0, 1, 131072);
  const output = clamp(Number(outputTokens) || 0, 1, 4096);
  const ttftMs = 110 + Math.pow(input, 0.72) * 1.6;
  const tps = clamp(52 - Math.log2(input + 1) * 1.65, 12, 48);
  const decodeMs = (output / tps) * 1000;
  return {
    input,
    output,
    ttftMs,
    tps,
    decodeMs,
    totalMs: ttftMs + decodeMs,
  };
}

const commonMerges = [
  'token',
  'ization',
  '天气',
  '今天',
  '模型',
  '学习',
  'ing',
  'tion',
  'Swift',
  'func',
];

export function toyTokenize(text, mergeLevel = 3) {
  const source = String(text || '').trim();
  if (!source) return [];
  let tokens = Array.from(source).filter((char) => char.trim());
  const merges = commonMerges.slice(0, clamp(Number(mergeLevel) || 0, 0, commonMerges.length));

  for (const merge of merges) {
    const next = [];
    for (let index = 0; index < tokens.length; index += 1) {
      let candidate = '';
      let end = index;
      while (end < tokens.length && candidate.length < merge.length) {
        candidate += tokens[end];
        end += 1;
      }
      if (candidate === merge) {
        next.push(merge);
        index = end - 1;
      } else {
        next.push(tokens[index]);
      }
    }
    tokens = next;
  }
  return tokens;
}

export function trainingState(step, learningRate) {
  const safeStep = clamp(Number(step) || 0, 0, 40);
  const lr = clamp(Number(learningRate) || 0.1, 0.01, 1.2);
  const stableRate = Math.min(lr, 0.45);
  const overshoot = lr > 0.62 ? Math.sin(safeStep * lr * 2.2) * (lr - 0.62) * 0.55 : 0;
  const loss = clamp(2.8 * Math.exp(-safeStep * stableRate * 0.32) + overshoot, 0.03, 4);
  const probability = clamp(1 - loss / 3.1, 0.01, 0.98);
  return { step: safeStep, learningRate: lr, loss, probability };
}

export const embeddingPoints = {
  static: [
    { id: 'king', label: '国王', x: 68, y: 34, group: 'royal' },
    { id: 'queen', label: '皇后', x: 78, y: 19, group: 'royal' },
    { id: 'man', label: '男人', x: 24, y: 28, group: 'people' },
    { id: 'woman', label: '女人', x: 20, y: 45, group: 'people' },
    { id: 'cat', label: '猫', x: 77, y: 72, group: 'animal' },
    { id: 'dog', label: '狗', x: 84, y: 82, group: 'animal' },
    { id: 'beijing', label: '北京', x: 28, y: 78, group: 'place' },
    { id: 'tokyo', label: '东京', x: 19, y: 68, group: 'place' }
  ],
  contextual: [
    { id: 'apple-company', label: '苹果 · 公司', x: 74, y: 27, group: 'company' },
    { id: 'iphone', label: '手机', x: 84, y: 37, group: 'company' },
    { id: 'apple-fruit', label: '苹果 · 水果', x: 27, y: 70, group: 'food' },
    { id: 'strawberry', label: '草莓', x: 18, y: 80, group: 'food' },
    { id: 'release', label: '发布', x: 66, y: 18, group: 'company' },
    { id: 'eat', label: '吃', x: 38, y: 82, group: 'food' }
  ]
};

export function cosineFromPoints(first, second) {
  const ax = first.x - 50;
  const ay = first.y - 50;
  const bx = second.x - 50;
  const by = second.y - 50;
  const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!denominator) return 0;
  return clamp((ax * bx + ay * by) / denominator, -1, 1);
}

const attentionPresets = {
  pronoun: {
    tokens: ['猫', '追了', '狗', '它', '跑掉了'],
    scores: [
      [3.2, 0.8, 0.9, 0.2, 0.1],
      [1.6, 2.8, 2.0, 0.4, 0.3],
      [1.1, 1.7, 3.1, 0.6, 0.5],
      [1.1, 0.3, 4.2, 2.2, 0.4],
      [0.4, 0.6, 2.7, 2.2, 3.0]
    ]
  },
  invoice: {
    tokens: ['工程师', '填写', '报销单', '等待', '审批人'],
    scores: [
      [3.2, 2.2, 1.2, 0.4, 0.8],
      [2.4, 3.0, 2.8, 0.5, 1.0],
      [0.7, 1.4, 3.2, 0.8, 3.6],
      [0.5, 0.9, 1.8, 3.0, 2.9],
      [0.6, 1.0, 3.9, 1.8, 3.1]
    ]
  }
};

export function attentionState(presetId = 'pronoun', queryIndex = 3, causal = false, separated = true) {
  const preset = attentionPresets[presetId] || attentionPresets.pronoun;
  const index = clamp(Number(queryIndex) || 0, 0, preset.tokens.length - 1);
  let scores = preset.scores[index].slice();
  if (!separated) {
    scores = scores.map((score, otherIndex) => {
      const reverse = preset.scores[otherIndex]?.[index] ?? score;
      return (score + reverse) / 2;
    });
  }
  if (causal) {
    scores = scores.map((score, otherIndex) => otherIndex > index ? Number.NEGATIVE_INFINITY : score);
  }
  const weights = softmax(scores);
  return { tokens: preset.tokens, queryIndex: index, scores, weights };
}

export function kvCacheBytes({
  layers,
  kvHeads,
  headDim,
  bytesPerElement,
  tokens,
  batch = 1
}) {
  return 2 * layers * kvHeads * headDim * bytesPerElement * tokens * batch;
}

export function bytesToGiB(bytes) {
  return bytes / 1024 / 1024 / 1024;
}

export function patchBudget(resolution, patchSize, frames = 1) {
  const patchesPerSide = Math.ceil(resolution / patchSize);
  const patches = patchesPerSide * patchesPerSide;
  const visualTokens = patches * frames;
  return {
    resolution,
    patchSize,
    frames,
    patchesPerSide,
    patches,
    visualTokens,
    attentionPairs: visualTokens * visualTokens
  };
}

const reasoningBase = {
  math: 0.44,
  code: 0.52,
  writing: 0.76,
  facts: 0.68
};

export function reasoningBudget(task, paths, verifierReliability) {
  const base = reasoningBase[task] ?? 0.5;
  const count = clamp(Number(paths) || 1, 1, 12);
  const verifier = clamp(Number(verifierReliability) || 0.5, 0.2, 0.98);
  const coverage = 1 - Math.pow(1 - base, count);
  const selection = coverage * verifier + base * (1 - verifier);
  const openEndedPenalty = task === 'writing' ? Math.max(0, count - 3) * 0.018 : 0;
  return {
    base,
    paths: count,
    verifier,
    coverage,
    success: clamp(selection - openEndedPenalty, 0, 0.99),
    relativeCost: count
  };
}

export function weightBytes(parameterBillions, bitWidth) {
  return parameterBillions * 1e9 * bitWidth / 8;
}

const modelPresets = {
  '1.5': { label: '1.5B 教学模型', params: 1.5, layers: 28, kvHeads: 8, headDim: 128 },
  '7': { label: '7B 教学模型', params: 7, layers: 32, kvHeads: 8, headDim: 128 },
  '13': { label: '13B 教学模型', params: 13, layers: 40, kvHeads: 8, headDim: 128 },
  '70': { label: 'Llama 3.1 70B', params: 70, layers: 80, kvHeads: 8, headDim: 128 }
};

export function deviceFit({ deviceGiB, modelKey, bitWidth, context, kvBits = 16 }) {
  const model = modelPresets[String(modelKey)] || modelPresets['7'];
  const weightsGiB = bytesToGiB(weightBytes(model.params, bitWidth));
  const kvGiB = bytesToGiB(kvCacheBytes({
    layers: model.layers,
    kvHeads: model.kvHeads,
    headDim: model.headDim,
    bytesPerElement: kvBits / 8,
    tokens: context
  }));
  const runtimeGiB = Math.max(1.25, weightsGiB * 0.12);
  const totalGiB = weightsGiB + kvGiB + runtimeGiB;
  const ratio = totalGiB / deviceGiB;
  const status = ratio <= 0.82 ? 'fit' : ratio <= 0.98 ? 'tight' : 'overflow';
  return { model, weightsGiB, kvGiB, runtimeGiB, totalGiB, ratio, status };
}

export function mambaMemory(sequenceLength, retention = 0.7, hybridRatio = 0.1) {
  const length = clamp(Number(sequenceLength) || 1, 1, 1000000);
  const safeRetention = clamp(Number(retention) || 0.7, 0.05, 0.99);
  const hybrid = clamp(Number(hybridRatio) || 0, 0, 0.5);
  const transformerUnits = length;
  const mambaUnits = 96;
  const recall = clamp(
    Math.pow(safeRetention, Math.log10(length + 1) * 1.4) + hybrid * 0.72,
    0.05,
    0.99
  );
  return { length, transformerUnits, mambaUnits, recall, hybrid };
}

export function sampleTokens({ temperature, topK, topP, seed = 42, count = 8 }) {
  const tokens = ['确定', '可能', '也许', '大概', '似乎', '突然', '偏偏', '竟然'];
  const logits = [4.5, 3.8, 3.2, 2.7, 2.1, 1.3, 0.8, 0.2];
  const ranked = tokens.map((token, index) => ({ token, logit: logits[index] }))
    .slice(0, clamp(Number(topK) || tokens.length, 1, tokens.length));
  let probabilities = softmax(ranked.map((entry) => entry.logit), Number(temperature) || 0.01);
  let cumulative = 0;
  let cutoff = ranked.length;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += probabilities[index];
    if (cumulative >= topP) {
      cutoff = index + 1;
      break;
    }
  }
  const candidates = ranked.slice(0, cutoff);
  probabilities = softmax(candidates.map((entry) => entry.logit), Number(temperature) || 0.01);
  const random = seededRandom(seed);
  const samples = [];
  for (let draw = 0; draw < count; draw += 1) {
    const target = random();
    let total = 0;
    let selected = candidates[candidates.length - 1].token;
    for (let index = 0; index < candidates.length; index += 1) {
      total += probabilities[index];
      if (target <= total) {
        selected = candidates[index].token;
        break;
      }
    }
    samples.push(selected);
  }
  return {
    candidates: candidates.map((entry, index) => ({
      token: entry.token,
      probability: probabilities[index]
    })),
    samples
  };
}
