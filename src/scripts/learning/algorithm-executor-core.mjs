export class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}

export class TreeNode {
  constructor(val = 0, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function listFromArray(values, cyclePosition = -1) {
  const nodes = values.map((value) => new ListNode(value));
  nodes.forEach((node, index) => {
    node.next = nodes[index + 1] || null;
  });
  if (nodes.length && cyclePosition >= 0) {
    nodes.at(-1).next = nodes[cyclePosition];
  }
  return nodes[0] || null;
}

function listToArray(head) {
  const result = [];
  const seen = new Set();
  while (head && result.length < 1000) {
    if (seen.has(head)) {
      result.push(`[cycle:${head.val}]`);
      break;
    }
    seen.add(head);
    result.push(head.val);
    head = head.next;
  }
  return result;
}

function treeFromLevelOrder(values) {
  if (!Array.isArray(values) || values.length === 0 || values[0] === null) return null;
  const root = new TreeNode(values[0]);
  const queue = [root];
  let index = 1;
  while (queue.length && index < values.length) {
    const node = queue.shift();
    const left = values[index++];
    if (left !== null && left !== undefined) {
      node.left = new TreeNode(left);
      queue.push(node.left);
    }
    const right = values[index++];
    if (right !== null && right !== undefined) {
      node.right = new TreeNode(right);
      queue.push(node.right);
    }
  }
  return root;
}

function treeToLevelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];
  while (queue.length && result.length < 2000) {
    const node = queue.shift();
    if (!node) {
      result.push(null);
      continue;
    }
    result.push(node.val);
    queue.push(node.left || null, node.right || null);
  }
  while (result.at(-1) === null) result.pop();
  return result;
}

function findTreeNode(root, value) {
  if (!root) return null;
  if (root.val === value) return root;
  return findTreeNode(root.left, value) || findTreeNode(root.right, value);
}

function prepareInput(runner, rawInput) {
  switch (runner.inputAdapter) {
    case 'list-first': {
      const args = clone(rawInput);
      args[0] = listFromArray(args[0]);
      return args;
    }
    case 'lists':
      return clone(rawInput).map((values) => listFromArray(values));
    case 'list-array-first': {
      const args = clone(rawInput);
      args[0] = args[0].map((values) => listFromArray(values));
      return args;
    }
    case 'cycle':
      return [listFromArray(rawInput.values, rawInput.pos)];
    case 'intersection': {
      const shared = listFromArray(clone(rawInput.shared));
      const attach = (prefix) => {
        const head = listFromArray(clone(prefix));
        if (!head) return shared;
        let tail = head;
        while (tail.next) tail = tail.next;
        tail.next = shared;
        return head;
      };
      return [attach(rawInput.a), attach(rawInput.b)];
    }
    case 'tree-first': {
      const args = clone(rawInput);
      args[0] = treeFromLevelOrder(args[0]);
      return args;
    }
    case 'lca': {
      const root = treeFromLevelOrder(clone(rawInput.tree));
      return [root, findTreeNode(root, rawInput.p), findTreeNode(root, rawInput.q)];
    }
    default:
      return clone(rawInput);
  }
}

function serializeOutput(output, args, adapter) {
  switch (adapter) {
    case 'first-arg':
      return args[0];
    case 'list':
      return listToArray(output);
    case 'tree':
      return treeToLevelOrder(output);
    case 'node-value':
      return output?.val ?? null;
    default:
      return output;
  }
}

function stableString(value) {
  return JSON.stringify(value);
}

function compare(actual, expected, mode) {
  if (mode === 'one-of') {
    return expected.some((candidate) => stableString(candidate) === stableString(actual));
  }
  if (mode === 'unordered' || mode === 'unordered-deep') {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    const left = actual.map(stableString).sort();
    const right = expected.map(stableString).sort();
    return stableString(left) === stableString(right);
  }
  return stableString(actual) === stableString(expected);
}

function compileTarget(code, entry) {
  if (!/^[A-Za-z_$][\w$]*$/.test(entry)) {
    throw new Error('非法入口函数名');
  }
  const factory = new Function(
    'ListNode',
    'TreeNode',
    `"use strict";\n${code}\nreturn typeof ${entry} !== "undefined" ? ${entry} : null;`
  );
  const target = factory(ListNode, TreeNode);
  if (typeof target !== 'function') {
    throw new Error(`没有找到入口 ${entry}`);
  }
  return target;
}

export function executeAlgorithmCode(code, runner, rawInput = runner.input) {
  const startedAt = performance.now();
  const Target = compileTarget(code, runner.entry);
  let actual;

  if (runner.kind === 'class') {
    const input = clone(rawInput);
    const instance = new Target(...(input.constructorArgs || []));
    actual = (input.operations || []).map(([method, args]) => {
      if (typeof instance[method] !== 'function') {
        throw new Error(`实例上没有方法 ${method}`);
      }
      const value = instance[method](...(args || []));
      return value === undefined ? null : value;
    });
  } else {
    const args = prepareInput(runner, rawInput);
    const output = Target(...args);
    actual = serializeOutput(output, args, runner.outputAdapter);
  }

  const elapsedMs = Math.max(0.01, performance.now() - startedAt);
  return {
    actual,
    expected: runner.expected,
    passed: compare(actual, runner.expected, runner.compare),
    elapsedMs,
  };
}
