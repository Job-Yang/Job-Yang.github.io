import course from '../../data/learning/ai-foundations.json';
import {
  attentionState,
  bytesToGiB,
  cosineFromPoints,
  deviceFit,
  embeddingPoints,
  estimateJourney,
  formatNumber,
  kvCacheBytes,
  mambaMemory,
  patchBudget,
  reasoningBudget,
  sampleTokens,
  toyTokenize,
  trainingState,
  weightBytes
} from './models.mjs';

const COURSE_KEY = `learning:${course.id}`;
const lessonMap = new Map(course.lessons.map((lesson) => [lesson.id, lesson]));
let memoryProgress = { version: course.version, lessons: {}, lastLesson: 'journey' };
let larkProgressReady = false;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(COURSE_KEY) || '{}');
    const preservedLessons = Object.fromEntries(
      Object.entries(value.lessons || {}).filter(([lessonId]) => lessonMap.has(lessonId))
    );
    memoryProgress = {
      version: course.version,
      lessons: preservedLessons,
      lastLesson: lessonMap.has(value.lastLesson) ? value.lastLesson : 'journey'
    };
    return memoryProgress;
  } catch {
    return memoryProgress;
  }
}

function writeProgress(progress) {
  memoryProgress = progress;
  try {
    localStorage.setItem(COURSE_KEY, JSON.stringify(progress));
  } catch {
    // The course still works when storage is unavailable.
  }
  mirrorProgressToLark(progress);
  updateProgressUI(progress);
}

function waitForMagic(callback, retries = 30) {
  if (window.magic) {
    callback(window.magic);
    return;
  }
  if (retries > 0) {
    setTimeout(() => waitForMagic(callback, retries - 1), 150);
  }
}

function mirrorProgressToLark(progress) {
  if (document.documentElement.dataset.learningHost !== 'lark') return;
  if (!larkProgressReady) return;
  waitForMagic(async (magic) => {
    try {
      await magic.redis.set(COURSE_KEY, JSON.stringify(progress));
    } catch {
      // Private progress persistence is optional inside the document.
    }
  });
}

function hydrateProgressFromLark() {
  if (document.documentElement.dataset.learningHost !== 'lark') return;
  waitForMagic(async (magic) => {
    try {
      const value = await magic.redis.get(COURSE_KEY);
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (parsed?.version === course.version) {
        memoryProgress = {
          version: course.version,
          lessons: { ...(parsed.lessons || {}), ...(memoryProgress.lessons || {}) },
          lastLesson: memoryProgress.lastLesson || parsed.lastLesson || 'journey'
        };
      }
      try {
        localStorage.setItem(COURSE_KEY, JSON.stringify(memoryProgress));
      } catch {
        // Memory storage remains available.
      }
      updateProgressUI(memoryProgress);
    } catch {
      // Standalone and read failures are valid fallbacks.
    } finally {
      larkProgressReady = true;
      mirrorProgressToLark(memoryProgress);
    }
  });
}

function syncLarkHeight() {
  if (document.documentElement.dataset.learningHost !== 'lark') return;
  waitForMagic((magic) => {
    window.setTimeout(() => {
      try {
        magic.updateHeight?.();
      } catch {
        // The host may already be using its configured height.
      }
    }, 80);
  });
}

function markProgress(lessonId, status, attempts) {
  const progress = readProgress();
  const current = progress.lessons[lessonId] || { status: 'not_started', attempts: 0 };
  const rank = { not_started: 0, opened: 1, manipulated: 2, completed: 3 };
  if ((rank[status] || 0) >= (rank[current.status] || 0)) current.status = status;
  if (typeof attempts === 'number') current.attempts = attempts;
  progress.lessons[lessonId] = current;
  progress.lastLesson = lessonId;
  writeProgress(progress);
  return current;
}

function lessonHref(lessonId) {
  const path = lessonId === 'journey'
    ? '/learn/ai-foundations/'
    : `/learn/ai-foundations/${lessonId}/`;
  return document.documentElement.dataset.learningHost === 'lark'
    ? `https://jobyang.cn${path}`
    : path;
}

function updateProgressUI(progress = readProgress()) {
  const completed = course.lessons.filter(
    (lesson) => progress.lessons[lesson.id]?.status === 'completed'
  ).length;
  const percent = Math.round(completed / course.lessons.length * 100);

  document.querySelectorAll('[data-course-progress-value]').forEach((node) => {
    node.textContent = `${completed}/${course.lessons.length}`;
  });
  document.querySelectorAll('[data-course-progress-percent]').forEach((node) => {
    node.textContent = `${percent}%`;
  });
  document.querySelectorAll('[data-course-progress-bar]').forEach((node) => {
    node.style.setProperty('--learning-progress', `${percent}%`);
  });
  document.querySelectorAll('[data-continue-link]').forEach((node) => {
    node.setAttribute('href', lessonHref(progress.lastLesson || 'journey'));
  });
  document.querySelectorAll('[data-lesson-state]').forEach((node) => {
    const state = progress.lessons[node.dataset.lessonState]?.status || 'not_started';
    node.dataset.state = state;
    node.textContent = state === 'completed' ? '已掌握' : state === 'manipulated' ? '进行中' : '未开始';
  });
}

function bindProgressActions() {
  document.querySelectorAll('[data-clear-progress]').forEach((button) => {
    button.addEventListener('click', () => {
      localStorage.removeItem(COURSE_KEY);
      updateProgressUI();
      window.location.reload();
    });
  });
  document.querySelectorAll('[data-export-progress]').forEach((button) => {
    button.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(readProgress(), null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'ai-foundations-progress.json';
      anchor.click();
      URL.revokeObjectURL(url);
    });
  });
}

