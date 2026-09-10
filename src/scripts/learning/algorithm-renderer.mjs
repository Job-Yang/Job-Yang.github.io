function escapeHtml(value) {
  return String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatValue(value) {
  if (value === null || value === undefined) return '-';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function includesToken(values, target) {
  return Array.isArray(values)
    && values.some((value) => JSON.stringify(value) === JSON.stringify(target));
}

function pointerLabels(index, step) {
  const pointers = step.view?.pointers || {};
  return Object.entries(pointers)
    .filter(([, value]) => value === index)
    .map(([key]) => `<span class="algo-pointer">${escapeHtml(key)}</span>`)
    .join('');
}

function tokenClass(index, step) {
  const view = step.view || {};
  const classes = [];
  if (includesToken(view.active, index)) classes.push('is-active');
  if (includesToken(view.selected, index)) classes.push('is-selected');
  if (includesToken(view.discarded, index)) classes.push('is-discarded');
  if (view.window && index >= view.window[0] && index <= view.window[1]) {
    classes.push('is-window');
  }
  return classes.length ? ` ${classes.join(' ')}` : '';
}

function renderSequence(spec, step) {
  const values = step.view?.values || spec.visual.values || [];
  return `
    <div class="algo-sequence">
      ${values.map((value, index) => `
        <div class="algo-cell${tokenClass(index, step)}">
          ${escapeHtml(formatValue(value))}
          <small>${escapeHtml(spec.visual.labels?.[index] ?? index)}</small>
          ${pointerLabels(index, step)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderBars(spec, step) {
  const values = step.view?.values || spec.visual.values || [];
  const numbers = values.map((value) => Number(value) || 0);
  const max = Math.max(1, ...numbers);

  if (spec.visual.water) {
    const settled = step.view?.secondary?.settled || {};
    const cells = [];
    for (let level = max; level >= 1; level -= 1) {
      numbers.forEach((height, index) => {
        const solid = level <= height;
        const water = !solid && level <= (settled[index] || 0);
        const active = includesToken(step.view?.active, index);
        cells.push(
          `<span class="algo-rain-cell${solid ? ' is-solid' : water ? ' is-water' : ''}${active ? ' is-active' : ''}"></span>`
        );
      });
    }
    return `
      <div class="algo-rain">
        <div class="algo-rain-grid" style="grid-template-columns:repeat(${numbers.length},1fr);grid-template-rows:repeat(${max},1fr)">
          ${cells.join('')}
        </div>
        <div class="algo-rain-indexes" style="grid-template-columns:repeat(${numbers.length},1fr)">
          ${numbers.map((_, index) => `
            <span>${index}${pointerLabels(index, step)}</span>
          `).join('')}
        </div>
      </div>
    `;
  }

  const left = Number(step.variables.l ?? step.variables.L ?? 0);
  const right = Number(step.variables.r ?? step.variables.R ?? numbers.length - 1);
  const short = Number(step.variables.short ?? 0);
  const area = Number(step.variables.area ?? 0);
  const areaOverlay = right > left
    ? `
      <div
        class="algo-area"
        style="left:${((left + 0.5) / numbers.length) * 100}%;width:${((right - left) / numbers.length) * 100}%;height:${(short / max) * 142}px"
      >
        <span>${right - left} × ${short} = ${area}</span>
      </div>
    `
    : '';

  return `
    <div class="algo-bars">
      ${areaOverlay}
      ${numbers.map((value, index) => `
        <div class="algo-bar-slot${tokenClass(index, step)}">
          <div class="algo-bar" style="height:${Math.max(4, (value / max) * 142)}px">
            <span>${value}</span>
          </div>
          <small>${index}</small>
          ${pointerLabels(index, step)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderString(spec, step) {
  return `
    <div class="algo-sequence">
      ${(spec.visual.text || '').split('').map((value, index) => `
        <div class="algo-cell${tokenClass(index, step)}">
          ${escapeHtml(value)}
          <small>${index}</small>
          ${pointerLabels(index, step)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderIntervals(spec, step) {
  const intervals = spec.visual.intervals || [];
  const min = spec.visual.min || 0;
  const max = spec.visual.max || Math.max(...intervals.flat());
  const span = Math.max(1, max - min);
  return `
    <div class="algo-intervals">
      ${intervals.map((interval, index) => `
        <div class="algo-interval-row">
          <span
            class="algo-interval${tokenClass(index, step)}"
            style="left:${((interval[0] - min) / span) * 100}%;width:${Math.max(5, ((interval[1] - interval[0]) / span) * 100)}%"
          >${interval[0]}–${interval[1]}</span>
        </div>
      `).join('')}
      <div class="algo-number-line">
        ${Array.from({ length: 10 }, (_, index) => `<i style="left:${(index / 9) * 100}%"></i>`).join('')}
      </div>
    </div>
  `;
}

function renderLinked(spec, step) {
  const rows = spec.visual.rows || [];
  return `
    <div class="algo-linked">
      ${rows.map((row, rowIndex) => `
        <div class="algo-list-row">
          <span class="algo-row-name">${String.fromCharCode(65 + rowIndex)}</span>
          ${row.map((value, index) => {
            const active = includesToken(step.view?.active, value)
              || includesToken(step.view?.active, index);
            const selected = includesToken(step.view?.selected, value)
              || includesToken(step.view?.selected, index);
            return `
              <span class="algo-node${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}">${escapeHtml(value)}</span>
              ${index < row.length - 1 ? '<span class="algo-arrow">→</span>' : ''}
            `;
          }).join('')}
          ${spec.visual.cycleTo !== undefined && rowIndex === 0
            ? `<span class="algo-arrow">↩ ${escapeHtml(row[spec.visual.cycleTo])}</span>`
            : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function normalizeSecondary(step) {
  const secondary = step.view?.secondary || [];
  if (Array.isArray(secondary)) return secondary;
  return Object.entries(secondary).map(([key, value]) => `${key}: ${formatValue(value)}`);
}

function renderStack(spec, step) {
  const input = spec.visual.input || spec.visual.values || [];
  const secondary = normalizeSecondary(step);
  return `
    <div class="algo-split-scene">
      <div>
        <span class="algo-scene-label">INPUT / OPERATIONS</span>
        <div class="algo-chips">
          ${input.map((value, index) => `<span class="algo-chip${tokenClass(index, step)}">${escapeHtml(value)}</span>`).join('')}
        </div>
      </div>
      <div>
        <span class="algo-scene-label">CURRENT STRUCTURE</span>
        <div class="algo-stack">
          ${secondary.length
            ? secondary.map((value) => `<span>${escapeHtml(value)}</span>`).join('')
            : '<span>empty</span>'}
        </div>
      </div>
    </div>
  `;
}

function renderTree(spec, step) {
  const values = spec.visual.tree || spec.visual.values || [];
  const slots = [
    { row: 1, col: 4 },
    { row: 2, col: 2 },
    { row: 2, col: 6 },
    { row: 3, col: 1 },
    { row: 3, col: 3 },
    { row: 3, col: 5 },
    { row: 3, col: 7 },
  ];
  return `
    <div class="algo-tree">
      ${values.slice(0, 7).map((value, index) => {
        if (value === null || value === undefined) return '';
        const active = includesToken(step.view?.active, value);
        const selected = includesToken(step.view?.selected, value);
        return `
          <span
            class="algo-tree-node${index === 0 ? ' is-root' : ''}${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}"
            style="grid-row:${slots[index].row};grid-column:${slots[index].col}"
          >${escapeHtml(value)}</span>
        `;
      }).join('')}
    </div>
  `;
}

function renderGrid(spec, step) {
  const grid = step.view?.grid || spec.visual.grid || [];
  const columns = Math.max(1, ...grid.map((row) => row.length));
  return `
    <div class="algo-grid" style="grid-template-columns:repeat(${columns},42px)">
      ${grid.flatMap((row, rowIndex) => row.map((value, columnIndex) => {
        const position = [rowIndex, columnIndex];
        const active = includesToken(step.view?.active, position);
        const selected = includesToken(step.view?.selected, position);
        return `<span class="${active ? 'is-active ' : ''}${selected ? 'is-selected ' : ''}">${escapeHtml(value)}</span>`;
      })).join('')}
    </div>
  `;
}

function renderDp(step) {
  const matrix = step.view?.matrix || [[0]];
  const columns = Math.max(1, ...matrix.map((row) => row.length));
  return `
    <div class="algo-dp" style="grid-template-columns:repeat(${columns},minmax(34px,1fr))">
      ${matrix.flatMap((row, rowIndex) => row.map((value, columnIndex) => {
        const position = [rowIndex, columnIndex];
        const active = includesToken(step.view?.active, position);
        const selected = includesToken(step.view?.selected, position);
        return `<span class="${active ? 'is-active ' : ''}${selected ? 'is-selected ' : ''}">${escapeHtml(value)}</span>`;
      })).join('')}
    </div>
  `;
}

function renderDecision(spec, step) {
  const path = step.view?.path || [];
  const choices = step.view?.choices || spec.visual.choices || [];
  return `
    <div class="algo-decision">
      <span class="algo-scene-label">CURRENT PATH</span>
      <div class="algo-path">
        ${path.length
          ? path.map((value) => `<span>${escapeHtml(value)}</span>`).join('')
          : '<span class="is-empty">空路径</span>'}
      </div>
      <p>↓ choose / recurse / undo ↓</p>
      <div class="algo-choices">
        ${choices.length
          ? choices.map((value) => `<span>${escapeHtml(value)}</span>`).join('')
          : '<span>完成</span>'}
      </div>
    </div>
  `;
}

function renderGraph(spec, step) {
  return `
    <div class="algo-graph">
      ${(spec.visual.nodes || []).map((value, index) => `
        ${index ? '<span class="algo-graph-arrow">→</span>' : ''}
        <span class="algo-graph-node${includesToken(step.view?.active, value) ? ' is-active' : ''}${includesToken(step.view?.selected, value) ? ' is-selected' : ''}">
          ${escapeHtml(value)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderHeap(spec, step) {
  const heap = Array.isArray(step.variables.heap)
    ? step.variables.heap
    : normalizeSecondary(step);
  return `
    <div class="algo-split-scene">
      <div>
        <span class="algo-scene-label">INPUT STREAM</span>
        <div class="algo-chips">
          ${(spec.visual.values || []).map((value, index) => `<span class="algo-chip${tokenClass(index, step)}">${escapeHtml(value)}</span>`).join('')}
        </div>
      </div>
      <div>
        <span class="algo-scene-label">MIN HEAP / CANDIDATES</span>
        <div class="algo-chips">
          ${heap.length
            ? heap.map((value, index) => `<span class="algo-chip${index === 0 ? ' is-active' : ''}">${escapeHtml(value)}</span>`).join('')
            : '<span class="algo-chip">empty</span>'}
        </div>
      </div>
    </div>
  `;
}

function renderVisual(spec, step) {
  switch (spec.family) {
    case 'bars': return renderBars(spec, step);
    case 'string': return renderString(spec, step);
    case 'interval': return renderIntervals(spec, step);
    case 'linked': return renderLinked(spec, step);
    case 'stack': return renderStack(spec, step);
    case 'tree': return renderTree(spec, step);
    case 'grid': return renderGrid(spec, step);
    case 'dp': return renderDp(step);
    case 'decision': return renderDecision(spec, step);
    case 'graph': return renderGraph(spec, step);
    case 'heap': return renderHeap(spec, step);
    default: return renderSequence(spec, step);
  }
}

function visualLabel(family) {
  return {
    array: 'ARRAY / STATE',
    bars: 'MEASURE / AREA',
    string: 'STRING / WINDOW',
    interval: 'INTERVAL / NUMBER LINE',
    linked: 'NODES / POINTERS',
    stack: 'STACK / ORDER',
    tree: 'TREE / RETURNS',
    grid: 'GRID / FRONTIER',
    dp: 'DP / DEPENDENCIES',
    decision: 'DECISION / BACKTRACK',
    graph: 'GRAPH / INDEGREE',
    heap: 'HEAP / TOP K',
  }[family] || 'STATE';
}

function visualizerMarkup() {
  return `
    <section class="algorithm-instrument">
      <header class="algorithm-instrument__head">
        <div>
          <span class="algorithm-kicker" data-algo-step></span>
          <strong data-algo-phase></strong>
        </div>
        <code data-algo-input></code>
      </header>
      <div class="algorithm-instrument__body">
        <section class="algorithm-stage">
          <span class="algorithm-stage__label" data-algo-visual-label></span>
          <div class="algorithm-stage__canvas" data-algo-visual></div>
          <dl class="algorithm-variables" data-algo-variables></dl>
        </section>
        <aside class="algorithm-explanation">
          <header>
            <span>ONE DECISION AT A TIME</span>
            <b data-algo-lens></b>
          </header>
          <div data-algo-demo>
            <dl>
              <div><dt>观察</dt><dd data-algo-observation></dd></div>
              <div><dt>判断</dt><dd data-algo-decision></dd></div>
              <div><dt>计算</dt><dd class="is-calculation" data-algo-calculation></dd></div>
              <div><dt>变化</dt><dd data-algo-change></dd></div>
            </dl>
            <section class="algorithm-tip">
              <span>重要提示</span>
              <p data-algo-tip></p>
            </section>
          </div>
          <div class="algorithm-quiz" data-algo-quiz hidden>
            <span>YOUR MOVE</span>
            <p>根据当前画面与变量，这一轮应该如何判断？</p>
            <button type="button" data-algo-correct></button>
            <button type="button" data-algo-wrong>跳过当前约束，直接改变另一组状态</button>
            <output data-algo-feedback>先作答，再看判断依据。</output>
          </div>
        </aside>
      </div>
      <footer class="algorithm-controls">
        <div>
          <button type="button" data-algo-reset title="重置" aria-label="重置">↺</button>
          <button type="button" data-algo-previous title="上一步" aria-label="上一步">◀</button>
          <button type="button" class="is-primary" data-algo-play title="播放" aria-label="播放">▶</button>
          <button type="button" data-algo-next title="下一步" aria-label="下一步">▶|</button>
        </div>
        <input type="range" min="0" value="0" data-algo-timeline aria-label="步骤进度">
        <span data-algo-counter></span>
      </footer>
      <div class="algorithm-instrument__foot">
        <div>
          <span>CURRENT CODE / RULE</span>
          <code data-algo-code></code>
        </div>
        <div>
          <span>EXAMPLE OUTPUT</span>
          <strong data-algo-output></strong>
        </div>
      </div>
    </section>
  `;
}

export function mountAlgorithmVisualizer(root, spec, options = {}) {
  const controller = new AbortController();
  const signal = controller.signal;
  let current = 0;
  let timer = null;
  let quiz = false;

  root.innerHTML = visualizerMarkup();
  root.dataset.algorithmVisualizer = spec.number;
  root.dataset.host = options.host || 'site';

  const query = (selector) => root.querySelector(selector);
  const elements = {
    step: query('[data-algo-step]'),
    phase: query('[data-algo-phase]'),
    input: query('[data-algo-input]'),
    visual: query('[data-algo-visual]'),
    visualLabel: query('[data-algo-visual-label]'),
    variables: query('[data-algo-variables]'),
    lens: query('[data-algo-lens]'),
    demo: query('[data-algo-demo]'),
    quiz: query('[data-algo-quiz]'),
    observation: query('[data-algo-observation]'),
    decision: query('[data-algo-decision]'),
    calculation: query('[data-algo-calculation]'),
    change: query('[data-algo-change]'),
    tip: query('[data-algo-tip]'),
    correct: query('[data-algo-correct]'),
    wrong: query('[data-algo-wrong]'),
    feedback: query('[data-algo-feedback]'),
    reset: query('[data-algo-reset]'),
    previous: query('[data-algo-previous]'),
    play: query('[data-algo-play]'),
    next: query('[data-algo-next]'),
    timeline: query('[data-algo-timeline]'),
    counter: query('[data-algo-counter]'),
    code: query('[data-algo-code]'),
    output: query('[data-algo-output]'),
  };

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
    elements.play.textContent = '▶';
    elements.play.setAttribute('aria-label', '播放');
  }

  function setQuiz(nextQuiz) {
    quiz = nextQuiz;
    elements.demo.hidden = quiz;
    elements.quiz.hidden = !quiz;
    root.dispatchEvent(new CustomEvent('algorithm:mode', {
      bubbles: true,
      detail: { quiz },
    }));
  }

  function renderVariables(step) {
    elements.variables.innerHTML = Object.entries(step.variables || {})
      .slice(0, 6)
      .map(([key, value]) => `
        <div title="${escapeHtml(formatValue(value))}">
          <dt>${escapeHtml(key)}</dt>
          <dd>${escapeHtml(formatValue(value))}</dd>
        </div>
      `)
      .join('');
  }

  function render() {
    const step = spec.steps[current];
    elements.step.textContent = `STEP ${String(current + 1).padStart(2, '0')} / ${String(spec.steps.length).padStart(2, '0')}`;
    elements.phase.textContent = step.change.split('；')[0];
    elements.input.textContent = spec.exampleInput;
    elements.visualLabel.textContent = visualLabel(spec.family);
    elements.visual.innerHTML = renderVisual(spec, step);
    elements.observation.textContent = step.observation;
    elements.decision.textContent = step.decision;
    elements.calculation.textContent = step.calculation;
    elements.change.textContent = step.change;
    elements.tip.textContent = spec.tips;
    elements.lens.textContent = spec.lens;
    elements.correct.textContent = step.decision;
    elements.feedback.textContent = '先作答，再看判断依据。';
    elements.feedback.dataset.result = '';
    elements.code.textContent = step.code || step.decision;
    elements.output.textContent = formatValue(spec.expected);
    elements.timeline.max = String(spec.steps.length - 1);
    elements.timeline.value = String(current);
    elements.counter.textContent = `${current + 1} / ${spec.steps.length}`;
    elements.previous.disabled = current === 0;
    elements.next.disabled = current === spec.steps.length - 1;
    renderVariables(step);
    options.onStepChange?.({ spec, step, index: current });
  }

  function move(delta) {
    stop();
    current = Math.max(0, Math.min(spec.steps.length - 1, current + delta));
    render();
  }

  elements.reset.addEventListener('click', () => {
    stop();
    current = 0;
    render();
  }, { signal });
  elements.previous.addEventListener('click', () => move(-1), { signal });
  elements.next.addEventListener('click', () => move(1), { signal });
  elements.timeline.addEventListener('input', (event) => {
    stop();
    current = Number(event.target.value);
    render();
  }, { signal });
  elements.play.addEventListener('click', () => {
    if (timer) {
      stop();
      return;
    }
    if (current === spec.steps.length - 1) current = 0;
    elements.play.textContent = 'Ⅱ';
    elements.play.setAttribute('aria-label', '暂停');
    timer = window.setInterval(() => {
      if (current >= spec.steps.length - 1) {
        stop();
        return;
      }
      current += 1;
      render();
    }, options.playInterval || 1300);
    render();
  }, { signal });
  elements.correct.addEventListener('click', () => {
    elements.feedback.dataset.result = 'correct';
    elements.feedback.textContent = `对。${spec.steps[current].decision}`;
  }, { signal });
  elements.wrong.addEventListener('click', () => {
    elements.feedback.dataset.result = 'wrong';
    elements.feedback.textContent = `这一步要守住当前约束：${spec.steps[current].decision}`;
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (
      event.target instanceof HTMLInputElement
      || event.target instanceof HTMLSelectElement
      || event.target instanceof HTMLTextAreaElement
      || event.target?.isContentEditable
    ) return;
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
    if (event.key === ' ') {
      event.preventDefault();
      elements.play.click();
    }
  }, { signal });
  root.addEventListener('algorithm:set-mode', (event) => {
    setQuiz(Boolean(event.detail?.quiz));
  }, { signal });

  render();
  setQuiz(false);

  return {
    destroy() {
      stop();
      controller.abort();
      root.innerHTML = '';
    },
    move,
    reset() {
      current = 0;
      render();
    },
    setQuiz,
  };
}
