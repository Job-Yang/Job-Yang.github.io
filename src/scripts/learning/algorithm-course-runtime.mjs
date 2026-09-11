import algorithms from '../../data/learning/algorithms.json';
import { runAlgorithmCode } from './algorithm-code-runner.mjs';
import { initPatternNavigator } from './algorithm-pattern-navigator.mjs';
import { mountAlgorithmVisualizer } from './algorithm-renderer.mjs';

const STORAGE_KEY = `learning:${algorithms.id}`;
const DRAFTS_KEY = `${STORAGE_KEY}:drafts`;
const DEFAULT_PROBLEM = 7;
const FAMILY_LABELS = {
  array: '数组 / 指针 / 贪心',
  bars: '面积 / 数值',
  interval: '区间',
  string: '字符串 / 滑窗',
  stack: '栈 / 缓存',
  linked: '链表',
  tree: '二叉树',
  decision: '回溯',
  grid: '网格搜索',
  dp: '动态规划',
  graph: '图 / 拓扑',
  heap: '堆 / Top K',
};

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is optional; the current session remains usable.
  }
}

function readProgress() {
  const value = readJson(STORAGE_KEY, {});
  return {
    version: algorithms.version,
    mastered: Array.isArray(value.mastered) ? value.mastered : [],
    started: Array.isArray(value.started) ? value.started : [],
    lastProblem: Number(value.lastProblem) || DEFAULT_PROBLEM,
  };
}

function problemHash(number) {
  return `#lc-${number}`;
}

