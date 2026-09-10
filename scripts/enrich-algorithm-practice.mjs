import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const sourceFlag = process.argv.indexOf('--source');
const sourcePath = sourceFlag >= 0
  ? process.argv[sourceFlag + 1]
  : '';
const targetPath = path.join(root, 'src/data/learning/algorithms.json');

if (!sourcePath) {
  console.error('Usage: node scripts/enrich-algorithm-practice.mjs --source <document-readback.json>');
  process.exit(2);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing source document: ${sourcePath}`);
  process.exit(2);
}

const course = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8')).data.document.content;
const sectionPattern = /^### (\d+)\. (.*?)(?=^### \d+\.|(?![\s\S]))/gms;
const sections = new Map(
  [...source.matchAll(sectionPattern)].map((match) => [Number(match[1]), match[2]])
);

const fixture = (entry, input, expected, options = {}) => ({
  kind: options.kind || 'function',
  entry,
  input,
  expected,
  inputAdapter: options.inputAdapter || 'plain',
  outputAdapter: options.outputAdapter || 'plain',
  compare: options.compare || 'exact',
  operations: options.operations,
  starterCode: options.starterCode,
});

const fixtures = {
  1: fixture('twoSum', [[2, 7, 11, 15], 9], [0, 1]),
  2: fixture('threeSum', [[-1, 0, 1, 2, -1, -4]], [[-1, -1, 2], [-1, 0, 1]], { compare: 'unordered-deep' }),
  3: fixture('maxSubArray', [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], 6),
  4: fixture('merge', [[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]),
  5: fixture('productExceptSelf', [[1, 2, 3, 4]], [24, 12, 8, 6]),
  6: fixture('maxArea', [[1, 8, 6, 2, 5, 4, 8, 3, 7]], 49),
  7: fixture('trap', [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], 6),
  8: fixture('moveZeroes', [[0, 1, 0, 3, 12]], [1, 3, 12, 0, 0], { outputAdapter: 'first-arg' }),
  9: fixture('lengthOfLongestSubstring', ['abcabcbb'], 3),
  10: fixture('findAnagrams', ['cbaebabacd', 'abc'], [0, 6]),
  11: fixture('minWindow', ['ADOBECODEBANC', 'ABC'], 'BANC'),
  12: fixture('longestPalindrome', ['babad'], ['bab', 'aba'], { compare: 'one-of' }),
  13: fixture('isValid', ['()[]{}'], true),
  14: fixture('decodeString', ['3[a2[c]]'], 'accaccacc'),
  15: fixture('reverseList', [[1, 2, 3, 4, 5]], [5, 4, 3, 2, 1], { inputAdapter: 'list-first', outputAdapter: 'list' }),
  16: fixture('detectCycle', { values: [3, 2, 0, -4], pos: 1 }, 2, { inputAdapter: 'cycle', outputAdapter: 'node-value' }),
  17: fixture('mergeTwoLists', [[1, 2, 4], [1, 3, 4]], [1, 1, 2, 3, 4, 4], { inputAdapter: 'lists', outputAdapter: 'list' }),
  18: fixture('removeNthFromEnd', [[1, 2, 3, 4, 5], 2], [1, 2, 3, 5], { inputAdapter: 'list-first', outputAdapter: 'list' }),
  19: fixture('getIntersectionNode', { a: ['A1', 'A2'], b: ['B1', 'B2', 'B3'], shared: ['C1', 'C2'] }, 'C1', { inputAdapter: 'intersection', outputAdapter: 'node-value' }),
  20: fixture('addTwoNumbers', [[2, 4, 3], [5, 6, 4]], [7, 0, 8], { inputAdapter: 'lists', outputAdapter: 'list' }),
  21: fixture('LRUCache', { constructorArgs: [2], operations: [['put', [1, 1]], ['put', [2, 2]], ['get', [1]], ['put', [3, 3]], ['get', [2]]] }, [null, null, 1, null, -1], {
    kind: 'class',
    starterCode: `class LRUCache {
  constructor(capacity) {
    // TODO
  }

  get(key) {
    // TODO
  }

  put(key, value) {
    // TODO
  }
}`,
  }),
  22: fixture('dailyTemperatures', [[73, 74, 75, 71, 69, 72, 76, 73]], [1, 1, 4, 2, 1, 1, 0, 0]),
  23: fixture('MinStack', { constructorArgs: [], operations: [['push', [-2]], ['push', [0]], ['push', [-3]], ['getMin', []], ['pop', []], ['top', []], ['getMin', []]] }, [null, null, null, -3, null, 0, -2], {
    kind: 'class',
    starterCode: `class MinStack {
  constructor() {
    // TODO
  }

  push(x) {}
  pop() {}
  top() {}
  getMin() {}
}`,
  }),
  24: fixture('inorderTraversal', [[1, null, 2, 3]], [1, 3, 2], { inputAdapter: 'tree-first' }),
  25: fixture('levelOrder', [[3, 9, 20, null, null, 15, 7]], [[3], [9, 20], [15, 7]], { inputAdapter: 'tree-first' }),
  26: fixture('maxDepth', [[3, 9, 20, null, null, 15, 7]], 3, { inputAdapter: 'tree-first' }),
  27: fixture('invertTree', [[4, 2, 7, 1, 3, 6, 9]], [4, 7, 2, 9, 6, 3, 1], { inputAdapter: 'tree-first', outputAdapter: 'tree' }),
  28: fixture('isSymmetric', [[1, 2, 2, 3, 4, 4, 3]], true, { inputAdapter: 'tree-first' }),
  29: fixture('lowestCommonAncestor', { tree: [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], p: 5, q: 1 }, 3, { inputAdapter: 'lca', outputAdapter: 'node-value' }),
  30: fixture('diameterOfBinaryTree', [[1, 2, 3, 4, 5]], 3, { inputAdapter: 'tree-first' }),
  31: fixture('maxPathSum', [[-10, 9, 20, null, null, 15, 7]], 42, { inputAdapter: 'tree-first' }),
  32: fixture('buildTree', [[3, 9, 20, 15, 7], [9, 3, 15, 20, 7]], [3, 9, 20, null, null, 15, 7], { outputAdapter: 'tree' }),
  33: fixture('isValidBST', [[5, 1, 4, null, null, 3, 6]], false, { inputAdapter: 'tree-first' }),
  34: fixture('rightSideView', [[1, 2, 3, null, 5, null, 4]], [1, 3, 4], { inputAdapter: 'tree-first' }),
  35: fixture('search', [[-1, 0, 3, 5, 9, 12], 9], 4),
  36: fixture('search', [[4, 5, 6, 7, 0, 1, 2], 0], 4),
  37: fixture('searchRange', [[5, 7, 7, 8, 8, 10], 8], [3, 4]),
  38: fixture('findPeakElement', [[1, 2, 1, 3, 5, 6, 4]], 5),
  39: fixture('permute', [[1, 2, 3]], [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]], { compare: 'unordered-deep' }),
  40: fixture('subsets', [[1, 2, 3]], [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]], { compare: 'unordered-deep' }),
  41: fixture('combinationSum', [[2, 3, 6, 7], 7], [[2, 2, 3], [7]], { compare: 'unordered-deep' }),
  42: fixture('generateParenthesis', [3], ['((()))', '(()())', '(())()', '()(())', '()()()'], { compare: 'unordered' }),
  43: fixture('exist', [[['A', 'B', 'C', 'E'], ['S', 'F', 'C', 'S'], ['A', 'D', 'E', 'E']], 'ABCCED'], true),
  44: fixture('climbStairs', [5], 8),
  45: fixture('rob', [[2, 7, 9, 3, 1]], 12),
  46: fixture('lengthOfLIS', [[10, 9, 2, 5, 3, 7, 101, 18]], 4),
  47: fixture('coinChange', [[1, 2, 5], 11], 3),
  48: fixture('longestCommonSubsequence', ['abcde', 'ace'], 3),
  49: fixture('minDistance', ['horse', 'ros'], 3),
  50: fixture('uniquePaths', [3, 7], 28),
  51: fixture('maxProfit', [[7, 1, 5, 3, 6, 4]], 5),
  52: fixture('canPartition', [[1, 5, 11, 5]], true),
  53: fixture('maximalSquare', [[['1', '0', '1', '0', '0'], ['1', '0', '1', '1', '1'], ['1', '1', '1', '1', '1'], ['1', '0', '0', '1', '0']]], 4),
  54: fixture('canJump', [[2, 3, 1, 1, 4]], true),
  55: fixture('jump', [[2, 3, 1, 1, 4]], 2),
  56: fixture('numIslands', [[['1', '1', '0', '0'], ['1', '0', '0', '1'], ['0', '0', '1', '1']]], 2),
  57: fixture('orangesRotting', [[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], 4),
  58: fixture('canFinish', [2, [[1, 0]]], true),
  59: fixture('findKthLargest', [[3, 2, 1, 5, 6, 4], 2], 5),
  60: fixture('topKFrequent', [[1, 1, 1, 2, 2, 3], 2], [1, 2], { compare: 'unordered' }),
  61: fixture('mergeKLists', [[[1, 4, 5], [1, 3, 4], [2, 6]]], [1, 1, 2, 3, 4, 4, 5, 6], { inputAdapter: 'list-array-first', outputAdapter: 'list' }),
};

const familyHints = {
  array: '先明确当前下标、已处理区间和仍未确定的范围分别是什么。',
  bars: '先把题目要求的长度、高度或面积直接写成公式，再决定移动哪一边。',
  interval: '排序后只盯住最后一个已经合并的区间。',
  string: '窗口右边负责纳入，左边只在约束被破坏或已经满足时移动。',
  stack: '问自己：什么信息必须按“最近一次”或“最旧一次”的顺序取出？',
  linked: '每次改 next 之前，先确认后继节点是否已经保存。',
  tree: '先定义递归函数向父节点返回什么，再考虑当前节点怎么组合左右结果。',
  decision: '把一轮固定成选择、递归、撤销，并写清哪些分支可以提前剪掉。',
  grid: '明确访问标记、扩展方向，以及同一格能不能被当前路径重复使用。',
  dp: '先写出 dp 状态含义，再指出当前格依赖哪几个已知状态。',
  graph: '先确认边的方向，再决定用入度、队列还是访问状态判断环。',
  heap: '先确定堆里只保留哪些候选，以及堆顶为什么正好是下一步要处理的对象。',
};

const familyComplexity = {
  array: '按当前解法通常为 O(n)，以代码中的扫描次数为准。',
  bars: '按当前解法通常为 O(n)。',
  interval: '排序 O(n log n)，扫描 O(n)。',
  string: '以窗口或中心扩展次数为准。',
  stack: '通常为 O(n)，每个元素至多进出结构一次。',
  linked: '通常为 O(n)，额外空间 O(1)。',
  tree: '时间 O(n)，递归栈空间 O(h)。',
  decision: '取决于搜索树规模，空间为递归深度。',
  grid: '时间与网格规模及搜索分支相关。',
  dp: '时间与状态数量相同，空间取决于状态表。',
  graph: '时间 O(V + E)，空间 O(V + E)。',
  heap: '单次堆操作 O(log k)。',
};

function cleanMarkdown(value = '') {
  return value
    .replaceAll('\\[', '[')
    .replaceAll('\\]', ']')
    .replaceAll('**', '')
    .replaceAll('`', '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extract(section, pattern, fallback = '') {
  return cleanMarkdown(section.match(pattern)?.[1] || fallback);
}

function transpile(sourceCode) {
  const output = ts.transpileModule(sourceCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
    },
  }).outputText;
  return output.replace(/^"use strict";\s*/, '').trim();
}