function createShell(root, lesson, mode) {
  const isCourse = mode === 'course';

  root.innerHTML = `
    <section class="learning-lesson" data-learning-mode="${mode}" aria-labelledby="${lesson.id}-experiment-title">
      <section class="learning-widget">
      <header class="learning-widget__head">
        <div>
          <span class="learning-kicker">${isCourse ? '轮到你练习' : `${lesson.number} · 动手验证`}</span>
          <h2 id="${lesson.id}-experiment-title">${lesson.shortTitle}</h2>
          <p>${isCourse ? '刚才读到的原文就是参照。现在改一个变量，看看结果是否符合文章里的机制。' : '在上面的原文基础上改动参数，观察结果如何变化。'}</p>
        </div>
        <button class="learning-icon-button" type="button" data-reset title="恢复初始状态" aria-label="恢复初始状态">↻</button>
      </header>
      <section class="learning-mission" data-mission>
        <span class="learning-mission__index" aria-hidden="true">TRY</span>
        <div>
          <span class="learning-kicker">现在动手</span>
          <strong>${escapeHtml(lesson.mission.instruction)}</strong>
          <p>${escapeHtml(lesson.mission.target)}</p>
          <small>${escapeHtml(lesson.mission.successSignal)}</small>
        </div>
        <button class="learning-start" type="button" data-start-lab>
          开始实验 <span aria-hidden="true">↓</span>
        </button>
      </section>
      <div class="learning-lab" data-lab>
        <section class="learning-control-panel" aria-label="可操作参数">
          <header class="learning-panel-heading">
            <span>01</span>
            <div><small>调整参数</small><strong>一次只改一个变量</strong></div>
          </header>
          <div class="learning-controls" data-controls></div>
        </section>
        <section class="learning-stage-panel" aria-label="实验结果">
          <header class="learning-panel-heading">
            <span>02</span>
            <div><small>实时结果</small><strong data-interaction-state>等待你操作</strong></div>
          </header>
          <div class="learning-stage" data-stage></div>
        </section>
      </div>
      <section class="learning-result" data-result-panel data-state="ready" aria-live="polite">
        <div>
          <span class="learning-kicker" data-result-label>先看基线</span>
          <p class="learning-observation" data-observation>${escapeHtml(lesson.mission.target)}</p>
        </div>
        <div class="learning-result__why">
          <span>这说明什么</span>
          <p>${escapeHtml(lesson.mission.successSignal)}</p>
        </div>
      </section>
      ${isCourse ? checkpointMarkup(lesson) : `
        <footer class="learning-article-foot">
          <span>教学模型 · 结论请连同假设一起使用</span>
          <a href="${lessonHref(lesson.id)}">进入完整课程 <span aria-hidden="true">→</span></a>
        </footer>
      `}
      </section>
    </section>
  `;

  const start = root.querySelector('[data-start-lab]');
  start.addEventListener('click', () => {
    root.dataset.started = 'true';
    const firstControl = root.querySelector('[data-controls] input, [data-controls] select, [data-controls] button');
    root.querySelector('[data-lab]').scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center'
    });
    window.setTimeout(() => firstControl?.focus({ preventScroll: true }), 320);
  });

  const reset = root.querySelector('[data-reset]');
  reset.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    root.removeAttribute('data-mounted');
    root.removeAttribute('data-manipulated');
    root.removeAttribute('data-started');
    mountExperiment(root);
  });
  return {
    controls: root.querySelector('[data-controls]'),
    stage: root.querySelector('[data-stage]'),
    observation: root.querySelector('[data-observation]'),
    reset,
    interactionState: root.querySelector('[data-interaction-state]'),
    resultPanel: root.querySelector('[data-result-panel]')
  };
}

function checkpointMarkup(lesson) {
  return `
    <form class="concept-check" data-checkpoint>
      <header>
        <span class="learning-kicker">最后一步</span>
        <h2>不用背，换个条件判断一次</h2>
      </header>
      <fieldset>
        <legend>${lesson.checkpoint.question}</legend>
        <div class="concept-options">
          ${lesson.checkpoint.options.map((option, index) => `
            <label>
              <input type="radio" name="${lesson.id}-answer" value="${index}" />
              <span>${option}</span>
            </label>
          `).join('')}
        </div>
      </fieldset>
      <div class="concept-actions">
        <button class="learning-command learning-command--primary" type="submit">检查答案 <span aria-hidden="true">→</span></button>
        <output data-check-feedback aria-live="polite"></output>
      </div>
    </form>
  `;
}

function bindCheckpoint(root, lesson) {
  const form = root.querySelector('[data-checkpoint]');
  if (!form) return;
  const feedback = form.querySelector('[data-check-feedback]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = form.querySelector('input:checked');
    if (!selected) {
      feedback.textContent = '先选一个答案。';
      feedback.dataset.result = 'empty';
      form.dataset.result = 'empty';
      return;
    }
    const progress = readProgress();
    const attempts = (progress.lessons[lesson.id]?.attempts || 0) + 1;
    const correct = Number(selected.value) === lesson.checkpoint.answer;
    feedback.textContent = correct
      ? `答对了。${lesson.checkpoint.success}`
      : `再试一次。${lesson.checkpoint.failure}`;
    feedback.dataset.result = correct ? 'correct' : 'wrong';
    form.dataset.result = correct ? 'correct' : 'wrong';
    markProgress(lesson.id, correct ? 'completed' : 'manipulated', attempts);
    root.dispatchEvent(new CustomEvent('learning:checkpoint', {
      bubbles: true,
      detail: { lessonId: lesson.id, correct, attempts }
    }));
  });
}

function markManipulated(root, lesson) {
  root.dataset.manipulated = 'true';
  root.dataset.started = 'true';
  const interactionState = root.querySelector('[data-interaction-state]');
  const resultPanel = root.querySelector('[data-result-panel]');
  const resultLabel = root.querySelector('[data-result-label]');
  const start = root.querySelector('[data-start-lab]');
  if (interactionState) interactionState.textContent = '变化已发生';
  if (resultPanel) resultPanel.dataset.state = 'changed';
  if (resultLabel) resultLabel.textContent = '你刚刚改变了结果';
  if (start) {
    start.innerHTML = '已开始 <span aria-hidden="true">✓</span>';
    start.dataset.complete = 'true';
  }
  syncLarkHeight();
  markProgress(lesson.id, 'manipulated');
  root.dispatchEvent(new CustomEvent('learning:manipulated', {
    bubbles: true,
    detail: { lessonId: lesson.id }
  }));
}

function rangeField(id, label, min, max, step, value, suffix = '') {
  return `
    <label class="learning-field" for="${id}">
      <span>${label}<output data-output-for="${id}">${value}${suffix}</output></span>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    </label>
  `;
}

function bindRange(root, id, suffix, callback) {
  const input = root.querySelector(`#${id}`);
  const output = root.querySelector(`[data-output-for="${id}"]`);
  const handler = () => {
    output.textContent = `${input.value}${suffix}`;
    callback(Number(input.value));
  };
  input.addEventListener('input', handler);
  return input;
}

function segmented(items, current, name) {
  return `
    <div class="learning-segmented" role="group" aria-label="${name}">
      ${items.map((item) => `
        <button type="button" data-value="${item.value}" aria-pressed="${item.value === current}">
          ${item.label}
        </button>
      `).join('')}
    </div>
  `;
}

function bindSegmented(root, callback) {
  root.querySelectorAll('.learning-segmented button').forEach((button) => {
    button.addEventListener('click', () => {
      button.parentElement.querySelectorAll('button').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      callback(button.dataset.value);
    });
  });
}