function problemFromLocation() {
  const match = window.location.hash.match(/^#lc-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function displayValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function downloadProgress(progress) {
  const blob = new Blob([JSON.stringify(progress, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'algorithm-thinking-lab-progress.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function createCourse(root) {
  const problemMap = new Map(algorithms.problems.map((problem) => [problem.number, problem]));
  const elements = {
    list: root.querySelector('[data-algorithm-list]'),
    guideButton: root.querySelector('[data-algorithm-open-guide]'),
    guideView: root.querySelector('[data-algorithm-guide-view]'),
    practiceView: root.querySelector('[data-algorithm-practice-view]'),
    patternNavigator: root.querySelector('[data-pattern-navigator]'),
    search: root.querySelector('[data-algorithm-search]'),
    pattern: root.querySelector('[data-algorithm-pattern]'),
    filters: Array.from(root.querySelectorAll('[data-algorithm-filter]')),
    random: Array.from(root.querySelectorAll('[data-algorithm-random]')),
    mark: root.querySelector('[data-algorithm-mark]'),
    exportButton: root.querySelector('[data-algorithm-export]'),
    clearButton: root.querySelector('[data-algorithm-clear]'),
    progressValue: root.querySelector('[data-algorithm-progress-value]'),
    progressBar: root.querySelector('[data-algorithm-progress-bar]'),
    resultCount: root.querySelector('[data-algorithm-result-count]'),
    number: root.querySelector('[data-algorithm-number]'),
    title: root.querySelector('[data-algorithm-title]'),
    difficulty: root.querySelector('[data-algorithm-difficulty]'),
    patternValue: root.querySelector('[data-algorithm-pattern-value]'),
    stepCount: root.querySelector('[data-algorithm-step-count]'),
    contentTabs: Array.from(root.querySelectorAll('[data-algorithm-content-tab]')),
    contentPanels: Array.from(root.querySelectorAll('[data-algorithm-content-panel]')),
    problemHeading: root.querySelector('[data-algorithm-problem-heading]'),
    statement: root.querySelector('[data-algorithm-statement]'),
    example: root.querySelector('[data-algorithm-example]'),
    hintList: root.querySelector('[data-algorithm-hint-list]'),
    hintToggle: root.querySelector('[data-algorithm-hint-toggle]'),
    hintProgress: root.querySelector('[data-algorithm-hint-progress]'),
    constraints: root.querySelector('[data-algorithm-constraints]'),
    core: root.querySelector('[data-algorithm-core]'),
    complexity: root.querySelector('[data-algorithm-complexity]'),
    expected: root.querySelector('[data-algorithm-expected]'),
    copySolution: root.querySelector('[data-algorithm-copy-solution]'),
    solutionCode: root.querySelector('[data-algorithm-solution-code]'),
    linkedLine: root.querySelector('[data-algorithm-linked-line]'),
    visualizer: root.querySelector('[data-algorithm-visualizer-root]'),
    editor: root.querySelector('[data-algorithm-editor]'),
    editorLines: root.querySelector('[data-algorithm-editor-lines]'),
    resetCode: root.querySelector('[data-algorithm-reset-code]'),
    loadSolution: root.querySelector('[data-algorithm-load-solution]'),
    consoleTabs: Array.from(root.querySelectorAll('[data-algorithm-console-tab]')),
    consolePanels: Array.from(root.querySelectorAll('[data-algorithm-console-panel]')),
    testInput: root.querySelector('[data-algorithm-test-input]'),
    testExpected: root.querySelector('[data-algorithm-test-expected]'),
    run: root.querySelector('[data-algorithm-run]'),
    runStatus: root.querySelector('[data-algorithm-run-status]'),
    runSummary: root.querySelector('[data-algorithm-run-summary]'),
    actualOutput: root.querySelector('[data-algorithm-actual-output]'),
    expectedOutput: root.querySelector('[data-algorithm-expected-output]'),
    runTime: root.querySelector('[data-algorithm-run-time]'),
    runError: root.querySelector('[data-algorithm-run-error]'),
    openWalkthrough: root.querySelector('[data-algorithm-open-walkthrough]'),
  };

  let progress = readProgress();
  let drafts = readJson(DRAFTS_KEY, {});
  let currentNumber = problemMap.has(problemFromLocation())
    ? problemFromLocation()
    : problemMap.has(progress.lastProblem)
      ? progress.lastProblem
      : DEFAULT_PROBLEM;
  let filter = 'all';
  let hintCount = 0;
  let activeContent = 'problem';
  let activeConsole = 'case';
  let visualizer;
  let currentSolutionLine = 1;
  let currentProblem;

  const families = [...new Set(algorithms.problems.map((problem) => problem.family))];
  elements.pattern.innerHTML = `
    <option value="all">全部题型</option>
    ${families.map((family) => `<option value="${family}">${FAMILY_LABELS[family]}</option>`).join('')}
  `;

  function filteredProblems() {
    const keyword = elements.search.value.trim().toLowerCase();
    const pattern = elements.pattern.value;
    return algorithms.problems.filter((problem) => {
      if (filter === 'unmastered' && progress.mastered.includes(problem.number)) return false;
      if (filter === 'hard' && problem.difficulty !== 'Hard') return false;
      if (pattern !== 'all' && problem.family !== pattern) return false;
      if (!keyword) return true;
      return [
        problem.number,
        problem.title,
        problem.lc,
        problem.pattern,
        problem.core,
      ].join(' ').toLowerCase().includes(keyword);
    });
  }

  function stateLabel(problem) {
    if (progress.mastered.includes(problem.number)) return ['已掌握', 'completed'];
    if (progress.started.includes(problem.number)) return ['进行中', 'started'];
    return ['未开始', 'idle'];
  }

  function renderList() {
    const visible = filteredProblems();
    elements.resultCount.textContent = `${visible.length} 题`;
    elements.list.innerHTML = visible.map((problem) => {
      const [label, state] = stateLabel(problem);
      return `
        <button
          type="button"
          data-problem-number="${problem.number}"
          data-state="${state}"
          aria-current="${problem.number === currentNumber ? 'true' : 'false'}"
        >
          <span>${String(problem.number).padStart(2, '0')}</span>
          <span>
            <strong>${escapeHtml(problem.title)}</strong>
            <small>${escapeHtml(problem.pattern)} · ${problem.steps.length} 步</small>
          </span>
          <em>${label}</em>
        </button>
      `;
    }).join('');

    elements.list.querySelectorAll('[data-problem-number]').forEach((button) => {
      button.addEventListener('click', () => {
        selectProblem(Number(button.dataset.problemNumber));
      });
    });
    elements.list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function renderProgress() {
    const count = progress.mastered.length;
    const percent = Math.round(count / algorithms.problems.length * 100);
    elements.progressValue.textContent = `${count}/${algorithms.problems.length}`;
    elements.progressBar.style.setProperty('--algorithm-progress', `${percent}%`);
  }

  function renderEditorLines() {
    const count = Math.max(1, elements.editor.value.split('\n').length);
    elements.editorLines.innerHTML = Array.from(
      { length: count },
      (_, index) => `<span>${index + 1}</span>`
    ).join('');
    elements.editorLines.scrollTop = elements.editor.scrollTop;
  }

  function renderHints() {
    const hints = currentProblem.hints || [];
    elements.hintProgress.textContent = `${hintCount} / ${hints.length}`;
    elements.hintList.innerHTML = hints
      .slice(0, hintCount)
      .map((hint, index) => `
        <div>
          <span>提示 ${index + 1}</span>
          <p>${escapeHtml(hint)}</p>
        </div>
      `)
      .join('');
    if (hintCount >= hints.length) {
      elements.hintToggle.disabled = true;
      elements.hintToggle.innerHTML = '提示已全部展开 <span>✓</span>';
    } else {
      elements.hintToggle.disabled = false;
      elements.hintToggle.innerHTML = `显示第 ${hintCount + 1} 条提示 <span>＋</span>`;
    }
  }

  function renderSolutionCode(activeLine = currentSolutionLine) {
    currentSolutionLine = activeLine;
    const lines = currentProblem.solution.typescript.split('\n');
    elements.solutionCode.innerHTML = lines.map((line, index) => `
      <div class="${index + 1 === activeLine ? 'is-active' : ''}" data-solution-line="${index + 1}">
        <span>${index + 1}</span>
        <code>${escapeHtml(line) || ' '}</code>
      </div>
    `).join('');
    elements.linkedLine.textContent = `当前关联答案第 ${activeLine} 行`;
    elements.solutionCode.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function setContentTab(name) {
    activeContent = name;
    elements.contentTabs.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.algorithmContentTab === name));
    });
    elements.contentPanels.forEach((panel) => {
      panel.hidden = panel.dataset.algorithmContentPanel !== name;
    });
  }

  function setConsoleTab(name) {
    activeConsole = name;
    elements.consoleTabs.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.algorithmConsoleTab === name));
    });
    elements.consolePanels.forEach((panel) => {
      panel.hidden = panel.dataset.algorithmConsolePanel !== name;
    });
  }

  function resetRunResult() {
    elements.runStatus.textContent = '等待运行';
    elements.runStatus.dataset.status = 'idle';
    elements.runSummary.textContent = '尚无结果';
    elements.actualOutput.textContent = '-';
    elements.expectedOutput.textContent = displayValue(currentProblem.runner.expected);
    elements.runTime.textContent = '-';
    elements.runError.hidden = true;
    elements.runError.textContent = '';
    elements.openWalkthrough.hidden = true;
    setConsoleTab('case');
  }

  function saveDraft() {
    if (!currentProblem) return;
    drafts[currentProblem.number] = elements.editor.value;
    writeJson(DRAFTS_KEY, drafts);
  }

  function showGuide({ updateHash = true } = {}) {
    root.dataset.activeView = 'guide';
    elements.guideView.hidden = false;
    elements.practiceView.hidden = true;
    elements.guideButton.setAttribute('aria-current', 'true');
    elements.list.querySelectorAll('[aria-current="true"]').forEach((button) => {
      button.setAttribute('aria-current', 'false');
    });
    if (updateHash) history.replaceState(null, '', '#guide');
  }

  function selectProblem(number, { updateHash = true } = {}) {
    const problem = problemMap.get(number);
    if (!problem) return;
    currentProblem = problem;
    currentNumber = number;
    root.dataset.activeView = 'practice';
    elements.guideView.hidden = true;
    elements.practiceView.hidden = false;
    elements.guideButton.setAttribute('aria-current', 'false');
    hintCount = 0;
    if (!progress.started.includes(number)) progress.started.push(number);
    progress.lastProblem = number;
    writeJson(STORAGE_KEY, progress);

    elements.number.textContent = `第 ${problem.number} 题 / 共 ${algorithms.problems.length} 题`;
    elements.title.textContent = problem.title;
    elements.difficulty.textContent = problem.difficulty;
    elements.difficulty.dataset.difficulty = problem.difficulty.toLowerCase();
    elements.patternValue.textContent = problem.pattern;
    elements.stepCount.textContent = `${problem.steps.length} 步推演`;
    elements.problemHeading.textContent = `${problem.number}. ${problem.title}`;
    elements.statement.textContent = problem.statement;
    elements.example.textContent = problem.exampleText;
    elements.constraints.innerHTML = problem.constraints
      .map((constraint) => `<li>${escapeHtml(constraint)}</li>`)
      .join('');
    elements.core.textContent = problem.core;
    elements.complexity.textContent = problem.complexity || '见解法说明';
    elements.expected.textContent = displayValue(problem.expected);
    elements.editor.value = drafts[number] ?? problem.solution.starterCode;
    elements.testInput.value = JSON.stringify(problem.runner.input, null, 2);
    elements.testExpected.value = JSON.stringify(problem.runner.expected, null, 2);
    renderEditorLines();
    renderHints();
    updateMarkButton(problem);
    resetRunResult();

    visualizer?.destroy();
    visualizer = mountAlgorithmVisualizer(elements.visualizer, problem, {
      host: 'site',
      onStepChange({ step }) {
        renderSolutionCode(step.solutionLine || 1);
      },
    });
    renderSolutionCode(problem.steps[0]?.solutionLine || 1);
    setContentTab(activeContent);

    if (updateHash) history.replaceState(null, '', problemHash(problem.number));
    renderList();
    renderProgress();
  }

  function updateMarkButton(problem) {
    const mastered = progress.mastered.includes(problem.number);
    elements.mark.dataset.mastered = String(mastered);
    elements.mark.textContent = mastered ? '已掌握 ✓' : '标记掌握';
    elements.mark.setAttribute('aria-pressed', String(mastered));
  }

  function setFilter(nextFilter) {
    filter = nextFilter;
    elements.filters.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.algorithmFilter === filter));
    });
    renderList();
  }

  function randomProblem() {
    const visible = filteredProblems();
    const candidates = visible.filter((problem) => !progress.mastered.includes(problem.number));
    const pool = candidates.length ? candidates : visible.length ? visible : algorithms.problems;
    const currentIndex = pool.findIndex((problem) => problem.number === currentNumber);
    const offset = Math.floor(Math.random() * Math.max(1, pool.length - 1)) + 1;
    selectProblem(pool[(Math.max(0, currentIndex) + offset) % pool.length].number);
  }

  async function runCode() {
    let input;
    let expected;
    try {
      input = JSON.parse(elements.testInput.value);
      expected = JSON.parse(elements.testExpected.value);
    } catch (error) {
      setConsoleTab('result');
      elements.runStatus.textContent = '输入错误';
      elements.runStatus.dataset.status = 'error';
      elements.runSummary.textContent = '测试用例不是有效 JSON';
      elements.runError.hidden = false;
      elements.runError.textContent = error.message;
      return;
    }

    elements.run.disabled = true;
    elements.run.textContent = '运行中…';
    setConsoleTab('result');
    elements.runStatus.textContent = '执行中';
    elements.runStatus.dataset.status = 'running';
    elements.runSummary.textContent = '正在 Worker 中转译并执行 TypeScript';
    elements.runError.hidden = true;

    try {
      const result = await runAlgorithmCode({
        code: elements.editor.value,
        runner: { ...currentProblem.runner, expected },
        input,
      });
      elements.runStatus.textContent = result.passed ? '通过' : '未通过';
      elements.runStatus.dataset.status = result.passed ? 'passed' : 'failed';
      elements.runSummary.textContent = result.passed
        ? '实际输出与期望一致'
        : '代码已运行，但输出不符合预期';
      elements.actualOutput.textContent = displayValue(result.actual);
      elements.expectedOutput.textContent = displayValue(result.expected);
      elements.runTime.textContent = `${result.elapsedMs.toFixed(2)} ms`;
      elements.openWalkthrough.hidden = !result.passed;
      if (result.passed) saveDraft();
    } catch (error) {
      elements.runStatus.textContent = '运行错误';
      elements.runStatus.dataset.status = 'error';
      elements.runSummary.textContent = error.message;
      elements.actualOutput.textContent = '-';
      elements.expectedOutput.textContent = displayValue(expected);
      elements.runTime.textContent = '-';
      elements.runError.hidden = false;
      elements.runError.textContent = error.name === 'TypeScriptCompileError'
        ? error.message
        : error.stack || error.message;
    } finally {
      elements.run.disabled = false;
      elements.run.textContent = '运行代码 ▶';
    }
  }

  elements.search.addEventListener('input', renderList);
  elements.guideButton.addEventListener('click', () => showGuide());
  elements.pattern.addEventListener('change', renderList);
  elements.filters.forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.algorithmFilter));
  });
  elements.random.forEach((button) => button.addEventListener('click', randomProblem));
  elements.mark.addEventListener('click', () => {
    const mastered = progress.mastered.includes(currentNumber);
    progress.mastered = mastered
      ? progress.mastered.filter((number) => number !== currentNumber)
      : [...progress.mastered, currentNumber].sort((left, right) => left - right);
    writeJson(STORAGE_KEY, progress);
    updateMarkButton(currentProblem);
    renderProgress();
    renderList();
  });
  elements.exportButton.addEventListener('click', () => downloadProgress(progress));
  elements.clearButton.addEventListener('click', () => {
    if (!window.confirm('清除全部算法练习进度和代码草稿？')) return;
    progress = {
      version: algorithms.version,
      mastered: [],
      started: [],
      lastProblem: currentNumber,
    };
    drafts = {};
    writeJson(STORAGE_KEY, progress);
    writeJson(DRAFTS_KEY, drafts);
    elements.editor.value = currentProblem.solution.starterCode;
    renderEditorLines();
    renderProgress();
    renderList();
    updateMarkButton(currentProblem);
  });
  elements.contentTabs.forEach((button) => {
    button.addEventListener('click', () => setContentTab(button.dataset.algorithmContentTab));
  });
  elements.consoleTabs.forEach((button) => {
    button.addEventListener('click', () => setConsoleTab(button.dataset.algorithmConsoleTab));
  });
  elements.hintToggle.addEventListener('click', () => {
    hintCount = Math.min(currentProblem.hints.length, hintCount + 1);
    renderHints();
  });
  elements.editor.addEventListener('input', () => {
    renderEditorLines();
    saveDraft();
  });
  elements.editor.addEventListener('scroll', () => {
    elements.editorLines.scrollTop = elements.editor.scrollTop;
  });
  elements.editor.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = elements.editor.selectionStart;
    const end = elements.editor.selectionEnd;
    elements.editor.setRangeText('  ', start, end, 'end');
    elements.editor.dispatchEvent(new Event('input'));
  });
  elements.resetCode.addEventListener('click', () => {
    elements.editor.value = currentProblem.solution.starterCode;
    delete drafts[currentNumber];
    writeJson(DRAFTS_KEY, drafts);
    renderEditorLines();
    resetRunResult();
  });
  elements.loadSolution.addEventListener('click', () => {
    elements.editor.value = currentProblem.solution.typescript;
    renderEditorLines();
    saveDraft();
  });
  elements.copySolution.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(currentProblem.solution.typescript);
    elements.copySolution.textContent = '已复制';
    window.setTimeout(() => { elements.copySolution.textContent = '复制答案'; }, 1200);
  });
  elements.run.addEventListener('click', runCode);
  elements.openWalkthrough.addEventListener('click', () => {
    setContentTab('solution');
    elements.visualizer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('hashchange', () => {
    const number = problemFromLocation();
    if (!number) {
      showGuide({ updateHash: false });
    } else if (problemMap.has(number) && number !== currentNumber) {
      selectProblem(number, { updateHash: false });
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.target === elements.editor || event.target === elements.testInput) return;
    if (event.key.toLowerCase() === 'm') elements.mark.click();
    if (event.key.toLowerCase() === 'r') randomProblem();
  });

  setFilter('all');
  setConsoleTab(activeConsole);
  initPatternNavigator(elements.patternNavigator, {
    onOpenProblem(number) {
      selectProblem(number);
    },
    onContinue() {
      selectProblem(progress.lastProblem || DEFAULT_PROBLEM);
    },
  });
  if (problemFromLocation()) {
    selectProblem(currentNumber, { updateHash: false });
  } else {
    showGuide({ updateHash: false });
  }
}

export function initAlgorithmCourses() {
  document.querySelectorAll('[data-algorithm-course]').forEach(createCourse);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlgorithmCourses, { once: true });
} else {
  initAlgorithmCourses();
}
