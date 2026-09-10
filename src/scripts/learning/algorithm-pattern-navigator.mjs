import algorithms from '../../data/learning/algorithms.json';
import guide from '../../data/learning/algorithm-pattern-guide.json';

const PATTERN_GROUPS = {
  sequence: new Set([
    'hashing',
    'two-pointers',
    'sliding-window-fixed',
    'sliding-window-variable',
    'prefix-state',
    'intervals',
    'binary-search',
  ]),
  structure: new Set([
    'stack',
    'monotonic-stack',
    'linked-rewire',
    'heap',
    'design-composition',
  ]),
  'tree-graph': new Set([
    'bfs',
    'dfs',
    'topological-sort',
  ]),
  'search-optimize': new Set([
    'backtracking',
    'dp',
    'greedy',
    'binary-search',
    'heap',
  ]),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function initPatternNavigator(root, options = {}) {
  const patternMap = new Map(guide.patterns.map((pattern) => [pattern.id, pattern]));
  const problemMap = new Map(algorithms.problems.map((problem) => [problem.number, problem]));
  const elements = {
    step: root.querySelector('[data-pattern-step]'),
    question: root.querySelector('[data-pattern-question]'),
    description: root.querySelector('[data-pattern-description]'),
    context: root.querySelector('[data-pattern-context]'),
    contextChoice: root.querySelector('[data-pattern-context-choice]'),
    contextMeaning: root.querySelector('[data-pattern-context-meaning]'),
    contextWhy: root.querySelector('[data-pattern-context-why]'),
    contextEliminates: root.querySelector('[data-pattern-context-eliminates]'),
    breadcrumbs: root.querySelector('[data-pattern-breadcrumbs]'),
    options: root.querySelector('[data-pattern-options]'),
    results: root.querySelector('[data-pattern-results]'),
    reset: root.querySelector('[data-pattern-reset]'),
    continueButton: root.querySelector('[data-pattern-continue]'),
    groupButtons: Array.from(root.querySelectorAll('[data-pattern-group]')),
    cards: Array.from(root.querySelectorAll('[data-pattern-card]')),
  };
  let currentNode = 'start';
  let history = [];

  function openProblem(number) {
    options.onOpenProblem?.(number);
  }

  function bindProblemButtons(scope = root) {
    scope.querySelectorAll('[data-pattern-problem]').forEach((button) => {
      button.addEventListener('click', () => openProblem(Number(button.dataset.patternProblem)));
    });
  }

  function renderBreadcrumbs() {
    elements.breadcrumbs.innerHTML = history.map((item, index) => `
      <button type="button" data-pattern-history="${index}">
        <span>${String(index + 1).padStart(2, '0')}</span>
        ${escapeHtml(item.label)}
      </button>
    `).join('');
    elements.breadcrumbs.querySelectorAll('[data-pattern-history]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.patternHistory);
        const target = history[index];
        history = history.slice(0, index);
        currentNode = target.nodeId;
        renderNode();
      });
    });
  }

  function renderDecisionContext(whyOverride = '') {
    const last = history.at(-1);
    if (!last) {
      elements.context.hidden = true;
      return;
    }
    const nextNode = guide.nodes[currentNode];
    elements.contextChoice.textContent = last.label;
    elements.contextMeaning.textContent = last.meaning;
    elements.contextWhy.textContent = whyOverride || nextNode?.why || '现在检查候选思路是否真的满足条件。';
    elements.contextEliminates.textContent = last.eliminates;
    elements.context.hidden = false;
  }

  function resultCard(pattern) {
    const problems = pattern.problems
      .map((number) => problemMap.get(number))
      .filter(Boolean)
      .slice(0, 5);
    return `
      <article data-pattern-result="${pattern.id}">
        <header>
          <span>候选思路</span>
          <strong>${escapeHtml(pattern.name)}</strong>
        </header>
        <dl>
          <div><dt>为什么像</dt><dd>${escapeHtml(pattern.signal)}</dd></div>
          <div><dt>代码里守住什么</dt><dd>${escapeHtml(pattern.invariant)}</dd></div>
          <div><dt>什么情况会失效</dt><dd>${escapeHtml(pattern.reject)}</dd></div>
          <div><dt>动手前先记住</dt><dd>${escapeHtml(pattern.template)}</dd></div>
        </dl>
        <div>
          ${problems.map((problem) => `
            <button type="button" data-pattern-problem="${problem.number}">
              #${problem.number} ${escapeHtml(problem.title)}
            </button>
          `).join('')}
        </div>
      </article>
    `;
  }

  function renderResults(ids) {
    const patterns = ids.map((id) => patternMap.get(id)).filter(Boolean);
    elements.step.textContent = `判断完成 ${String(history.length).padStart(2, '0')} 步`;
    elements.question.textContent = patterns.length > 1 ? '先比较这几种候选思路' : '先验证这条候选思路';
    elements.description.textContent = '先看它为什么成立，再用失效条件反证。反证过不了，就退回上一步。';
    elements.options.innerHTML = '';
    elements.results.hidden = false;
    elements.results.innerHTML = `
      ${patterns.map(resultCard).join('')}
      <footer>
        <button type="button" data-pattern-back>返回上一步</button>
        <button type="button" data-pattern-restart>重新判断</button>
      </footer>
    `;
    renderDecisionContext('这条选择已经把范围缩到下面几种思路；现在要用失效条件确认它们是否真的成立。');
    elements.results.querySelector('[data-pattern-back]')?.addEventListener('click', () => {
      const last = history.pop();
      currentNode = last?.nodeId || 'start';
      renderNode();
    });
    elements.results.querySelector('[data-pattern-restart]')?.addEventListener('click', reset);
    bindProblemButtons(elements.results);
    renderBreadcrumbs();
  }

  function renderNode() {
    const node = guide.nodes[currentNode];
    if (!node) return;
    elements.step.textContent = `正在判断 ${String(history.length + 1).padStart(2, '0')}`;
    elements.question.textContent = node.title;
    elements.description.textContent = node.description;
    elements.results.hidden = true;
    elements.results.innerHTML = '';
    elements.options.innerHTML = node.options.map((option) => `
      <button
        type="button"
        data-pattern-option
        data-next="${option.next || ''}"
        data-result="${(option.result || []).join(',')}"
      >
        <strong>${escapeHtml(option.label)}</strong>
        <small>${escapeHtml(option.hint)}</small>
        <span>${option.next ? '继续缩小范围 →' : '查看候选思路 →'}</span>
      </button>
    `).join('');
    elements.options.querySelectorAll('[data-pattern-option]').forEach((button, index) => {
      button.addEventListener('click', () => {
        const option = node.options[index];
        history.push({
          nodeId: currentNode,
          label: option.label,
          meaning: option.meaning,
          eliminates: option.eliminates,
        });
        if (option.next) {
          currentNode = option.next;
          renderNode();
        } else {
          renderResults(option.result || []);
        }
      });
    });
    renderDecisionContext();
    renderBreadcrumbs();
  }

  function reset() {
    currentNode = 'start';
    history = [];
    elements.context.hidden = true;
    renderNode();
  }

  function setGroup(group) {
    elements.groupButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.patternGroup === group));
    });
    elements.cards.forEach((card) => {
      const visible = group === 'all' || PATTERN_GROUPS[group]?.has(card.dataset.patternCard);
      card.hidden = !visible;
    });
  }

  elements.reset.addEventListener('click', reset);
  elements.continueButton.addEventListener('click', () => options.onContinue?.());
  elements.groupButtons.forEach((button) => {
    button.addEventListener('click', () => setGroup(button.dataset.patternGroup));
  });
  bindProblemButtons();
  reset();
  setGroup('all');
}