function renderJourney(root, lesson, shell) {
  let inputTokens = 1024;
  let outputTokens = 128;
  let activeStep = 0;
  const steps = [
    ['Tokenizer', '把字符串切成模型词表中的 token。'],
    ['Embedding', '把离散 token 映射成连续向量。'],
    ['RoPE', '把相对位置信息写入 Q/K。'],
    ['Transformer', '在多层网络中融合上下文。'],
    ['Sampling', '从候选概率中选择下一个 token。'],
    ['Decode', '把新 token 接回输入并继续循环。'],
    ['De-tokenize', '把 token 还原为可显示文本。']
  ];
  shell.controls.innerHTML = `
    ${rangeField(`${lesson.id}-input`, '输入长度', 128, 8192, 128, inputTokens, ' tokens')}
    ${rangeField(`${lesson.id}-output`, '输出长度', 16, 512, 16, outputTokens, ' tokens')}
    <button class="learning-command" type="button" data-next-step>单步执行 <span aria-hidden="true">→</span></button>
  `;
  const update = () => {
    const estimate = estimateJourney(inputTokens, outputTokens);
    shell.stage.innerHTML = `
      <div class="pipeline-steps" role="list">
        ${steps.map((step, index) => `
          <button type="button" role="listitem" data-step="${index}" data-active="${index === activeStep}">
            <span>${String(index + 1).padStart(2, '0')}</span><strong>${step[0]}</strong>
          </button>
        `).join('')}
      </div>
      <div class="pipeline-detail">
        <div><span>当前阶段</span><strong>${steps[activeStep][0]}</strong><p>${steps[activeStep][1]}</p></div>
        <dl>
          <div><dt>TTFT</dt><dd>${formatNumber(estimate.ttftMs, 0)} ms</dd></div>
          <div><dt>Decode</dt><dd>${formatNumber(estimate.tps, 1)} tok/s</dd></div>
          <div><dt>总耗时</dt><dd>${formatNumber(estimate.totalMs / 1000, 1)} s</dd></div>
        </dl>
      </div>
      <div class="timeline-meter" aria-label="Prefill 与 Decode 时间占比">
        <span style="--meter:${estimate.ttftMs / estimate.totalMs * 100}%">Prefill</span>
        <span>Decode</span>
      </div>
    `;
    shell.observation.textContent = activeStep < 4
      ? `输入增长主要推高首字前的工作；当前估算 TTFT 为 ${formatNumber(estimate.ttftMs, 0)} ms。`
      : `输出增长主要拉长自回归循环；当前 ${outputTokens} 个输出 token 约需 ${formatNumber(estimate.decodeMs / 1000, 1)} 秒。`;
    shell.stage.querySelectorAll('[data-step]').forEach((button) => {
      button.addEventListener('click', () => {
        activeStep = Number(button.dataset.step);
        markManipulated(root, lesson);
        update();
      });
    });
  };
  bindRange(shell.controls, `${lesson.id}-input`, ' tokens', (value) => {
    inputTokens = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-output`, ' tokens', (value) => {
    outputTokens = value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-next-step]').addEventListener('click', () => {
    activeStep = (activeStep + 1) % steps.length;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    inputTokens = 1024;
    outputTokens = 128;
    activeStep = 0;
    root.querySelector(`#${lesson.id}-input`).value = inputTokens;
    root.querySelector(`#${lesson.id}-output`).value = outputTokens;
    root.querySelectorAll('[data-output-for]').forEach((output, index) => {
      output.textContent = index === 0 ? '1024 tokens' : '128 tokens';
    });
    update();
  });
  update();
}

function renderTraining(root, lesson, shell) {
  let mode = 'tokenizer';
  let mergeLevel = 4;
  let learningRate = 0.2;
  let step = 0;
  let text = '今天学习 tokenization';
  shell.controls.innerHTML = `
    ${segmented([
      { value: 'tokenizer', label: '分词' },
      { value: 'training', label: '训练' }
    ], mode, '实验场景')}
    <label class="learning-field learning-text-field">
      <span>输入文本</span>
      <input type="text" data-token-text value="${escapeHtml(text)}" />
    </label>
    ${rangeField(`${lesson.id}-merge`, '合并词表', 0, 10, 1, mergeLevel, ' 级')}
    ${rangeField(`${lesson.id}-lr`, '学习率', 0.05, 1, 0.05, learningRate, '')}
    <button class="learning-command" type="button" data-train-step>训练一步</button>
  `;
  const update = () => {
    shell.controls.querySelector('[data-token-text]').closest('label').hidden = mode !== 'tokenizer';
    shell.controls.querySelector(`#${lesson.id}-merge`).closest('label').hidden = mode !== 'tokenizer';
    shell.controls.querySelector(`#${lesson.id}-lr`).closest('label').hidden = mode !== 'training';
    shell.controls.querySelector('[data-train-step]').hidden = mode !== 'training';
    if (mode === 'tokenizer') {
      const tokens = toyTokenize(text, mergeLevel);
      shell.stage.innerHTML = `
        <div class="tokenizer-line" aria-label="教学分词结果">
          ${tokens.map((token, index) => `<span style="--token-index:${index}">${escapeHtml(token)}</span>`).join('')}
        </div>
        <dl class="metric-strip">
          <div><dt>字符</dt><dd>${Array.from(text).length}</dd></div>
          <div><dt>教学 token</dt><dd>${tokens.length}</dd></div>
          <div><dt>合并级别</dt><dd>${mergeLevel}/10</dd></div>
        </dl>
        <p class="teaching-boundary">教学 tokenizer 只演示 BPE 合并直觉；真实计数必须使用目标模型的 tokenizer。</p>
      `;
      shell.observation.textContent = `合并常见片段后，当前文本从 ${Array.from(text).length} 个字符变成 ${tokens.length} 个教学 token。`;
    } else {
      const state = trainingState(step, learningRate);
      const history = Array.from({ length: Math.max(step, 1) }, (_, index) => trainingState(index + 1, learningRate));
      shell.stage.innerHTML = `
        <div class="training-loop">
          ${['前向预测', '计算 Loss', '反向传播', '更新参数'].map((label, index) => `
            <div data-active="${step > 0 && (step - 1) % 4 === index}"><span>${index + 1}</span><strong>${label}</strong></div>
          `).join('')}
        </div>
        <div class="loss-chart" aria-label="Loss 教学曲线">
          ${history.slice(-18).map((point) => `<i style="--loss:${Math.min(point.loss / 3.2, 1)}" title="step ${point.step}: ${point.loss.toFixed(2)}"></i>`).join('')}
        </div>
        <dl class="metric-strip">
          <div><dt>训练步</dt><dd>${step}</dd></div>
          <div><dt>Loss</dt><dd>${state.loss.toFixed(2)}</dd></div>
          <div><dt>目标概率</dt><dd>${Math.round(state.probability * 100)}%</dd></div>
        </dl>
      `;
      shell.observation.textContent = learningRate > 0.62
        ? '学习率过大，Loss 开始振荡；梯度方向没有错，步子迈过头了。'
        : '梯度给出下降方向，学习率控制每一步的幅度。';
    }
  };
  bindSegmented(shell.controls, (value) => {
    mode = value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-token-text]').addEventListener('input', (event) => {
    text = event.currentTarget.value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-merge`, ' 级', (value) => {
    mergeLevel = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-lr`, '', (value) => {
    learningRate = value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-train-step]').addEventListener('click', () => {
    step = Math.min(step + 1, 40);
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    mode = 'tokenizer';
    mergeLevel = 4;
    learningRate = 0.2;
    step = 0;
    update();
  });
  update();
}

