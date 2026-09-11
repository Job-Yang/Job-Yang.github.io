import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { executeAlgorithmCode } from '../../src/scripts/learning/algorithm-executor-core.mjs';
import { transpileAlgorithmTypeScript } from '../../src/scripts/learning/algorithm-typescript.mjs';

const algorithms = JSON.parse(
  fs.readFileSync('src/data/learning/algorithms.json', 'utf8')
);
const patternGuide = JSON.parse(
  fs.readFileSync('src/data/learning/algorithm-pattern-guide.json', 'utf8')
);
const courseRuntime = fs.readFileSync(
  'src/scripts/learning/algorithm-course-runtime.mjs',
  'utf8'
);
const renderer = fs.readFileSync(
  'src/scripts/learning/algorithm-renderer.mjs',
  'utf8'
);
const styles = fs.readFileSync(
  'src/styles/algorithm-visualizer.css',
  'utf8'
);

test('algorithm catalog contains the complete ordered problem set', () => {
  assert.equal(algorithms.problems.length, 61);
  assert.deepEqual(
    algorithms.problems.map((problem) => problem.number),
    Array.from({ length: 61 }, (_, index) => index + 1)
  );
});

test('every problem has a verified final result and required teaching fields', () => {
  for (const problem of algorithms.problems) {
    assert.ok(problem.statement);
    assert.ok(problem.exampleText);
    assert.ok(problem.complexity);
    assert.ok(problem.hints.length >= 2);
    assert.ok(problem.constraints.length >= 1);
    assert.ok(problem.core);
    assert.ok(problem.lens);
    assert.ok(problem.tips);
    assert.equal(problem.solution.language, 'TypeScript');
    assert.ok(problem.solution.typescript.includes(problem.runner.entry));
    assert.ok(problem.solution.starterCode.includes(problem.runner.entry));
    assert.ok(problem.steps.length > 0);
    const finalResults = problem.steps
      .map((step) => step.result)
      .filter((value) => value !== null && value !== undefined);
    assert.deepEqual(finalResults.at(-1), problem.expected, `problem ${problem.number}`);
  }
});

test('catalog covers semantic visual families instead of one generic array view', () => {
  const families = new Set(algorithms.problems.map((problem) => problem.family));
  for (const family of [
    'array',
    'bars',
    'interval',
    'string',
    'stack',
    'linked',
    'tree',
    'decision',
    'grid',
    'dp',
    'graph',
    'heap',
  ]) {
    assert.ok(families.has(family), `missing ${family}`);
  }
});

test('course runtime supports durable practice workflows', () => {
  assert.match(courseRuntime, /localStorage\.setItem\(key/);
  assert.match(courseRuntime, /data-algorithm-search/);
  assert.match(courseRuntime, /data-algorithm-pattern/);
  assert.match(courseRuntime, /randomProblem/);
  assert.match(courseRuntime, /data-algorithm-mark/);
  assert.match(courseRuntime, /history\.replaceState/);
  assert.match(courseRuntime, /runAlgorithmCode/);
  assert.match(courseRuntime, /solution\.typescript/);
  assert.doesNotMatch(courseRuntime, /solution\.javascript/);
  assert.match(courseRuntime, /data-algorithm-hint-toggle/);
  assert.match(courseRuntime, /data-algorithm-content-tab/);
});

test('shared renderer exposes step, playback and quiz controls', () => {
  assert.match(renderer, /data-algo-previous/);
  assert.match(renderer, /data-algo-play/);
  assert.match(renderer, /data-algo-next/);
  assert.match(renderer, /data-algo-timeline/);
  assert.match(renderer, /data-algo-correct/);
  assert.match(renderer, /mountAlgorithmVisualizer/);
});

test('algorithm visuals use the existing learning design tokens', () => {
  for (const token of [
    '--learn-gold',
    '--learn-blue',
    '--learn-green',
    '--learn-panel',
    '--learn-control',
    '--learn-rule',
  ]) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('all official TypeScript solutions compile and run against their example fixture', () => {
  for (const problem of algorithms.problems) {
    const javascript = transpileAlgorithmTypeScript(problem.solution.typescript);
    const result = executeAlgorithmCode(javascript, problem.runner);
    assert.equal(result.passed, true, `problem ${problem.number}: ${problem.title}`);
  }
});

test('TypeScript runner accepts typed code and reports syntax errors with a line', () => {
  const javascript = transpileAlgorithmTypeScript(
    'function add(a: number, b: number): number { return a + b; }',
  );
  const result = executeAlgorithmCode(javascript, {
    kind: 'function',
    entry: 'add',
    input: [2, 3],
    expected: 5,
  });
  assert.equal(result.passed, true);
  assert.throws(
    () => transpileAlgorithmTypeScript('function add(a: number): number { return a;'),
    /TypeScript 编译失败：\n第 1 行/,
  );
});

test('pattern navigator is a closed decision graph with rejection rules', () => {
  const patterns = new Set(patternGuide.patterns.map((pattern) => pattern.id));
  assert.equal(algorithms.title, '算法思路训练场');
  assert.equal(patternGuide.title, '拿到一道新题，先怎么想');
  assert.equal(patternGuide.diagnosticOrder.length, 4);
  assert.ok(patternGuide.nodes.start);
  assert.ok(patterns.size >= 15);
  for (const [nodeId, node] of Object.entries(patternGuide.nodes)) {
    assert.ok(node.options.length > 0, nodeId);
    assert.ok(node.why, `${nodeId} needs a reason for the next question`);
    for (const option of node.options) {
      assert.ok(option.hint, `${nodeId} option needs a visible hint`);
      assert.ok(option.meaning, `${nodeId} option needs a decision meaning`);
      assert.ok(option.eliminates, `${nodeId} option needs an elimination reason`);
      if (option.next) assert.ok(patternGuide.nodes[option.next], `${nodeId} -> ${option.next}`);
      for (const result of option.result || []) {
        assert.ok(patterns.has(result), `${nodeId} -> ${result}`);
      }
    }
  }
  for (const pattern of patternGuide.patterns) {
    assert.ok(pattern.signal);
    assert.ok(pattern.invariant);
    assert.ok(pattern.reject);
  }
});