function starterFrom(solutionCode, runner) {
  if (runner.starterCode) return runner.starterCode;
  const escaped = runner.entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = solutionCode.match(new RegExp(`function\\s+${escaped}\\s*\\([^)]*\\)`));
  if (!match) return `function ${runner.entry}() {\n  // TODO: 完成你的解法\n}`;
  return `${match[0]} {\n  // TODO: 完成你的解法\n  throw new Error("TODO");\n}`;
}

function relatedLine(code, explanation, previous = 1) {
  const lines = code.split('\n');
  const ignored = new Set(['const', 'let', 'var', 'return', 'if', 'else', 'while', 'for', 'function', 'new', 'true', 'false']);
  const tokens = [...String(explanation || '').matchAll(/[A-Za-z_$][\w$]*|\d+/g)]
    .map((match) => match[0].toLowerCase())
    .filter((token) => !ignored.has(token));
  let bestLine = previous;
  let bestScore = 0;
  lines.forEach((line, index) => {
    const normalized = line.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (normalized.includes(token) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestLine = index + 1;
    }
  });
  return bestLine;
}

if (sections.size !== 61) {
  throw new Error(`Expected 61 source sections, found ${sections.size}`);
}

for (const problem of course.problems) {
  const section = sections.get(problem.number);
  const runner = fixtures[problem.number];
  if (!section || !runner) throw new Error(`Missing source or fixture for problem ${problem.number}`);

  const typescript = section.match(/```TypeScript\n(.*?)\n```/s)?.[1]?.trim();
  if (!typescript) throw new Error(`Missing TypeScript solution for problem ${problem.number}`);
  const javascript = transpile(typescript);
  let previousLine = 1;

  problem.statement = extract(section, /> \*\*题目描述\*\*:(.*?)(?=\n> 示例:)/s);
  problem.exampleText = extract(section, /> 示例:(.*?)(?=\n\n)/s);
  problem.complexity = extract(
    section,
    /- \*\*复杂度\*\*:(.*)/,
    familyComplexity[problem.family]
  );
  problem.constraints = [
    '输入满足题目给出的类型与取值约束。',
    `边界提醒：${problem.tips}`,
  ];
  problem.hints = [
    familyHints[problem.family],
    problem.core,
    problem.tips,
  ];
  problem.solution = {
    entry: runner.entry,
    language: 'JavaScript',
    typescript,
    javascript,
    starterCode: starterFrom(javascript, runner),
    explanation: problem.core,
  };
  problem.runner = runner;
  problem.steps = problem.steps.map((step) => {
    const line = relatedLine(javascript, step.code || `${step.decision} ${step.calculation}`, previousLine);
    previousLine = line;
    return { ...step, solutionLine: line };
  });
}

course.version = '2.0.0';
fs.writeFileSync(targetPath, `${JSON.stringify(course, null, 2)}\n`);
console.log(JSON.stringify({
  target: targetPath,
  problems: course.problems.length,
  statements: course.problems.filter((problem) => problem.statement).length,
  solutions: course.problems.filter((problem) => problem.solution?.javascript).length,
  runners: course.problems.filter((problem) => problem.runner).length,
}));