function renderEmbedding(root, lesson, shell) {
  let mode = 'static';
  let firstId = 'king';
  let secondId = 'queen';
  shell.controls.innerHTML = `
    ${segmented([
      { value: 'static', label: '静态词向量' },
      { value: 'contextual', label: '上下文表示' }
    ], mode, '表示阶段')}
    <label class="learning-field"><span>第一个点</span><select data-first></select></label>
    <label class="learning-field"><span>第二个点</span><select data-second></select></label>
    <button class="learning-command" type="button" data-analogy>运行：国王 − 男人 + 女人</button>
  `;
  const updateOptions = () => {
    const points = embeddingPoints[mode];
    if (!points.some((point) => point.id === firstId)) firstId = points[0].id;
    if (!points.some((point) => point.id === secondId)) secondId = points[1].id;
    for (const [selector, value] of [['[data-first]', firstId], ['[data-second]', secondId]]) {
      const select = shell.controls.querySelector(selector);
      select.innerHTML = points.map((point) => `<option value="${point.id}" ${point.id === value ? 'selected' : ''}>${point.label}</option>`).join('');
    }
  };
  const update = (analogy = false) => {
    updateOptions();
    const points = embeddingPoints[mode];
    const first = points.find((point) => point.id === firstId) || points[0];
    const second = points.find((point) => point.id === secondId) || points[1];
    const cosine = cosineFromPoints(first, second);
    shell.stage.innerHTML = `
      <div class="embedding-plane" aria-label="高维向量的二维教学投影">
        <span class="axis-label">高维表示的二维教学投影</span>
        ${points.map((point) => `
          <button type="button" data-point="${point.id}" data-selected="${point.id === firstId || point.id === secondId}" style="--x:${point.x}%;--y:${point.y}%">
            <i></i><span>${point.label}</span>
          </button>
        `).join('')}
        ${analogy && mode === 'static' ? '<div class="analogy-arrow">国王 − 男人 + 女人 ≈ 皇后</div>' : ''}
      </div>
      <dl class="metric-strip">
        <div><dt>点 A</dt><dd>${first.label}</dd></div>
        <div><dt>点 B</dt><dd>${second.label}</dd></div>
        <div><dt>余弦相似度</dt><dd>${cosine.toFixed(2)}</dd></div>
      </dl>
    `;
    shell.observation.textContent = mode === 'contextual'
      ? '同一个“苹果”进入上下文层后，会因公司与水果语境落到不同位置。'
      : '相似度来自向量整体的夹角；单独一根坐标轴通常没有稳定的人类标签。';
    shell.stage.querySelectorAll('[data-point]').forEach((button) => {
      button.addEventListener('click', () => {
        firstId = secondId;
        secondId = button.dataset.point;
        markManipulated(root, lesson);
        update();
      });
    });
  };
  bindSegmented(shell.controls, (value) => {
    mode = value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-first]').addEventListener('change', (event) => {
    firstId = event.currentTarget.value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-second]').addEventListener('change', (event) => {
    secondId = event.currentTarget.value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-analogy]').addEventListener('click', () => {
    mode = 'static';
    firstId = 'king';
    secondId = 'queen';
    markManipulated(root, lesson);
    update(true);
  });
  shell.reset.addEventListener('click', () => {
    mode = 'static';
    firstId = 'king';
    secondId = 'queen';
    update();
  });
  update();
}

function renderAttention(root, lesson, shell) {
  let preset = 'pronoun';
  let queryIndex = 3;
  let causal = false;
  let separated = true;
  shell.controls.innerHTML = `
    <label class="learning-field"><span>句子</span>
      <select data-preset><option value="pronoun">猫追了狗，它跑掉了</option><option value="invoice">工程师填写报销单，等待审批人</option></select>
    </label>
    <label class="learning-toggle"><input type="checkbox" data-causal /><span>Causal Mask</span></label>
    <label class="learning-toggle"><input type="checkbox" data-separated checked /><span>Q/K 分离</span></label>
  `;
  const update = () => {
    const state = attentionState(preset, queryIndex, causal, separated);
    shell.stage.innerHTML = `
      <div class="attention-query">
        <span>点击一个 token 作为 Query</span>
        <div>${state.tokens.map((token, index) => `
          <button type="button" data-token-index="${index}" data-active="${index === state.queryIndex}">${token}</button>
        `).join('')}</div>
      </div>
      <div class="attention-bars" aria-label="Softmax 注意力权重">
        ${state.tokens.map((token, index) => `
          <div data-masked="${state.scores[index] < -20}">
            <span>${token}</span><i style="--weight:${state.weights[index]}"></i><strong>${state.scores[index] < -20 ? 'MASK' : `${Math.round(state.weights[index] * 100)}%`}</strong>
          </div>
        `).join('')}
      </div>
      <div class="attention-formula">
        <span>Q · K</span><b>→</b><span>缩放</span><b>→</b><span>Softmax</span><b>→</b><span>Σ 权重 × V</span>
      </div>
    `;
    const strongest = state.weights.indexOf(Math.max(...state.weights));
    shell.observation.textContent = causal
      ? `未来位置被设为不可见；当前 Query“${state.tokens[state.queryIndex]}”能看到的位置由 Mask 决定。`
      : `“${state.tokens[state.queryIndex]}”当前最关注“${state.tokens[strongest]}”；权重来自 Q 与各 K 的匹配。`;
    shell.stage.querySelectorAll('[data-token-index]').forEach((button) => {
      button.addEventListener('click', () => {
        queryIndex = Number(button.dataset.tokenIndex);
        markManipulated(root, lesson);
        update();
      });
    });
  };
  shell.controls.querySelector('[data-preset]').addEventListener('change', (event) => {
    preset = event.currentTarget.value;
    queryIndex = preset === 'pronoun' ? 3 : 4;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-causal]').addEventListener('change', (event) => {
    causal = event.currentTarget.checked;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-separated]').addEventListener('change', (event) => {
    separated = event.currentTarget.checked;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    preset = 'pronoun';
    queryIndex = 3;
    causal = false;
    separated = true;
    shell.controls.querySelector('[data-preset]').value = preset;
    shell.controls.querySelector('[data-causal]').checked = causal;
    shell.controls.querySelector('[data-separated]').checked = separated;
    update();
  });
  update();
}

