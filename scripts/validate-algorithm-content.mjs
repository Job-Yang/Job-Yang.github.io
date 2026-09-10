import fs from 'node:fs';
import path from 'node:path';
import { executeAlgorithmCode } from '../src/scripts/learning/algorithm-executor-core.mjs';

const root = process.cwd();
const dataPath = path.join(root, 'src/data/learning/algorithms.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const guide = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/learning/algorithm-pattern-guide.json'), 'utf8')
);
const failures = [];

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

requireValue(data.id === 'algorithm-microscope', 'course id must be algorithm-microscope');
requireValue(/^\d+\.\d+\.\d+$/.test(data.version), 'course version must use semver');
requireValue(data.problems.length === 61, `expected 61 problems, found ${data.problems.length}`);

const numbers = new Set();
const markers = new Set();
const families = new Set();
let stateFrames = 0;

for (const problem of data.problems) {
  requireValue(!numbers.has(problem.number), `duplicate problem number: ${problem.number}`);
  numbers.add(problem.number);
  families.add(problem.family);
  markers.add(`iloop-algo-${String(problem.number).padStart(2, '0')}`);

  for (const field of [
    'title',
    'lc',
    'difficulty',
    'pattern',
    'core',
    'lens',
    'exampleInput',
    'statement',
    'exampleText',
    'complexity',
    'tips',
    'hints',
    'constraints',
    'family',
    'visual',
    'solution',
    'runner',
  ]) {
    requireValue(problem[field] !== undefined && problem[field] !== '', `problem ${problem.number} missing ${field}`);
  }
  requireValue(Array.isArray(problem.steps) && problem.steps.length > 0, `problem ${problem.number} has no steps`);
  requireValue(problem.hints.length >= 2, `problem ${problem.number} needs progressive hints`);
  requireValue(problem.constraints.length >= 1, `problem ${problem.number} needs constraints`);
  requireValue(problem.solution.javascript.includes(problem.runner.entry), `problem ${problem.number} solution entry mismatch`);
  requireValue(problem.solution.starterCode.includes(problem.runner.entry), `problem ${problem.number} starter entry mismatch`);
  try {
    const execution = executeAlgorithmCode(problem.solution.javascript, problem.runner);
    requireValue(execution.passed, `problem ${problem.number} official solution failed its fixture`);
  } catch (error) {
    failures.push(`problem ${problem.number} official solution crashed: ${error.message}`);
  }
  stateFrames += problem.steps.length;

  for (const [index, step] of problem.steps.entries()) {
    for (const field of ['observation', 'decision', 'calculation', 'change', 'variables', 'view']) {
      requireValue(step[field] !== undefined, `problem ${problem.number} step ${index + 1} missing ${field}`);
    }
  }

  const results = problem.steps
    .map((step) => step.result)
    .filter((value) => value !== null && value !== undefined);
  requireValue(results.length > 0, `problem ${problem.number} has no final result`);
  requireValue(
    JSON.stringify(results.at(-1)) === JSON.stringify(problem.expected),
    `problem ${problem.number} final result does not match expected output`
  );
}

requireValue(
  [...numbers].sort((left, right) => left - right).join(',') === Array.from({ length: 61 }, (_, index) => index + 1).join(','),
  'problem numbers must be exactly 1..61'
);
requireValue(markers.size === 61, 'problem markers must be unique');
requireValue(families.size >= 12, `expected at least 12 visual families, found ${families.size}`);
requireValue(stateFrames >= 500, `expected at least 500 state frames, found ${stateFrames}`);

const patternIds = new Set(guide.patterns.map((pattern) => pattern.id));
requireValue(patternIds.size === guide.patterns.length, 'guide pattern ids must be unique');
requireValue(guide.patterns.length >= 15, `expected at least 15 guide patterns, found ${guide.patterns.length}`);
requireValue(guide.diagnosticOrder.length === 4, 'guide must keep the four-step diagnostic order');
requireValue(Boolean(guide.nodes.start), 'guide needs a start node');
for (const [nodeId, node] of Object.entries(guide.nodes)) {
  requireValue(node.options.length > 0, `guide node ${nodeId} has no options`);
  requireValue(Boolean(node.why), `guide node ${nodeId} is missing why`);
  for (const option of node.options) {
    requireValue(Boolean(option.hint), `guide node ${nodeId} option ${option.label} is missing hint`);
    requireValue(Boolean(option.meaning), `guide node ${nodeId} option ${option.label} is missing meaning`);
    requireValue(Boolean(option.eliminates), `guide node ${nodeId} option ${option.label} is missing eliminates`);
    if (option.next) {
      requireValue(Boolean(guide.nodes[option.next]), `guide node ${nodeId} points to missing node ${option.next}`);
    }
    for (const result of option.result || []) {
      requireValue(patternIds.has(result), `guide node ${nodeId} points to missing pattern ${result}`);
    }
  }
}
for (const pattern of guide.patterns) {
  requireValue(Boolean(pattern.signal), `guide pattern ${pattern.id} missing signal`);
  requireValue(Boolean(pattern.invariant), `guide pattern ${pattern.id} missing invariant`);
  requireValue(Boolean(pattern.reject), `guide pattern ${pattern.id} missing rejection rule`);
  for (const number of pattern.problems) {
    requireValue(numbers.has(number), `guide pattern ${pattern.id} references missing problem ${number}`);
  }
}

if (failures.length) {
  console.error(`Algorithm content validation failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Algorithm content valid: ${data.problems.length} problems, ${families.size} visual families, ${stateFrames} state frames.`
);