function renderAttentionSystems(root, lesson, shell) {
  let mode = 'heads';
  let position = 6;
  let queryHeads = 32;
  let kvHeads = 8;
  let context = 32768;
  shell.controls.innerHTML = `
    ${segmented([
      { value: 'heads', label: '多头' },
      { value: 'rope', label: 'RoPE' },
      { value: 'gqa', label: 'GQA' }
    ], mode, '注意力机制')}
    ${rangeField(`${lesson.id}-position`, '位置差', 1, 24, 1, position, ' tokens')}
    ${rangeField(`${lesson.id}-query-heads`, 'Query 头', 8, 64, 8, queryHeads, '')}
    ${rangeField(`${lesson.id}-kv-heads`, 'KV 头', 1, 16, 1, kvHeads, '')}
    ${rangeField(`${lesson.id}-context`, '上下文', 4096, 131072, 4096, context, '')}
  `;
  const update = () => {
    const positionField = shell.controls.querySelector(`#${lesson.id}-position`).closest('label');
    const queryField = shell.controls.querySelector(`#${lesson.id}-query-heads`).closest('label');
    const kvField = shell.controls.querySelector(`#${lesson.id}-kv-heads`).closest('label');
    const contextField = shell.controls.querySelector(`#${lesson.id}-context`).closest('label');
    positionField.hidden = mode !== 'rope';
    queryField.hidden = mode !== 'gqa';
    kvField.hidden = mode !== 'gqa';
    contextField.hidden = mode !== 'gqa';
    if (mode === 'heads') {
      shell.stage.innerHTML = `
        <div class="head-lanes">
          <div><span>语义头</span><strong>“模型” → “学习”</strong><i style="--lane:.84"></i></div>
          <div><span>语法头</span><strong>“客户端” → “调用”</strong><i style="--lane:.68"></i></div>
          <div><span>指代头</span><strong>“它” → “狗”</strong><i style="--lane:.91"></i></div>
        </div>
      `;
      shell.observation.textContent = '多个头使用不同投影，同一句话可以同时保留语义、语法和指代关系。';
    } else if (mode === 'rope') {
      const angle = (position * 17) % 360;
      shell.stage.innerHTML = `
        <div class="rope-stage">
          <div class="rope-ring">
            <i style="--angle:0deg"><span>A</span></i>
            <i style="--angle:${angle}deg"><span>B</span></i>
          </div>
          <dl class="metric-strip">
            <div><dt>位置差</dt><dd>${position}</dd></div>
            <div><dt>教学旋转角</dt><dd>${angle}°</dd></div>
            <div><dt>编码目标</dt><dd>相对位置</dd></div>
          </dl>
        </div>
      `;
      shell.observation.textContent = 'RoPE 让 Q/K 随位置旋转，点积可以感知两个 token 的相对位置差。';
    } else {
      const safeKv = Math.min(kvHeads, queryHeads);
      const bytes = kvCacheBytes({
        layers: 80,
        kvHeads: safeKv,
        headDim: 128,
        bytesPerElement: 2,
        tokens: context
      });
      shell.stage.innerHTML = `
        <div class="gqa-groups">
          ${Array.from({ length: Math.min(safeKv, 8) }, (_, index) => `
            <div><span>KV ${index + 1}</span><i style="--queries:${Math.max(1, Math.round(queryHeads / safeKv))}"></i><strong>${Math.max(1, Math.round(queryHeads / safeKv))} Q</strong></div>
          `).join('')}
        </div>
        <dl class="metric-strip">
          <div><dt>共享比例</dt><dd>${Math.max(1, Math.round(queryHeads / safeKv))}:1</dd></div>
          <div><dt>KV Cache</dt><dd>${formatNumber(bytesToGiB(bytes), 1)} GiB</dd></div>
          <div><dt>模型口径</dt><dd>80 层 / FP16</dd></div>
        </dl>
      `;
      shell.observation.textContent = `每 ${Math.max(1, Math.round(queryHeads / safeKv))} 个 Query 头共享一组 K/V；共享越多，缓存越小。`;
    }
  };
  bindSegmented(shell.controls, (value) => {
    mode = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-position`, ' tokens', (value) => {
    position = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-query-heads`, '', (value) => {
    queryHeads = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-kv-heads`, '', (value) => {
    kvHeads = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-context`, '', (value) => {
    context = value;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    mode = 'heads';
    position = 6;
    queryHeads = 32;
    kvHeads = 8;
    context = 32768;
    update();
  });
  update();
}

function renderMultimodal(root, lesson, shell) {
  let resolution = 512;
  let patch = 16;
  let frames = 1;
  let fusion = 'early';
  shell.controls.innerHTML = `
    <label class="learning-field"><span>图像分辨率</span><select data-resolution><option>256</option><option selected>512</option><option>1024</option></select></label>
    <label class="learning-field"><span>Patch 尺寸</span><select data-patch><option selected>16</option><option>32</option></select></label>
    ${rangeField(`${lesson.id}-frames`, '帧数', 1, 12, 1, frames, ' 帧')}
    ${segmented([
      { value: 'early', label: '早期融合' },
      { value: 'cross', label: '交叉融合' }
    ], fusion, '融合方式')}
  `;
  const update = () => {
    const budget = patchBudget(resolution, patch, frames);
    const cells = Math.min(budget.patches, 144);
    shell.stage.innerHTML = `
      <div class="patch-visual">
        <div class="patch-grid" style="--patch-columns:${Math.min(budget.patchesPerSide, 12)}">
          ${Array.from({ length: cells }, (_, index) => `<i data-emphasis="${index % Math.max(1, Math.round(cells / 8)) === 0}"></i>`).join('')}
        </div>
        <div class="fusion-track" data-mode="${fusion}">
          <span>图像 patch</span><b>→</b><span>${fusion === 'early' ? '进入主 token 序列' : '保留视觉分支'}</span><b>→</b><span>语言模型</span>
        </div>
      </div>
      <dl class="metric-strip">
        <div><dt>单边 patch</dt><dd>${budget.patchesPerSide}</dd></div>
        <div><dt>教学视觉 token</dt><dd>${formatNumber(budget.visualTokens, 0)}</dd></div>
        <div><dt>注意力配对</dt><dd>${formatNumber(budget.attentionPairs, 0)}</dd></div>
      </dl>
      <p class="teaching-boundary">标准 ViT 教学模型；真实多模态模型可能继续重采样或压缩视觉 token。</p>
    `;
    shell.observation.textContent = `${resolution}×${resolution}、${patch}px patch、${frames} 帧会产生 ${formatNumber(budget.visualTokens, 0)} 个教学视觉 token。`;
  };
  shell.controls.querySelector('[data-resolution]').addEventListener('change', (event) => {
    resolution = Number(event.currentTarget.value);
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-patch]').addEventListener('change', (event) => {
    patch = Number(event.currentTarget.value);
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-frames`, ' 帧', (value) => {
    frames = value;
    markManipulated(root, lesson);
    update();
  });
  bindSegmented(shell.controls, (value) => {
    fusion = value;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    resolution = 512;
    patch = 16;
    frames = 1;
    fusion = 'early';
    update();
  });
  update();
}

function renderReasoning(root, lesson, shell) {
  let task = 'math';
  let paths = 4;
  let verifier = 0.72;
  shell.controls.innerHTML = `
    <label class="learning-field"><span>任务类型</span>
      <select data-task><option value="math">数学题</option><option value="code">代码验证</option><option value="writing">开放写作</option><option value="facts">事实查询</option></select>
    </label>
    ${rangeField(`${lesson.id}-paths`, '候选路径', 1, 12, 1, paths, ' 条')}
    ${rangeField(`${lesson.id}-verifier`, '评估可靠度', 0.2, 0.98, 0.02, verifier, '')}
  `;
  const update = () => {
    const state = reasoningBudget(task, paths, verifier);
    shell.stage.innerHTML = `
      <div class="reasoning-tree">
        ${Array.from({ length: state.paths }, (_, index) => {
          const quality = ((index * 37 + 29) % 100) / 100;
          return `<div data-selected="${quality <= state.success && index === Math.floor(state.paths / 2)}"><span>路径 ${index + 1}</span><i style="--quality:${quality}"></i><strong>${Math.round(quality * 100)}</strong></div>`;
        }).join('')}
      </div>
      <dl class="metric-strip">
        <div><dt>相对计算量</dt><dd>${state.relativeCost}×</dd></div>
        <div><dt>候选覆盖</dt><dd>${Math.round(state.coverage * 100)}%</dd></div>
        <div><dt>教学成功率</dt><dd>${Math.round(state.success * 100)}%</dd></div>
      </dl>
      <p class="teaching-boundary">搜索树和评估器是教学模型，不代表任何闭源推理模型的隐藏实现。</p>
    `;
    shell.observation.textContent = task === 'writing'
      ? '开放写作缺少唯一正确答案，增加候选数不一定带来稳定收益。'
      : `更多候选提高覆盖，但评估可靠度 ${Math.round(verifier * 100)}% 决定能否选对。`;
  };
  shell.controls.querySelector('[data-task]').addEventListener('change', (event) => {
    task = event.currentTarget.value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-paths`, ' 条', (value) => {
    paths = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-verifier`, '', (value) => {
    verifier = value;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    task = 'math';
    paths = 4;
    verifier = 0.72;
    update();
  });
  update();
}

function renderDevice(root, lesson, shell) {
  let deviceGiB = 16;
  let modelKey = '7';
  let bitWidth = 4;
  let context = 32768;
  shell.controls.innerHTML = `
    <label class="learning-field"><span>可用内存</span><select data-device><option>8</option><option selected>16</option><option>24</option><option>32</option><option>64</option></select></label>
    <label class="learning-field"><span>模型</span><select data-model><option value="1.5">1.5B 教学模型</option><option value="7" selected>7B 教学模型</option><option value="13">13B 教学模型</option><option value="70">Llama 3.1 70B</option></select></label>
    <label class="learning-field"><span>权重精度</span><select data-precision><option value="4" selected>INT4</option><option value="8">INT8</option><option value="16">FP16</option></select></label>
    ${rangeField(`${lesson.id}-context`, '上下文', 4096, 131072, 4096, context, ' tokens')}
  `;
  const update = () => {
    const fit = deviceFit({ deviceGiB, modelKey, bitWidth, context });
    const statusText = fit.status === 'fit' ? '可运行' : fit.status === 'tight' ? '很勉强' : '放不下';
    shell.stage.innerHTML = `
      <div class="memory-gauge" data-status="${fit.status}">
        <header><span>${fit.model.label}</span><strong>${statusText}</strong></header>
        <div class="memory-stack" style="--used:${Math.min(fit.ratio, 1) * 100}%">
          <i style="--part:${fit.weightsGiB / deviceGiB * 100}%" data-part="weights">权重</i>
          <i style="--part:${fit.kvGiB / deviceGiB * 100}%" data-part="kv">KV</i>
          <i style="--part:${fit.runtimeGiB / deviceGiB * 100}%" data-part="runtime">运行时</i>
        </div>
        <span>${formatNumber(fit.totalGiB, 1)} / ${deviceGiB} GiB</span>
      </div>
      <dl class="metric-strip">
        <div><dt>权重</dt><dd>${formatNumber(fit.weightsGiB, 1)} GiB</dd></div>
        <div><dt>KV Cache</dt><dd>${formatNumber(fit.kvGiB, 1)} GiB</dd></div>
        <div><dt>运行时预留</dt><dd>${formatNumber(fit.runtimeGiB, 1)} GiB</dd></div>
      </dl>
      <p class="teaching-boundary">权重按理想位宽估算；真实量化格式、引擎与设备还会产生额外开销。</p>
    `;
    shell.observation.textContent = fit.status === 'overflow'
      ? `权重之外还需 ${formatNumber(fit.kvGiB + fit.runtimeGiB, 1)} GiB；文件能下载不等于设备能稳定推理。`
      : `当前配置共需约 ${formatNumber(fit.totalGiB, 1)} GiB，仍要给系统和推理引擎留出余量。`;
  };
  shell.controls.querySelector('[data-device]').addEventListener('change', (event) => {
    deviceGiB = Number(event.currentTarget.value);
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-model]').addEventListener('change', (event) => {
    modelKey = event.currentTarget.value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-precision]').addEventListener('change', (event) => {
    bitWidth = Number(event.currentTarget.value);
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-context`, ' tokens', (value) => {
    context = value;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    deviceGiB = 16;
    modelKey = '7';
    bitWidth = 4;
    context = 32768;
    update();
  });
  update();
}

function renderMamba(root, lesson, shell) {
  let length = 8192;
  let retention = 0.72;
  let hybrid = 0.1;
  shell.controls.innerHTML = `
    ${rangeField(`${lesson.id}-length`, '序列长度', 1024, 131072, 1024, length, ' tokens')}
    ${rangeField(`${lesson.id}-retention`, '状态保留强度', 0.2, 0.98, 0.02, retention, '')}
    ${rangeField(`${lesson.id}-hybrid`, 'Attention 比例', 0, 0.5, 0.05, hybrid, '')}
  `;
  const update = () => {
    const state = mambaMemory(length, retention, hybrid);
    shell.stage.innerHTML = `
      <div class="memory-rails">
        <div>
          <header><span>Transformer</span><strong>${formatNumber(state.transformerUnits, 0)} 历史单位</strong></header>
          <div class="rail-tokens">${Array.from({ length: 18 }, (_, index) => `<i data-old="${index < 4}"></i>`).join('')}</div>
        </div>
        <div>
          <header><span>Mamba</span><strong>${state.mambaUnits} 固定状态单位</strong></header>
          <div class="state-capsule"><i style="--retention:${state.recall}"></i><span>hₜ</span></div>
        </div>
      </div>
      <dl class="metric-strip">
        <div><dt>Transformer 缓存</dt><dd>O(N)</dd></div>
        <div><dt>Mamba 推理状态</dt><dd>O(1)</dd></div>
        <div><dt>教学精确回忆</dt><dd>${Math.round(state.recall * 100)}%</dd></div>
      </dl>
    `;
    shell.observation.textContent = `整段处理仍随 N 线性增长；固定的是自回归推理状态大小，不是总计算量。`;
  };
  bindRange(shell.controls, `${lesson.id}-length`, ' tokens', (value) => {
    length = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-retention`, '', (value) => {
    retention = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-hybrid`, '', (value) => {
    hybrid = value;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    length = 8192;
    retention = 0.72;
    hybrid = 0.1;
    update();
  });
  update();
}

function renderTransformer(root, lesson, shell) {
  let preset = 'gpt';
  let tokenIndex = 3;
  const presets = {
    bert: { encoder: true, decoder: false, mask: false, cross: false, task: '理解 / 分类' },
    gpt: { encoder: false, decoder: true, mask: true, cross: false, task: '自回归生成' },
    t5: { encoder: true, decoder: true, mask: true, cross: true, task: '翻译 / 转换' }
  };
  shell.controls.innerHTML = `
    ${segmented([
      { value: 'bert', label: 'BERT' },
      { value: 'gpt', label: 'GPT' },
      { value: 't5', label: 'T5' }
    ], preset, '架构预设')}
    ${rangeField(`${lesson.id}-token`, '观察 token', 0, 5, 1, tokenIndex, '')}
  `;
  const update = () => {
    const current = presets[preset];
    const visible = Array.from({ length: 6 }, (_, index) => !current.mask || index <= tokenIndex);
    shell.stage.innerHTML = `
      <div class="transformer-builder">
        <div data-enabled="${current.encoder}"><span>Encoder</span><strong>双向读取</strong></div>
        <b>→</b>
        <div data-enabled="${current.cross}"><span>Cross-Attention</span><strong>查询源文本</strong></div>
        <b>→</b>
        <div data-enabled="${current.decoder}"><span>Decoder</span><strong>${current.mask ? '只看过去' : '双向读取'}</strong></div>
      </div>
      <div class="visibility-row" aria-label="当前 token 的可见范围">
        ${visible.map((isVisible, index) => `<i data-visible="${isVisible}" data-current="${index === tokenIndex}">${index + 1}</i>`).join('')}
      </div>
      <dl class="metric-strip">
        <div><dt>架构</dt><dd>${preset.toUpperCase()}</dd></div>
        <div><dt>适合任务</dt><dd>${current.task}</dd></div>
        <div><dt>可见 token</dt><dd>${visible.filter(Boolean).length}/6</dd></div>
      </dl>
    `;
    shell.observation.textContent = preset === 't5'
      ? 'Encoder 先读完整源文本，Decoder 通过 Cross-Attention 查询源表示并逐步生成。'
      : preset === 'gpt'
        ? 'Causal Mask 让当前位置只能依赖自己和过去，适合自回归生成。'
        : 'Encoder 双向读取整段输入，适合理解和分类任务。';
  };
  bindSegmented(shell.controls, (value) => {
    preset = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-token`, '', (value) => {
    tokenIndex = value;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    preset = 'gpt';
    tokenIndex = 3;
    update();
  });
  update();
}

function renderClientApi(root, lesson, shell) {
  let mode = 'sampling';
  let temperature = 0.8;
  let topK = 5;
  let topP = 0.9;
  let streamStep = 0;
  shell.controls.innerHTML = `
    ${segmented([
      { value: 'sampling', label: '采样' },
      { value: 'function', label: '工具调用' },
      { value: 'evidence', label: '事实来源' },
      { value: 'system', label: '约束' },
      { value: 'stream', label: '流式' }
    ], mode, '客户端实验')}
    ${rangeField(`${lesson.id}-temperature`, 'Temperature', 0.1, 1.8, 0.1, temperature, '')}
    ${rangeField(`${lesson.id}-topk`, 'Top-k', 1, 8, 1, topK, '')}
    ${rangeField(`${lesson.id}-topp`, 'Top-p', 0.2, 1, 0.05, topP, '')}
    <button class="learning-command" type="button" data-action>执行下一步</button>
  `;
  const update = () => {
    for (const id of ['temperature', 'topk', 'topp']) {
      shell.controls.querySelector(`#${lesson.id}-${id}`).closest('label').hidden = mode !== 'sampling';
    }
    const action = shell.controls.querySelector('[data-action]');
    action.hidden = mode === 'sampling';
    action.textContent = mode === 'stream' ? '接收下一个 token' : '执行下一步';
    if (mode === 'sampling') {
      const result = sampleTokens({ temperature, topK, topP, seed: 20260826 });
      shell.stage.innerHTML = `
        <div class="sampling-candidates">
          ${result.candidates.map((item) => `<div><span>${item.token}</span><i style="--prob:${item.probability}"></i><strong>${Math.round(item.probability * 100)}%</strong></div>`).join('')}
        </div>
        <div class="sample-output"><span>固定 seed 的 8 次采样</span><strong>${result.samples.join(' · ')}</strong></div>
      `;
      shell.observation.textContent = 'Temperature 改变分布陡峭度，Top-k 和 Top-p 缩小候选集；三者不改变模型参数。';
    } else if (mode === 'function') {
      shell.stage.innerHTML = `
        <div class="function-flow">
          <div><span>1</span><strong>模型生成调用 JSON</strong><code>{"name":"getBalance","account":"A-17"}</code></div>
          <b>→</b><div><span>2</span><strong>客户端执行真实函数</strong><code>balance = 328.40</code></div>
          <b>→</b><div><span>3</span><strong>结果回填模型</strong><code>当前余额为 328.40 元</code></div>
        </div>
      `;
      shell.observation.textContent = '模型只生成结构化调用意图；真正执行函数、鉴权和回填结果的是客户端。';
    } else if (mode === 'evidence') {
      shell.stage.innerHTML = `
        <div class="evidence-modes">
          <div data-reliable="false"><span>参数记忆</span><strong>可能过期</strong><p>来源不可核对</p></div>
          <div data-reliable="true"><span>提供上下文</span><strong>可引用</strong><p>受上下文范围限制</p></div>
          <div data-reliable="true"><span>调用工具</span><strong>可回查</strong><p>适合实时事实</p></div>
        </div>
      `;
      shell.observation.textContent = '幻觉的核心是缺少可核对证据；实时余额这类事实应通过工具取得。';
    } else if (mode === 'system') {
      shell.stage.innerHTML = `
        <div class="constraint-layers">
          <div><span>System Prompt</span><strong>概率引导</strong><p>告诉模型偏好和角色，但不能代替权限校验。</p></div>
          <div><span>Schema / Validator</span><strong>结构硬约束</strong><p>在客户端拒绝不合法输出。</p></div>
          <div><span>Auth / ACL</span><strong>权限硬边界</strong><p>在模型之外控制真实操作。</p></div>
        </div>
      `;
      shell.observation.textContent = 'Prompt 能影响行为倾向，真正的格式和权限保证必须由程序执行。';
    } else {
      const tokens = ['正在', '读取', '设备', '状态', '，', '请', '稍候', '。'];
      streamStep = Math.min(streamStep, tokens.length);
      shell.stage.innerHTML = `
        <div class="stream-console">
          <header><span>SSE stream</span><strong>${streamStep === tokens.length ? '完成' : '接收中'}</strong></header>
          <p>${tokens.slice(0, streamStep).join('') || '等待首个 token…'}<i></i></p>
          <div><span>${streamStep}/${tokens.length} token</span><button type="button" data-cancel>取消</button></div>
        </div>
      `;
      shell.observation.textContent = 'Streaming 改变等待体验，并允许客户端尽早展示或取消；已经生成的 token 仍可能产生费用。';
      shell.stage.querySelector('[data-cancel]').addEventListener('click', () => {
        streamStep = 0;
        markManipulated(root, lesson);
        update();
      });
    }
  };
  bindSegmented(shell.controls, (value) => {
    mode = value;
    if (mode === 'stream') streamStep = 0;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-temperature`, '', (value) => {
    temperature = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-topk`, '', (value) => {
    topK = value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-topp`, '', (value) => {
    topP = value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-action]').addEventListener('click', () => {
    if (mode === 'stream') streamStep = Math.min(streamStep + 1, 8);
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    mode = 'sampling';
    temperature = 0.8;
    topK = 5;
    topP = 0.9;
    streamStep = 0;
    update();
  });
  update();
}

function renderReference(root, lesson, shell) {
  let query = '';
  let params = 7;
  let bitWidth = 4;
  let context = 32768;
  const terms = course.lessons.slice(0, 11).map((item) => ({
    title: item.shortTitle,
    text: item.sourceAnchor,
    href: lessonHref(item.id)
  }));
  shell.controls.innerHTML = `
    <label class="learning-field learning-text-field"><span>搜索术语</span><input type="search" data-search placeholder="例如：KV Cache" /></label>
    ${rangeField(`${lesson.id}-params`, '参数量', 1, 70, 1, params, 'B')}
    <label class="learning-field"><span>权重精度</span><select data-precision><option value="4" selected>4 bit</option><option value="8">8 bit</option><option value="16">16 bit</option></select></label>
    ${rangeField(`${lesson.id}-context`, '上下文', 4096, 131072, 4096, context, ' tokens')}
  `;
  const update = () => {
    const weightGiB = bytesToGiB(weightBytes(params, bitWidth));
    const kvGiB = bytesToGiB(kvCacheBytes({
      layers: 32,
      kvHeads: 8,
      headDim: 128,
      bytesPerElement: 2,
      tokens: context
    }));
    const matches = terms.filter((term) => `${term.title}${term.text}`.toLowerCase().includes(query.toLowerCase())).slice(0, 4);
    shell.stage.innerHTML = `
      <div class="reference-results">
        ${matches.length ? matches.map((term) => `<a href="${term.href}"><strong>${term.title}</strong><span>${term.text}</span></a>`).join('') : '<p>没有匹配术语，试试“注意力”“端侧”或“流式”。</p>'}
      </div>
      <dl class="metric-strip">
        <div><dt>理想权重占用</dt><dd>${formatNumber(weightGiB, 1)} GiB</dd></div>
        <div><dt>教学 KV Cache</dt><dd>${formatNumber(kvGiB, 1)} GiB</dd></div>
        <div><dt>合计不含运行时</dt><dd>${formatNumber(weightGiB + kvGiB, 1)} GiB</dd></div>
      </dl>
      <p class="teaching-boundary">KV 示例固定为 32 层、8 KV 头、head dim 128、FP16；结果必须连同假设一起使用。</p>
    `;
    shell.observation.textContent = '固定表格只是一个切片；可计算工具把模型结构、精度和上下文条件重新放回结果旁边。';
  };
  shell.controls.querySelector('[data-search]').addEventListener('input', (event) => {
    query = event.currentTarget.value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-params`, 'B', (value) => {
    params = value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-precision]').addEventListener('change', (event) => {
    bitWidth = Number(event.currentTarget.value);
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-context`, ' tokens', (value) => {
    context = value;
    markManipulated(root, lesson);
    update();
  });
  shell.reset.addEventListener('click', () => {
    query = '';
    params = 7;
    bitWidth = 4;
    context = 32768;
    update();
  });
  update();
}

const renderers = {
  journey: renderJourney,
  training: renderTraining,
  embedding: renderEmbedding,
  attention: renderAttention,
  'attention-systems': renderAttentionSystems,
  multimodal: renderMultimodal,
  reasoning: renderReasoning,
  'on-device': renderDevice,
  mamba: renderMamba,
  transformer: renderTransformer,
  'client-api': renderClientApi,
  reference: renderReference
};

function mountExperiment(root) {
  if (root.dataset.mounted === 'true') return;
  const lesson = lessonMap.get(root.dataset.learningExperiment);
  if (!lesson) {
    root.textContent = '实验配置不存在。';
    return;
  }
  const mode = root.dataset.mode === 'article' ? 'article' : 'course';
  root.dataset.mounted = 'true';
  const shell = createShell(root, lesson, mode);
  bindCheckpoint(root, lesson);
  markProgress(lesson.id, 'opened');
  const renderer = renderers[lesson.experimentId];
  if (renderer) renderer(root, lesson, shell);
  syncLarkHeight();
}

export function initLearningExperiments() {
  const roots = Array.from(document.querySelectorAll('[data-learning-experiment]'));
  if (!roots.length) {
    updateProgressUI();
    bindProgressActions();
    hydrateProgressFromLark();
    return;
  }

  if (
    document.documentElement.dataset.learningHost === 'lark'
    || !('IntersectionObserver' in window)
  ) {
    roots.forEach(mountExperiment);
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        mountExperiment(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '320px 0px' });
    roots.forEach((root) => observer.observe(root));
  }
  updateProgressUI();
  bindProgressActions();
  window.setTimeout(hydrateProgressFromLark, 0);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLearningExperiments, { once: true });
  } else {
    initLearningExperiments();
  }
}
