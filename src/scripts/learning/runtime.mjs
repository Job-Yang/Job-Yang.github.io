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
const SOUND_KEY = `${COURSE_KEY}:sound`;
const lessonMap = new Map(course.lessons.map((lesson) => [lesson.id, lesson]));
let memoryProgress = { version: course.version, lessons: {}, lastLesson: 'journey' };
let larkProgressReady = false;
let audioContext;
let lastCueAt = 0;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function soundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    // Sound preference can remain session-only when storage is unavailable.
  }
}

function ensureAudio() {
  if (!soundEnabled()) return null;
  const AudioCtor = window.AudioContext;
  if (!AudioCtor) return null;
  audioContext ??= new AudioCtor();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function playCue(kind = 'change') {
  const now = performance.now();
  if (now - lastCueAt < 90) return;
  lastCueAt = now;
  const audio = ensureAudio();
  if (!audio || audio.state !== 'running') return;
  const cues = {
    open: [330, 494, 0.11, 0.018],
    change: [520, 660, 0.08, 0.012],
    step: [440, 784, 0.13, 0.018],
    success: [660, 990, 0.18, 0.022],
    warning: [190, 140, 0.2, 0.025],
    reset: [420, 280, 0.12, 0.014]
  };
  const [from, to, duration, volume] = cues[kind] || cues.change;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = kind === 'warning' ? 'triangle' : 'sine';
  oscillator.frequency.setValueAtTime(from, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(to, audio.currentTime + duration);
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration + 0.02);
}

function animateStage(stage, tone = 'change') {
  if (!stage || prefersReducedMotion()) return;
  stage.animate(
    [
      { opacity: 0.72, transform: 'translateY(5px)', filter: 'brightness(.82)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'brightness(1.08)', offset: 0.72 },
      { opacity: 1, transform: 'translateY(0)', filter: 'brightness(1)' }
    ],
    {
      duration: tone === 'step' ? 420 : 300,
      easing: 'cubic-bezier(.2,.8,.2,1)'
    }
  );
}

function setExplanation(shell, { action, mechanism, evidence, impact, tone = 'change' }) {
  shell.causeAction.textContent = action;
  shell.causeMechanism.textContent = mechanism;
  shell.causeEvidence.textContent = evidence;
  shell.causeImpact.textContent = impact;
  shell.resultPanel.dataset.tone = tone;
}

function signed(value, digits = 0, suffix = '') {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? '+' : ''}${formatNumber(rounded, digits)}${suffix}`;
}

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
        <div class="learning-head-actions">
          <button class="learning-icon-button" type="button" data-sound aria-pressed="${soundEnabled()}" title="切换实验音效" aria-label="${soundEnabled() ? '关闭实验音效' : '开启实验音效'}">${soundEnabled() ? '♪' : '♩'}</button>
          <button class="learning-icon-button" type="button" data-reset title="恢复初始状态" aria-label="恢复初始状态">↻</button>
        </div>
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
        <div class="learning-cause-grid" aria-label="本次变化的因果解释">
          <div><span>你改了什么</span><p data-cause-action>等待第一次操作</p></div>
          <div><span>系统发生了什么</span><p data-cause-mechanism>状态会在这里展开</p></div>
          <div><span>你看见了什么</span><p data-cause-evidence>前后结果会保留对照</p></div>
          <div><span>实际影响</span><p data-cause-impact>${escapeHtml(lesson.mission.successSignal)}</p></div>
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
    playCue('open');
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
    playCue('reset');
    root.removeAttribute('data-mounted');
    root.removeAttribute('data-manipulated');
    root.removeAttribute('data-started');
    mountExperiment(root);
  });
  const sound = root.querySelector('[data-sound]');
  sound.addEventListener('click', () => {
    const enabled = !soundEnabled();
    setSoundEnabled(enabled);
    sound.setAttribute('aria-pressed', String(enabled));
    sound.setAttribute('aria-label', enabled ? '关闭实验音效' : '开启实验音效');
    sound.textContent = enabled ? '♪' : '♩';
    if (enabled) playCue('open');
  });
  root.addEventListener('pointerdown', () => ensureAudio(), { once: true });

  const stage = root.querySelector('[data-stage]');
  const stageObserver = new MutationObserver(() => animateStage(stage));
  stageObserver.observe(stage, { childList: true, subtree: false });
  return {
    controls: root.querySelector('[data-controls]'),
    stage,
    observation: root.querySelector('[data-observation]'),
    reset,
    interactionState: root.querySelector('[data-interaction-state]'),
    resultPanel: root.querySelector('[data-result-panel]'),
    causeAction: root.querySelector('[data-cause-action]'),
    causeMechanism: root.querySelector('[data-cause-mechanism]'),
    causeEvidence: root.querySelector('[data-cause-evidence]'),
    causeImpact: root.querySelector('[data-cause-impact]')
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
    playCue(correct ? 'success' : 'warning');
    markProgress(lesson.id, correct ? 'completed' : 'manipulated', attempts);
    root.dispatchEvent(new CustomEvent('learning:checkpoint', {
      bubbles: true,
      detail: { lessonId: lesson.id, correct, attempts }
    }));
  });
}

function markManipulated(root, lesson, cue = 'change') {
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
  playCue(cue);
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
  const prompt = '今天天气怎么样？';
  const promptTokens = [
    ['今天', '8142'],
    ['天气', '1968'],
    ['怎么样', '22710'],
    ['？', '30']
  ];
  const steps = [
    ['Tokenizer', '字符串被切成模型词表里的片段，每个片段换成整数 ID。'],
    ['Embedding', '每个 token ID 查表，得到模型可以计算的连续向量。'],
    ['位置编码', '位置被写进表示，模型才能区分“今天”和“天气”的先后。'],
    ['Prefill', '四个输入 token 一起穿过 Transformer，并建立后续复用的 KV Cache。'],
    ['Sampling', '模型给下一个 token 排出候选概率，再从候选里选一个。'],
    ['Decode', '新 token 接回上下文，模型复用缓存继续预测，回答逐字增长。'],
    ['De-tokenize', '整数 token 被拼回字符串，客户端把结果展示给用户。']
  ];
  const artifacts = [
    () => `
      <div class="token-transform" data-kind="tokenize">
        <div class="source-string"><span>原始字符串</span><strong>“${prompt}”</strong></div>
        <b aria-hidden="true">→</b>
        <div class="journey-token-row">
          ${promptTokens.map(([token, id], index) => `<span style="--delay:${index}"><strong>${token}</strong><small>ID ${id}</small></span>`).join('')}
        </div>
      </div>
    `,
    () => `
      <div class="vector-lookup">
        ${promptTokens.map(([token, id], index) => `
          <div style="--delay:${index}">
            <span>${token}</span><small>ID ${id}</small>
            <b aria-hidden="true">→</b>
            <code>[${(0.14 + index * 0.11).toFixed(2)}, ${(-0.32 + index * 0.07).toFixed(2)}, ${(0.81 - index * 0.09).toFixed(2)}, …]</code>
          </div>
        `).join('')}
      </div>
    `,
    () => `
      <div class="position-track">
        ${promptTokens.map(([token], index) => `
          <div style="--position:${index};--delay:${index}">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <strong>${token}</strong>
            <i style="--turn:${index * 31}deg"></i>
          </div>
        `).join('')}
        <p>相同向量放在不同位置，会得到不同的旋转相位。</p>
      </div>
    `,
    () => `
      <div class="prefill-scene">
        <div class="prefill-token-grid">
          ${promptTokens.map(([token], row) => `
            <div style="--delay:${row}">
              <strong>${token}</strong>
              ${promptTokens.map((_, column) => `<i style="--strength:${Math.max(.12, 1 - Math.abs(row - column) * .22)}"></i>`).join('')}
            </div>
          `).join('')}
        </div>
        <div class="kv-cache-build">
          <span>KV Cache</span>
          ${promptTokens.map(([token], index) => `<i style="--delay:${index}">${token}</i>`).join('')}
        </div>
      </div>
    `,
    () => `
      <div class="sampling-scene">
        <div><span>今天</span><i style="--prob:.46"></i><strong>46%</strong></div>
        <div><span>当前</span><i style="--prob:.28"></i><strong>28%</strong></div>
        <div><span>根据</span><i style="--prob:.16"></i><strong>16%</strong></div>
        <div><span>这个</span><i style="--prob:.10"></i><strong>10%</strong></div>
        <p><span>被选中</span><strong>今天</strong></p>
      </div>
    `,
    () => `
      <div class="decode-scene">
        <div class="decode-context">${promptTokens.map(([token]) => `<span>${token}</span>`).join('')}</div>
        <b aria-hidden="true">+</b>
        <div class="decode-output">
          ${['今天', '天气', '晴朗', '，', '气温', '适宜', '。'].map((token, index) => `<span style="--delay:${index}">${token}</span>`).join('')}
        </div>
        <p>每生成一个 token，就把它接回上下文，再预测下一个。</p>
      </div>
    `,
    () => `
      <div class="detokenize-scene">
        <div>${['今天', '天气', '晴朗', '，', '气温', '适宜', '。'].map((token, index) => `<code style="--delay:${index}">${token}</code>`).join('')}</div>
        <b aria-hidden="true">→</b>
        <p><span>客户端最终显示</span><strong>今天天气晴朗，气温适宜。</strong></p>
      </div>
    `
  ];
  shell.controls.innerHTML = `
    <div class="journey-prompt">
      <span>贯穿输入</span>
      <strong>“${prompt}”</strong>
    </div>
    ${rangeField(`${lesson.id}-input`, '上下文长度（模拟）', 128, 8192, 128, inputTokens, ' tokens')}
    ${rangeField(`${lesson.id}-output`, '回答长度（模拟）', 16, 512, 16, outputTokens, ' tokens')}
    <button class="learning-command learning-command--primary" type="button" data-next-step>进入下一步 <span aria-hidden="true">→</span></button>
  `;
  const update = (explanation) => {
    const estimate = estimateJourney(inputTokens, outputTokens);
    shell.stage.innerHTML = `
      <div class="pipeline-steps" role="list">
        ${steps.map((step, index) => `
          <button type="button" role="listitem" data-step="${index}" data-active="${index === activeStep}" data-complete="${index < activeStep}">
            <span>${String(index + 1).padStart(2, '0')}</span><strong>${step[0]}</strong>
          </button>
        `).join('')}
      </div>
      <div class="journey-process-stage" data-process-step="${activeStep}">
        <header><span>当前处理</span><strong>${steps[activeStep][0]}</strong><p>${steps[activeStep][1]}</p></header>
        <div class="journey-artifact">${artifacts[activeStep]()}</div>
      </div>
      <div class="pipeline-detail">
        <div><span>性能侧写</span><strong>${inputTokens.toLocaleString()} in / ${outputTokens} out</strong><p>教学估算只用来观察输入侧与输出侧的不同压力。</p></div>
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
    shell.observation.textContent = explanation?.evidence || (
      activeStep < 4
        ? `${steps[activeStep][0]} 正在处理已有输入；当前估算 TTFT 为 ${formatNumber(estimate.ttftMs, 0)} ms。`
        : `${steps[activeStep][0]} 已进入输出链路；${outputTokens} 个输出 token 约需 ${formatNumber(estimate.decodeMs / 1000, 1)} 秒。`
    );
    setExplanation(shell, explanation || {
      action: `查看第 ${activeStep + 1} 步：${steps[activeStep][0]}`,
      mechanism: steps[activeStep][1],
      evidence: activeStep < 4 ? '回答还没有出现，系统仍在准备首个输出 token。' : '回答已经开始生成，后续 token 逐个追加。',
      impact: activeStep < 4 ? '这几步主要影响首字延迟。' : '这几步主要影响吐字速度和回答长度。',
      tone: 'step'
    });
    shell.stage.querySelectorAll('[data-step]').forEach((button) => {
      button.addEventListener('click', () => {
        activeStep = Number(button.dataset.step);
        markManipulated(root, lesson, 'step');
        update();
      });
    });
  };
  bindRange(shell.controls, `${lesson.id}-input`, ' tokens', (value) => {
    const previous = estimateJourney(inputTokens, outputTokens);
    inputTokens = value;
    markManipulated(root, lesson);
    const current = estimateJourney(inputTokens, outputTokens);
    update({
      action: `把上下文从 ${previous.input} 调到 ${current.input} tokens`,
      mechanism: 'Prefill 要一次处理更多已有 token，并为它们建立上下文表示与缓存。',
      evidence: `TTFT ${formatNumber(previous.ttftMs, 0)} → ${formatNumber(current.ttftMs, 0)} ms（${signed(current.ttftMs - previous.ttftMs, 0, ' ms')}），Decode 吞吐只变化 ${signed(current.tps - previous.tps, 1, ' tok/s')}。`,
      impact: '长提示词首先拖慢首字；它不会按相同比例拖慢后续每个 token。',
      tone: current.ttftMs > previous.ttftMs ? 'warning' : 'change'
    });
  });
  bindRange(shell.controls, `${lesson.id}-output`, ' tokens', (value) => {
    const previous = estimateJourney(inputTokens, outputTokens);
    outputTokens = value;
    markManipulated(root, lesson);
    const current = estimateJourney(inputTokens, outputTokens);
    update({
      action: `把回答预算从 ${previous.output} 调到 ${current.output} tokens`,
      mechanism: 'Decode 需要多运行自回归循环，每轮只追加一个新 token。',
      evidence: `Decode 时间 ${formatNumber(previous.decodeMs / 1000, 1)} → ${formatNumber(current.decodeMs / 1000, 1)} 秒，TTFT 基本不变。`,
      impact: '回答越长，总等待越久；首字速度和完整回答耗时要分开看。',
      tone: current.output > previous.output ? 'warning' : 'change'
    });
  });
  shell.controls.querySelector('[data-next-step]').addEventListener('click', () => {
    activeStep = (activeStep + 1) % steps.length;
    markManipulated(root, lesson, activeStep === steps.length - 1 ? 'success' : 'step');
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
  update({
    action: '从原始问题开始',
    mechanism: '先把字符串切成 token，后续每一步都沿用同一条输入。',
    evidence: '“今天天气怎么样？”仍是可读文字，尚未进入模型计算。',
    impact: '单步推进时，你会看到它怎样逐渐变成回答。',
    tone: 'ready'
  });
}

function renderTraining(root, lesson, shell) {
  let mode = 'tokenizer';
  let mergeLevel = 4;
  let learningRate = 0.2;
  let step = 0;
  let text = '今天学习 tokenization';
  const trainingPrompt = '今天天气真';
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
  const update = (explanation) => {
    shell.controls.querySelector('[data-token-text]').closest('label').hidden = mode !== 'tokenizer';
    shell.controls.querySelector(`#${lesson.id}-merge`).closest('label').hidden = mode !== 'tokenizer';
    shell.controls.querySelector(`#${lesson.id}-lr`).closest('label').hidden = mode !== 'training';
    shell.controls.querySelector('[data-train-step]').hidden = mode !== 'training';
    if (mode === 'tokenizer') {
      const tokens = toyTokenize(text, mergeLevel);
      shell.stage.innerHTML = `
        <div class="lab-source-line"><span>输入字符串</span><strong>“${escapeHtml(text)}”</strong></div>
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
      setExplanation(shell, explanation || {
        action: `用合并级别 ${mergeLevel} 切分“${text}”`,
        mechanism: 'BPE 优先把词表中的常见连续片段合成一个 token，罕见片段继续拆开。',
        evidence: `${Array.from(text).length} 个字符被切成 ${tokens.length} 个教学 token，边框就是本次 token 边界。`,
        impact: 'token 越多，占用的上下文和推理成本通常越高；真实结果取决于目标模型词表。'
      });
    } else {
      const state = trainingState(step, learningRate);
      const history = Array.from({ length: Math.max(step, 1) }, (_, index) => trainingState(index + 1, learningRate));
      const phase = step === 0 ? 0 : (step - 1) % 4;
      const targetProbability = Math.round(state.probability * 100);
      const wrongProbability = Math.max(1, Math.round((100 - targetProbability) * 0.55));
      const phaseDetails = [
        `模型读到“${trainingPrompt}”，给下一个 token 排概率。`,
        `正确答案“好”的概率只有 ${targetProbability}%，交叉熵把偏差变成 Loss ${state.loss.toFixed(2)}。`,
        '梯度从 Loss 往回传，为相关参数标出应该增加还是减少。',
        `参数按学习率 ${learningRate} 移动一步，下一轮重新预测。`
      ];
      shell.stage.innerHTML = `
        <div class="training-example">
          <div><span>训练样本</span><strong>“${trainingPrompt}<mark>好</mark>”</strong></div>
          <div class="prediction-race">
            <p><span>好</span><i style="--prob:${state.probability}"></i><strong>${targetProbability}%</strong></p>
            <p><span>鸡</span><i style="--prob:${wrongProbability / 100}"></i><strong>${wrongProbability}%</strong></p>
          </div>
        </div>
        <div class="training-loop">
          ${['前向预测', '计算 Loss', '反向传播', '更新参数'].map((label, index) => `
            <div data-active="${phase === index}" data-complete="${step > 0 && index < phase}">
              <span>${index + 1}</span><strong>${label}</strong><p>${phaseDetails[index]}</p>
            </div>
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
      setExplanation(shell, explanation || {
        action: step ? `执行第 ${step} 个训练步骤` : '查看训练前的随机预测',
        mechanism: phaseDetails[phase],
        evidence: `“好”的教学概率为 ${targetProbability}%，Loss 为 ${state.loss.toFixed(2)}。`,
        impact: learningRate > 0.62 ? '步长过大会越过低谷，Loss 上下振荡，训练难以稳定。' : '反复纠错会提高正确 token 的概率，让 Loss 逐步下降。',
        tone: learningRate > 0.62 ? 'warning' : 'step'
      });
    }
  };
  bindSegmented(shell.controls, (value) => {
    mode = value;
    markManipulated(root, lesson, 'step');
    update();
  });
  shell.controls.querySelector('[data-token-text]').addEventListener('input', (event) => {
    text = event.currentTarget.value;
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-merge`, ' 级', (value) => {
    const previous = toyTokenize(text, mergeLevel).length;
    mergeLevel = value;
    markManipulated(root, lesson);
    const current = toyTokenize(text, mergeLevel).length;
    update({
      action: `把合并级别调到 ${mergeLevel}`,
      mechanism: mergeLevel === 0 ? '关闭常见片段合并，字符串按更细粒度切开。' : '更多常见片段被词表识别并合成一个 token。',
      evidence: `教学 token 数 ${previous} → ${current}（${signed(current - previous)}）。`,
      impact: '同一段文字的 token 数会随词表变化，费用和上下文占用不能只按字符估算。'
    });
  });
  bindRange(shell.controls, `${lesson.id}-lr`, '', (value) => {
    learningRate = value;
    markManipulated(root, lesson);
    update();
  });
  shell.controls.querySelector('[data-train-step]').addEventListener('click', () => {
    step = Math.min(step + 1, 40);
    markManipulated(root, lesson, step % 4 === 0 ? 'success' : 'step');
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
  const update = (analogy = false, explanation) => {
    updateOptions();
    const points = embeddingPoints[mode];
    const first = points.find((point) => point.id === firstId) || points[0];
    const second = points.find((point) => point.id === secondId) || points[1];
    const cosine = cosineFromPoints(first, second);
    shell.stage.innerHTML = `
      <div class="embedding-plane" aria-label="高维向量的二维教学投影">
        <span class="axis-label">高维表示的二维教学投影</span>
        ${mode === 'contextual' ? `
          <div class="context-pull context-pull--company"><span>“发布新手机”</span><i></i></div>
          <div class="context-pull context-pull--fruit"><span>“切开后很甜”</span><i></i></div>
          <div class="context-origin"><span>苹果 · 初始表示</span></div>
        ` : ''}
        ${points.map((point) => `
          <button type="button" data-point="${point.id}" data-selected="${point.id === firstId || point.id === secondId}" style="--x:${point.x}%;--y:${point.y}%">
            <i></i><span>${point.label}</span>
          </button>
        `).join('')}
        ${analogy && mode === 'static' ? `
          <div class="analogy-vector">
            <span>国王</span><b>− 男人</b><b>+ 女人</b><strong>≈ 皇后</strong>
          </div>
        ` : ''}
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
    setExplanation(shell, explanation || (
      mode === 'contextual'
        ? {
            action: '把表示阶段切到“上下文表示”',
            mechanism: '后续 Transformer 把周围词的信息写回“苹果”的表示。',
            evidence: '“发布新手机”把苹果拉向公司簇，“切开后很甜”把它拉向水果簇。',
            impact: '同一个 token 会因上下文得到不同含义，初始 Embedding 只是起点。',
            tone: 'step'
          }
        : {
            action: `比较“${first.label}”和“${second.label}”`,
            mechanism: '余弦相似度比较两个向量整体方向，不解释单独某一维。',
            evidence: `两个点的教学相似度为 ${cosine.toFixed(2)}，语义接近的点聚在同一区域。`,
            impact: '向量可以用于相似检索和关系计算，但不能把某一维硬命名成人类概念。'
          }
    ));
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
    markManipulated(root, lesson, 'step');
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
    markManipulated(root, lesson, 'success');
    update(true, {
      action: '执行“国王 − 男人 + 女人”',
      mechanism: '向量方向保存了可复用的关系，减去男性方向再加上女性方向。',
      evidence: '运算结果落在“皇后”附近，而不是任意语义簇。',
      impact: 'Embedding 空间不仅能表达相似，还能在部分关系上形成可计算的方向。',
      tone: 'success'
    });
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
  const update = (explanation) => {
    const state = attentionState(preset, queryIndex, causal, separated);
    const strongest = state.weights.indexOf(Math.max(...state.weights));
    const query = state.tokens[state.queryIndex];
    const strongestToken = state.tokens[strongest];
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
      <div class="attention-output">
        <span>加权后的新表示</span>
        <p><strong>${query}</strong> ≈ ${state.tokens.map((token, index) => `${Math.round(state.weights[index] * 100)}% ${token}`).join(' + ')}</p>
        <b>${query} 现在携带了更多“${strongestToken}”的信息</b>
      </div>
      <div class="direction-compare" data-separated="${separated}">
        <span>${query} → ${strongestToken}<strong>${Math.round(state.weights[strongest] * 100)}%</strong></span>
        <span>${strongestToken} → ${query}<strong>${separated ? Math.max(3, Math.round(state.weights[strongest] * 37)) : Math.round(state.weights[strongest] * 100)}%</strong></span>
      </div>
    `;
    shell.observation.textContent = causal
      ? `未来位置被设为不可见；当前 Query“${query}”能看到的位置由 Mask 决定。`
      : `“${query}”当前最关注“${strongestToken}”；权重来自 Q 与各 K 的匹配。`;
    setExplanation(shell, explanation || {
      action: `让“${query}”发起查询`,
      mechanism: `“${query}”的 Q 与每个 token 的 K 匹配，Softmax 把分数变成权重，再加权汇总 V。`,
      evidence: `“${strongestToken}”获得 ${Math.round(state.weights[strongest] * 100)}% 权重，成为当前最强信息来源。`,
      impact: `“${query}”的新表示带上“${strongestToken}”的语义，后续层不再把它当成孤立词。`,
      tone: 'step'
    });
    shell.stage.querySelectorAll('[data-token-index]').forEach((button) => {
      button.addEventListener('click', () => {
        queryIndex = Number(button.dataset.tokenIndex);
        markManipulated(root, lesson, 'step');
        update();
      });
    });
  };
  shell.controls.querySelector('[data-preset]').addEventListener('change', (event) => {
    preset = event.currentTarget.value;
    queryIndex = preset === 'pronoun' ? 3 : 4;
    markManipulated(root, lesson, 'step');
    update();
  });
  shell.controls.querySelector('[data-causal]').addEventListener('change', (event) => {
    causal = event.currentTarget.checked;
    markManipulated(root, lesson);
    update({
      action: `${causal ? '打开' : '关闭'} Causal Mask`,
      mechanism: causal ? '当前位置右侧的未来 token 被强制设为不可见，Softmax 后权重归零。' : '当前位置重新允许查看整句，适合理解而不是自回归生成。',
      evidence: causal ? '“跑掉了”显示 MASK，当前 Query 只能使用自己和左侧信息。' : '右侧 token 重新获得注意力权重。',
      impact: causal ? '生成模型无法偷看未来，才能按顺序预测下一个 token。' : '双向可见更适合理解、分类和编码任务。',
      tone: causal ? 'warning' : 'change'
    });
  });
  shell.controls.querySelector('[data-separated]').addEventListener('change', (event) => {
    separated = event.currentTarget.checked;
    markManipulated(root, lesson);
    update({
      action: `${separated ? '分开' : '合并'} Q 与 K 的投影`,
      mechanism: separated ? '查询方向与被查询方向使用不同表示，A→B 不必等于 B→A。' : '两个方向被迫使用相似分数，关系趋向对称。',
      evidence: separated ? '方向对照中的两个百分比不再相同。' : '方向对照被压成相同权重。',
      impact: separated ? '模型可以表达“工程师填写报销单”与“报销单关注审批人”这类有方向关系。' : '方向信息被削弱，能表达的关系更少。'
    });
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
  const baselineBytes = kvCacheBytes({
    layers: 80,
    kvHeads: 8,
    headDim: 128,
    bytesPerElement: 2,
    tokens: 32768
  });
  const sentence = ['小猫', '把', '杯子', '碰倒', '了'];
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
  const update = (explanation) => {
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
        <div class="head-source">${sentence.map((token) => `<span>${token}</span>`).join('')}</div>
        <div class="head-lanes">
          <div><span>施事关系</span><strong>“碰倒” → “小猫”</strong><i style="--lane:.88"></i></div>
          <div><span>受事关系</span><strong>“碰倒” → “杯子”</strong><i style="--lane:.76"></i></div>
          <div><span>时态关系</span><strong>“碰倒” → “了”</strong><i style="--lane:.63"></i></div>
        </div>
        <div class="head-merge"><span>三个观察角度</span><b aria-hidden="true">→</b><strong>“小猫碰倒了杯子”</strong></div>
      `;
      shell.observation.textContent = '多个头使用不同投影，同一句话可以同时保留语义、语法和指代关系。';
      setExplanation(shell, explanation || {
        action: '让多个注意力头同时读取同一句话',
        mechanism: '每个头使用不同投影，分别学习施事、受事和时态等关系。',
        evidence: '三个头都查看“碰倒”，却把最高权重给了不同 token。',
        impact: '模型不必把所有关系挤进一张注意力图，可以并行保留多种解释。'
      });
    } else if (mode === 'rope') {
      const angle = (position * 17) % 360;
      const score = (Math.cos(angle * Math.PI / 180) + 1) / 2;
      shell.stage.innerHTML = `
        <div class="rope-stage">
          <div class="rope-token-pair"><span>今天</span><b>${position} tokens</b><span>天气</span></div>
          <div class="rope-ring">
            <i style="--angle:0deg"><span>今天</span></i>
            <i style="--angle:${angle}deg"><span>天气</span></i>
          </div>
          <dl class="metric-strip">
            <div><dt>位置差</dt><dd>${position}</dd></div>
            <div><dt>教学旋转角</dt><dd>${angle}°</dd></div>
            <div><dt>位置匹配</dt><dd>${Math.round(score * 100)}%</dd></div>
          </dl>
        </div>
      `;
      shell.observation.textContent = 'RoPE 让 Q/K 随位置旋转，点积可以感知两个 token 的相对位置差。';
      setExplanation(shell, explanation || {
        action: `把“今天”和“天气”的位置差调到 ${position} tokens`,
        mechanism: 'RoPE 按位置旋转 Q/K；位置差改变，两条向量的夹角和点积随之改变。',
        evidence: `教学旋转角为 ${angle}°，位置匹配为 ${Math.round(score * 100)}%。`,
        impact: '模型可以从点积里感知相对距离，不需要额外保存一个绝对位置标签。'
      });
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
          <div><dt>相对基线</dt><dd>${signed(bytesToGiB(bytes - baselineBytes), 1, ' GiB')}</dd></div>
        </dl>
        <p class="quality-caution"><span>换来的代价</span>更多 Query 共享同一组 K/V，会降低缓存，但共享过度可能损失细粒度表达。</p>
      `;
      shell.observation.textContent = `每 ${Math.max(1, Math.round(queryHeads / safeKv))} 个 Query 头共享一组 K/V；共享越多，缓存越小。`;
      setExplanation(shell, explanation || {
        action: `让 ${queryHeads} 个 Query 头共享 ${safeKv} 组 K/V`,
        mechanism: 'Query 仍保留多个观察角度，K/V 缓存按共享组数保存。',
        evidence: `共享比例 ${Math.max(1, Math.round(queryHeads / safeKv))}:1，KV Cache 为 ${formatNumber(bytesToGiB(bytes), 1)} GiB。`,
        impact: '共享能显著降低长上下文显存，但过度共享可能牺牲细粒度表达。'
      });
    }
  };
  bindSegmented(shell.controls, (value) => {
    mode = value;
    markManipulated(root, lesson, 'step');
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
  const baselineBudget = patchBudget(512, 16, 1);
  shell.controls.innerHTML = `
    <label class="learning-field"><span>图像分辨率</span><select data-resolution><option>256</option><option selected>512</option><option>1024</option></select></label>
    <label class="learning-field"><span>Patch 尺寸</span><select data-patch><option selected>16</option><option>32</option></select></label>
    ${rangeField(`${lesson.id}-frames`, '帧数', 1, 12, 1, frames, ' 帧')}
    ${segmented([
      { value: 'early', label: '早期融合' },
      { value: 'cross', label: '交叉融合' }
    ], fusion, '融合方式')}
  `;
  const update = (explanation) => {
    const budget = patchBudget(resolution, patch, frames);
    const cells = Math.min(budget.patches, 144);
    const scale = budget.visualTokens / baselineBudget.visualTokens;
    const framePreviewCount = Math.min(frames, 6);
    shell.stage.innerHTML = `
      <div class="patch-visual">
        <div class="vision-input">
          <div class="vision-scene" role="img" aria-label="红苹果、蓝色杯子和白色纸张组成的视觉输入样本">
            <i class="vision-scene__apple"></i>
            <i class="vision-scene__leaf"></i>
            <i class="vision-scene__cup"></i>
            <i class="vision-scene__paper"></i>
          </div>
          <div class="patch-grid" style="--patch-columns:${Math.min(budget.patchesPerSide, 12)}">
            ${Array.from({ length: cells }, (_, index) => `<i data-emphasis="${index % Math.max(1, Math.round(cells / 8)) === 0}"></i>`).join('')}
          </div>
          <span>${budget.patches > cells ? `画面仅抽样显示 ${cells}/${budget.patches} 个 patch` : `${budget.patches} 个 patch`}</span>
        </div>
        <div class="vision-flow">
          <div class="frame-strip" style="--frames:${framePreviewCount}">
            ${Array.from({ length: framePreviewCount }, (_, index) => `<i style="--frame:${index}"><span></span><b></b></i>`).join('')}
            ${frames > framePreviewCount ? `<b>+${frames - framePreviewCount} 帧</b>` : ''}
          </div>
          <div class="token-pressure">
            <span>上下文占用</span>
            <i style="--pressure:${Math.min(1, Math.log10(budget.visualTokens) / 5)}"></i>
            <strong>${formatNumber(budget.visualTokens, 0)} visual tokens</strong>
          </div>
          <div class="fusion-track" data-mode="${fusion}">
            <span>图像 patch</span><b>→</b><span>${fusion === 'early' ? '挤进主 token 序列' : '留在视觉分支'}</span><b>→</b><span>${fusion === 'early' ? '统一 Self-Attention' : '文本按需查询'}</span>
          </div>
        </div>
      </div>
      <dl class="metric-strip">
        <div><dt>单边 patch</dt><dd>${budget.patchesPerSide}</dd></div>
        <div><dt>教学视觉 token</dt><dd>${formatNumber(budget.visualTokens, 0)}</dd></div>
        <div><dt>相对基线</dt><dd>${formatNumber(scale, 0)}× tokens / ${formatNumber(scale * scale, 0)}× 配对</dd></div>
      </dl>
      <p class="teaching-boundary">标准 ViT 教学模型；真实多模态模型可能继续重采样或压缩视觉 token。</p>
    `;
    shell.observation.textContent = `${resolution}×${resolution}、${patch}px patch、${frames} 帧会产生 ${formatNumber(budget.visualTokens, 0)} 个教学视觉 token。`;
    setExplanation(shell, explanation || {
      action: `用 ${resolution}×${resolution} 图像、${patch}px patch 和 ${frames} 帧`,
      mechanism: '每一帧先切成 patch，再映射为视觉 token；token 两两参与注意力配对。',
      evidence: `视觉 token 为 ${formatNumber(budget.visualTokens, 0)}，相对基线 ${formatNumber(scale, 0)}×；配对规模约 ${formatNumber(scale * scale, 0)}×。`,
      impact: '更高分辨率和更多帧会迅速吃掉上下文与计算预算，视频尤其昂贵。',
      tone: scale > 4 ? 'warning' : 'change'
    });
  };
  shell.controls.querySelector('[data-resolution]').addEventListener('change', (event) => {
    const previous = patchBudget(resolution, patch, frames);
    resolution = Number(event.currentTarget.value);
    markManipulated(root, lesson);
    const current = patchBudget(resolution, patch, frames);
    update({
      action: `把分辨率调到 ${resolution}×${resolution}`,
      mechanism: '边长增加会同时增加横向和纵向 patch 数。',
      evidence: `视觉 token ${formatNumber(previous.visualTokens, 0)} → ${formatNumber(current.visualTokens, 0)}，注意力配对 ${formatNumber(previous.attentionPairs, 0)} → ${formatNumber(current.attentionPairs, 0)}。`,
      impact: '分辨率翻倍时，patch 数约变 4 倍，注意力配对约变 16 倍。',
      tone: current.visualTokens > previous.visualTokens ? 'warning' : 'change'
    });
  });
  shell.controls.querySelector('[data-patch]').addEventListener('change', (event) => {
    patch = Number(event.currentTarget.value);
    markManipulated(root, lesson);
    update();
  });
  bindRange(shell.controls, `${lesson.id}-frames`, ' 帧', (value) => {
    const previous = patchBudget(resolution, patch, frames);
    frames = value;
    markManipulated(root, lesson);
    const current = patchBudget(resolution, patch, frames);
    update({
      action: `把视频帧数调到 ${frames}`,
      mechanism: '每一帧都产生一组视觉 token，它们会叠加进同一次上下文。',
      evidence: `视觉 token ${formatNumber(previous.visualTokens, 0)} → ${formatNumber(current.visualTokens, 0)}。`,
      impact: '视频长度与采样帧率会直接放大上下文占用，需要采样、压缩或分段。',
      tone: frames > 4 ? 'warning' : 'change'
    });
  });
  bindSegmented(shell.controls, (value) => {
    fusion = value;
    markManipulated(root, lesson, 'step');
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
  const tasks = {
    math: {
      prompt: '一个球和一个球拍共 1.10 元，球拍比球贵 1 元。球多少钱？',
      checks: ['凭直觉答 0.10 元', '列方程 x + x + 1 = 1.10', '代回总价验证'],
      answer: '0.05 元'
    },
    code: {
      prompt: 'function last(items) { return items[items.length] }',
      checks: ['怀疑异步时序', '检查数组索引边界', '增加网络重试'],
      answer: 'items.length - 1'
    },
    writing: {
      prompt: '给这段产品说明写一个更清楚的标题。',
      checks: ['追求新奇词', '检查是否准确兑现正文', '堆叠三个卖点'],
      answer: '没有唯一答案'
    },
    facts: {
      prompt: '查询账户 A-17 的当前余额。',
      checks: ['依赖参数记忆', '调用实时余额工具', '根据语气猜测'],
      answer: '使用可回查工具'
    }
  };
  shell.controls.innerHTML = `
    <label class="learning-field"><span>任务类型</span>
      <select data-task><option value="math">数学题</option><option value="code">代码验证</option><option value="writing">开放写作</option><option value="facts">事实查询</option></select>
    </label>
    ${rangeField(`${lesson.id}-paths`, '候选路径', 1, 12, 1, paths, ' 条')}
    ${rangeField(`${lesson.id}-verifier`, '评估可靠度', 0.2, 0.98, 0.02, verifier, '')}
  `;
  const update = (explanation) => {
    const state = reasoningBudget(task, paths, verifier);
    const currentTask = tasks[task];
    const selected = verifier >= 0.58 ? 1 : verifier >= 0.4 ? 2 : 0;
    shell.stage.innerHTML = `
      <div class="reasoning-problem"><span>待解决问题</span><code>${escapeHtml(currentTask.prompt)}</code></div>
      <div class="reasoning-paths">
        ${currentTask.checks.map((check, index) => {
          const available = index < Math.min(3, paths);
          const status = !available ? 'hidden' : index === selected ? 'selected' : index === 1 ? 'pass' : 'fail';
          return `
            <div data-status="${status}">
              <span>路径 ${String.fromCharCode(65 + index)}</span>
              <strong>${check}</strong>
              <p>${status === 'selected' ? `验证器选择：${currentTask.answer}` : status === 'pass' ? '测试通过，但没有被当前验证器选中' : status === 'fail' ? '验证失败或无法核对' : '预算不足，尚未探索'}</p>
            </div>
          `;
        }).join('')}
        ${paths > 3 ? `<div class="reasoning-more"><span>+${paths - 3}</span><p>其余候选被折叠，计算成本仍计入。</p></div>` : ''}
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
    setExplanation(shell, explanation || {
      action: `为“${currentTask.prompt}”探索 ${state.paths} 条候选路径`,
      mechanism: '搜索扩大候选覆盖，验证器负责用测试或证据从候选中选路。',
      evidence: `候选覆盖 ${Math.round(state.coverage * 100)}%，验证可靠度 ${Math.round(verifier * 100)}%，当前选择路径 ${String.fromCharCode(65 + selected)}。`,
      impact: verifier < 0.58 ? '路径再多也可能选错；可靠验证比单纯增加思考长度更重要。' : '可验证任务更值得增加推理预算，开放任务的收益不稳定。',
      tone: verifier < 0.58 ? 'warning' : 'change'
    });
  };
  shell.controls.querySelector('[data-task]').addEventListener('change', (event) => {
    task = event.currentTarget.value;
    markManipulated(root, lesson, 'step');
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
  const baselineFit = deviceFit({ deviceGiB: 16, modelKey: '7', bitWidth: 4, context: 32768 });
  shell.controls.innerHTML = `
    <label class="learning-field"><span>可用内存</span><select data-device><option>8</option><option selected>16</option><option>24</option><option>32</option><option>64</option></select></label>
    <label class="learning-field"><span>模型</span><select data-model><option value="1.5">1.5B 教学模型</option><option value="7" selected>7B 教学模型</option><option value="13">13B 教学模型</option><option value="70">Llama 3.1 70B</option></select></label>
    <label class="learning-field"><span>权重精度</span><select data-precision><option value="4" selected>INT4</option><option value="8">INT8</option><option value="16">FP16</option></select></label>
    ${rangeField(`${lesson.id}-context`, '上下文', 4096, 131072, 4096, context, ' tokens')}
  `;
  const update = (explanation) => {
    const fit = deviceFit({ deviceGiB, modelKey, bitWidth, context });
    const statusText = fit.status === 'fit' ? '可运行' : fit.status === 'tight' ? '很勉强' : '放不下';
    const overflowGiB = Math.max(0, fit.totalGiB - deviceGiB);
    shell.stage.innerHTML = `
      <div class="memory-gauge" data-status="${fit.status}">
        <header><span>${fit.model.label}</span><strong>${statusText}</strong></header>
        <div class="memory-capacity">
          <div class="memory-stack" style="--used:${Math.min(fit.ratio, 1) * 100}%">
            <i style="--part:${fit.weightsGiB / fit.totalGiB * 100}%" data-part="weights">权重</i>
            <i style="--part:${fit.kvGiB / fit.totalGiB * 100}%" data-part="kv">KV</i>
            <i style="--part:${fit.runtimeGiB / fit.totalGiB * 100}%" data-part="runtime">运行时</i>
          </div>
          <span class="memory-limit">设备上限 ${deviceGiB} GiB</span>
          ${overflowGiB > 0 ? `<div class="memory-overflow"><i></i><strong>溢出 ${formatNumber(overflowGiB, 1)} GiB</strong></div>` : ''}
        </div>
        <span>${formatNumber(fit.totalGiB, 1)} / ${deviceGiB} GiB</span>
      </div>
      <dl class="metric-strip">
        <div><dt>权重</dt><dd>${formatNumber(fit.weightsGiB, 1)} GiB <small>${signed(fit.weightsGiB - baselineFit.weightsGiB, 1)}</small></dd></div>
        <div><dt>KV Cache</dt><dd>${formatNumber(fit.kvGiB, 1)} GiB <small>${signed(fit.kvGiB - baselineFit.kvGiB, 1)}</small></dd></div>
        <div><dt>运行时预留</dt><dd>${formatNumber(fit.runtimeGiB, 1)} GiB <small>${signed(fit.runtimeGiB - baselineFit.runtimeGiB, 1)}</small></dd></div>
      </dl>
      <p class="teaching-boundary">权重按理想位宽估算；真实量化格式、引擎与设备还会产生额外开销。</p>
    `;
    shell.observation.textContent = fit.status === 'overflow'
      ? `权重之外还需 ${formatNumber(fit.kvGiB + fit.runtimeGiB, 1)} GiB；文件能下载不等于设备能稳定推理。`
      : `当前配置共需约 ${formatNumber(fit.totalGiB, 1)} GiB，仍要给系统和推理引擎留出余量。`;
    setExplanation(shell, explanation || {
      action: `把 ${fit.model.label} 以 ${bitWidth === 4 ? 'INT4' : bitWidth === 8 ? 'INT8' : 'FP16'} 放进 ${deviceGiB} GiB 设备，上下文 ${formatNumber(context, 0)}`,
      mechanism: '设备要同时容纳模型权重、随上下文增长的 KV Cache 和推理运行时。',
      evidence: `总需求 ${formatNumber(fit.totalGiB, 1)} GiB，${overflowGiB > 0 ? `超过上限 ${formatNumber(overflowGiB, 1)} GiB` : `还剩 ${formatNumber(deviceGiB - fit.totalGiB, 1)} GiB`}；相对基线权重 ${signed(fit.weightsGiB - baselineFit.weightsGiB, 1, ' GiB')}，KV ${signed(fit.kvGiB - baselineFit.kvGiB, 1, ' GiB')}。`,
      impact: fit.status === 'overflow' ? '文件即使下载成功，运行时也会因内存不足失败或频繁换页。' : fit.status === 'tight' ? '理论上能装下，但留给系统的余量过小，稳定性风险高。' : '当前配置留有余量，可以进入真实性能和温升验证。',
      tone: fit.status === 'overflow' ? 'warning' : fit.status === 'tight' ? 'step' : 'success'
    });
  };
  shell.controls.querySelector('[data-device]').addEventListener('change', (event) => {
    deviceGiB = Number(event.currentTarget.value);
    markManipulated(root, lesson, 'step');
    update();
  });
  shell.controls.querySelector('[data-model]').addEventListener('change', (event) => {
    modelKey = event.currentTarget.value;
    markManipulated(root, lesson, modelKey === '70' ? 'warning' : 'step');
    update();
  });
  shell.controls.querySelector('[data-precision]').addEventListener('change', (event) => {
    bitWidth = Number(event.currentTarget.value);
    markManipulated(root, lesson, bitWidth === 16 ? 'warning' : 'change');
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
  const storyTokens = ['项目', '代号', 'Orion', '负责人', '林', '周五', '上线', '后续', '大量', '会议', '记录', '需求', '日志', '……'];
  shell.controls.innerHTML = `
    ${rangeField(`${lesson.id}-length`, '序列长度', 1024, 131072, 1024, length, ' tokens')}
    ${rangeField(`${lesson.id}-retention`, '状态保留强度', 0.2, 0.98, 0.02, retention, '')}
    ${rangeField(`${lesson.id}-hybrid`, 'Attention 比例', 0, 0.5, 0.05, hybrid, '')}
  `;
  const update = (explanation) => {
    const state = mambaMemory(length, retention, hybrid);
    const retained = Math.max(2, Math.round(state.recall * storyTokens.length));
    const remembered = retained >= 3;
    shell.stage.innerHTML = `
      <div class="memory-question">
        <span>开头写入</span><strong>“项目代号 Orion”</strong>
        <b aria-hidden="true">→</b>
        <span>长文末尾追问</span><strong>“项目代号是什么？”</strong>
      </div>
      <div class="memory-rails">
        <div>
          <header><span>Transformer</span><strong>${formatNumber(state.transformerUnits, 0)} 历史单位</strong></header>
          <div class="rail-tokens">${storyTokens.map((token, index) => `<i data-old="${index < 3}"><span>${token}</span></i>`).join('')}</div>
          <p>历史 token 保留在缓存中，可以直接回看“Orion”。</p>
        </div>
        <div>
          <header><span>Mamba</span><strong>${state.mambaUnits} 固定状态单位</strong></header>
          <div class="state-stream">
            ${storyTokens.map((token, index) => `<span style="--memory:${index < retained ? Math.max(.18, state.recall) : .08};--delay:${index}">${token}</span>`).join('')}
            <b aria-hidden="true">→</b>
            <div class="state-capsule"><i style="--retention:${state.recall}"></i><span>hₜ</span></div>
          </div>
          <p>新 token 不断压进固定状态，早期细节会逐渐变淡。</p>
        </div>
      </div>
      <div class="memory-recall" data-remembered="${remembered}">
        <span>回答</span><strong>${remembered ? '项目代号是 Orion' : '无法可靠找回项目代号'}</strong><i>${Math.round(state.recall * 100)}% 教学回忆</i>
      </div>
      <dl class="metric-strip">
        <div><dt>Transformer 缓存</dt><dd>O(N)</dd></div>
        <div><dt>Mamba 推理状态</dt><dd>O(1)</dd></div>
        <div><dt>教学精确回忆</dt><dd>${Math.round(state.recall * 100)}%</dd></div>
      </dl>
    `;
    shell.observation.textContent = `整段处理仍随 N 线性增长；固定的是自回归推理状态大小，不是总计算量。`;
    setExplanation(shell, explanation || {
      action: `把序列拉到 ${formatNumber(length, 0)} tokens，状态保留 ${Math.round(retention * 100)}%，Attention 比例 ${Math.round(hybrid * 100)}%`,
      mechanism: 'Transformer 保留历史 token；Mamba 把流入信息持续压进固定大小状态，少量 Attention 可补回精确检索。',
      evidence: `Mamba 状态仍为 ${state.mambaUnits} 单位，教学回忆为 ${Math.round(state.recall * 100)}%，${remembered ? '还能找回 Orion' : '早期代号已变得不可靠'}。`,
      impact: '固定推理状态节省长序列内存，但精确回忆可能下降；混合架构用少量 Attention 弥补。',
      tone: remembered ? 'change' : 'warning'
    });
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
    bert: { encoder: true, decoder: false, mask: false, cross: false, task: '理解 / 分类', tokens: ['苹果', '发布', '了', '新', '手机', '。'] },
    gpt: { encoder: false, decoder: true, mask: true, cross: false, task: '自回归生成', tokens: ['苹果', '发布', '了', '新', '手机', '。'] },
    t5: { encoder: true, decoder: true, mask: true, cross: true, task: '翻译 / 转换', tokens: ['I', 'love', 'Tiananmen', 'Square', 'today', '.'] }
  };
  shell.controls.innerHTML = `
    ${segmented([
      { value: 'bert', label: 'BERT' },
      { value: 'gpt', label: 'GPT' },
      { value: 't5', label: 'T5' }
    ], preset, '架构预设')}
    ${rangeField(`${lesson.id}-token`, '观察 token', 0, 5, 1, tokenIndex, '')}
  `;
  const update = (explanation) => {
    const current = presets[preset];
    const visible = Array.from({ length: 6 }, (_, index) => !current.mask || index <= tokenIndex);
    shell.stage.innerHTML = `
      <div class="architecture-example">
        <span>${preset === 't5' ? '源文本' : '同一句输入'}</span>
        <strong>${preset === 't5' ? '“我爱北京天安门” → “I love Tiananmen Square”' : '“苹果发布了新手机。”'}</strong>
      </div>
      <div class="transformer-builder">
        <div data-enabled="${current.encoder}"><span>Encoder</span><strong>双向读取</strong></div>
        <b>→</b>
        <div data-enabled="${current.cross}"><span>Cross-Attention</span><strong>查询源文本</strong></div>
        <b>→</b>
        <div data-enabled="${current.decoder}"><span>Decoder</span><strong>${current.mask ? '只看过去' : '双向读取'}</strong></div>
      </div>
      <div class="visibility-row" aria-label="当前 token 的可见范围">
        ${visible.map((isVisible, index) => `<i data-visible="${isVisible}" data-current="${index === tokenIndex}">${current.tokens[index]}</i>`).join('')}
      </div>
      ${preset === 't5' ? `
        <div class="cross-attention-trace">
          <span>Decoder 当前生成 <strong>${current.tokens[tokenIndex]}</strong></span>
          <b aria-hidden="true">↙</b>
          <p>回看源文本中的“${tokenIndex < 2 ? '我爱' : '北京天安门'}”</p>
        </div>
      ` : ''}
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
    setExplanation(shell, explanation || {
      action: `切换到 ${preset.toUpperCase()}，观察“${current.tokens[tokenIndex]}”`,
      mechanism: preset === 'bert' ? 'Encoder 让每个 token 双向读取整句。' : preset === 'gpt' ? 'Decoder 用 Causal Mask，只允许当前位置查看自己和过去。' : 'Encoder 先读完整源文本，Decoder 再通过 Cross-Attention 查询源表示。',
      evidence: `${current.tokens[tokenIndex]} 当前能看到 ${visible.filter(Boolean).length}/6 个目标 token；${preset === 't5' ? '同时可以回看源文本' : preset === 'bert' ? '左右文全部可见' : '右侧未来保持遮挡'}。`,
      impact: preset === 'bert' ? '双向上下文适合理解和分类。' : preset === 'gpt' ? '不能偷看未来，才能逐 token 生成。' : '源文本与目标文本分开处理，适合翻译和结构转换。',
      tone: 'step'
    });
  };
  bindSegmented(shell.controls, (value) => {
    preset = value;
    markManipulated(root, lesson, 'step');
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
  let actionStep = 0;
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
  const update = (explanation) => {
    for (const id of ['temperature', 'topk', 'topp']) {
      shell.controls.querySelector(`#${lesson.id}-${id}`).closest('label').hidden = mode !== 'sampling';
    }
    const action = shell.controls.querySelector('[data-action]');
    action.hidden = mode === 'sampling';
    action.textContent = mode === 'stream'
      ? '接收下一个 token'
      : mode === 'function'
        ? '推进调用链'
        : mode === 'evidence'
          ? '切换事实来源'
          : '执行下一层约束';
    if (mode === 'sampling') {
      const result = sampleTokens({ temperature, topK, topP, seed: 20260826 });
      shell.stage.innerHTML = `
        <div class="sampling-candidates">
          ${result.candidates.map((item) => `<div><span>${item.token}</span><i style="--prob:${item.probability}"></i><strong>${Math.round(item.probability * 100)}%</strong></div>`).join('')}
        </div>
        <div class="sample-output"><span>固定 seed 的 8 次采样</span><strong>${result.samples.join(' · ')}</strong></div>
      `;
      shell.observation.textContent = 'Temperature 改变分布陡峭度，Top-k 和 Top-p 缩小候选集；三者不改变模型参数。';
      setExplanation(shell, explanation || {
        action: `Temperature ${temperature}，Top-k ${topK}，Top-p ${topP}`,
        mechanism: 'Temperature 改变概率分布陡峭度，Top-k 与 Top-p 再裁掉候选。',
        evidence: `当前保留 ${result.candidates.length} 个候选，最高候选概率 ${Math.round((result.candidates[0]?.probability || 0) * 100)}%。`,
        impact: '这些参数改变输出随机性，不会修改模型权重，也不能保证事实正确。'
      });
    } else if (mode === 'function') {
      const steps = [
        ['用户请求', '查询账户 A-17 的当前余额'],
        ['模型生成调用意图', '{"name":"getBalance","account":"A-17"}'],
        ['客户端鉴权并执行', '权限通过 · balance = 328.40'],
        ['结果回填模型', '当前余额为 328.40 元']
      ];
      shell.stage.innerHTML = `
        <div class="function-flow">
          ${steps.map((step, index) => `
            ${index ? '<b aria-hidden="true">→</b>' : ''}
            <div data-active="${index === actionStep}" data-visible="${index <= actionStep}">
              <span>${index + 1}</span><strong>${step[0]}</strong><code>${escapeHtml(step[1])}</code>
            </div>
          `).join('')}
        </div>
      `;
      shell.observation.textContent = '模型只生成结构化调用意图；真正执行函数、鉴权和回填结果的是客户端。';
      setExplanation(shell, explanation || {
        action: `推进到“${steps[actionStep][0]}”`,
        mechanism: actionStep === 0 ? '客户端先把用户需求交给模型。' : actionStep === 1 ? '模型只生成结构化调用意图，不接触真实账户。' : actionStep === 2 ? '客户端检查权限后执行真实函数。' : '工具结果作为新上下文回填，模型再组织自然语言。',
        evidence: steps[actionStep][1],
        impact: actionStep < 2 ? '模型输出只是建议，尚未发生真实操作。' : actionStep === 2 ? '真实副作用必须留在受权限控制的客户端或服务端。' : '最终答案有可回查的数据来源。',
        tone: actionStep === steps.length - 1 ? 'success' : 'step'
      });
    } else if (mode === 'evidence') {
      const sources = [
        ['参数记忆', '账户余额约 300 元', '过期且不可核对', false],
        ['提供上下文', '昨日报表：315.20 元', '有来源，但可能不是最新', true],
        ['调用工具', '实时余额：328.40 元', '实时且可回查', true]
      ];
      const selected = actionStep % sources.length;
      shell.stage.innerHTML = `
        <div class="evidence-question"><span>同一个问题</span><strong>“账户 A-17 现在还有多少钱？”</strong></div>
        <div class="evidence-modes">
          ${sources.map((source, index) => `
            <div data-reliable="${source[3]}" data-active="${index === selected}">
              <span>${source[0]}</span><strong>${source[1]}</strong><p>${source[2]}</p>
            </div>
          `).join('')}
        </div>
      `;
      shell.observation.textContent = '幻觉的核心是缺少可核对证据；实时余额这类事实应通过工具取得。';
      setExplanation(shell, explanation || {
        action: `用“${sources[selected][0]}”回答同一个余额问题`,
        mechanism: sources[selected][2],
        evidence: `当前回答为“${sources[selected][1]}”。`,
        impact: selected === 2 ? '实时工具给出可回查事实，适合余额、天气和库存。' : selected === 1 ? '上下文能提供证据，但时效受材料限制。' : '参数记忆可能流畅却过期，不能承担实时事实。',
        tone: selected === 2 ? 'success' : 'warning'
      });
    } else if (mode === 'system') {
      const layers = [
        ['System Prompt', '“只允许查询余额”', '模型仍生成了 transfer 指令', false],
        ['Schema / Validator', '拒绝未知 action', '结构被拦截，没有执行', true],
        ['Auth / ACL', '检查账户与用户权限', '越权账户在模型外被拒绝', true]
      ];
      const selected = actionStep % layers.length;
      shell.stage.innerHTML = `
        <div class="constraint-request"><span>风险输入</span><code>{"action":"transfer","amount":10000}</code></div>
        <div class="constraint-layers">
          ${layers.map((layer, index) => `
            <div data-reliable="${layer[3]}" data-active="${index === selected}">
              <span>${layer[0]}</span><strong>${layer[1]}</strong><p>${layer[2]}</p>
            </div>
          `).join('')}
        </div>
      `;
      shell.observation.textContent = 'Prompt 能影响行为倾向，真正的格式和权限保证必须由程序执行。';
      setExplanation(shell, explanation || {
        action: `让请求经过“${layers[selected][0]}”`,
        mechanism: layers[selected][1],
        evidence: layers[selected][2],
        impact: selected === 0 ? 'Prompt 只能降低违规概率，不能作为安全边界。' : '程序化校验在模型之外拒绝不合法或越权操作。',
        tone: selected === 0 ? 'warning' : 'success'
      });
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
      setExplanation(shell, explanation || {
        action: streamStep ? `接收第 ${streamStep} 个流式 token` : '等待首个流式 token',
        mechanism: '服务端仍逐 token 生成，客户端收到一段就立刻追加到界面。',
        evidence: `当前已显示 ${streamStep}/8 个教学 token。`,
        impact: 'Streaming 缩短感知等待并允许提前取消，但不会减少已经完成的生成计算。',
        tone: streamStep === tokens.length ? 'success' : 'step'
      });
      shell.stage.querySelector('[data-cancel]').addEventListener('click', () => {
        streamStep = 0;
        markManipulated(root, lesson, 'warning');
        update();
      });
    }
  };
  bindSegmented(shell.controls, (value) => {
    mode = value;
    streamStep = 0;
    actionStep = 0;
    markManipulated(root, lesson, 'step');
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
    else if (mode === 'function') actionStep = Math.min(actionStep + 1, 3);
    else actionStep = (actionStep + 1) % 3;
    markManipulated(root, lesson, mode === 'stream' && streamStep === 8 || mode === 'function' && actionStep === 3 ? 'success' : 'step');
    update();
  });
  shell.reset.addEventListener('click', () => {
    mode = 'sampling';
    temperature = 0.8;
    topK = 5;
    topP = 0.9;
    streamStep = 0;
    actionStep = 0;
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
  })).concat([
    { title: 'KV Cache', text: '缓存历史 token 的 K/V，减少 Decode 重算；占用随层数、KV 头数和上下文增长。', href: lessonHref('attention') },
    { title: 'Prefill', text: '一次处理已有输入，建立上下文表示和 KV Cache，主要影响首字延迟。', href: lessonHref('journey') },
    { title: 'Decode', text: '复用缓存逐个生成新 token，主要影响吐字速度和完整回答耗时。', href: lessonHref('journey') },
    { title: 'RoPE', text: '通过旋转 Q/K 写入相对位置信息。', href: lessonHref('attention-systems') },
    { title: 'GQA', text: '多个 Query 头共享较少 K/V 头，降低 KV Cache。', href: lessonHref('attention-systems') },
    { title: '量化', text: '降低权重位宽以减少模型体积和内存占用，同时可能带来质量损失。', href: lessonHref('on-device') },
    { title: 'Streaming', text: '边生成边返回，缩短感知等待并支持提前取消。', href: lessonHref('client-api') }
  ]);
  shell.controls.innerHTML = `
    <label class="learning-field learning-text-field"><span>搜索术语</span><input type="search" data-search placeholder="例如：KV Cache" /></label>
    ${rangeField(`${lesson.id}-params`, '参数量', 1, 70, 1, params, 'B')}
    <label class="learning-field"><span>权重精度</span><select data-precision><option value="4" selected>4 bit</option><option value="8">8 bit</option><option value="16">16 bit</option></select></label>
    ${rangeField(`${lesson.id}-context`, '上下文', 4096, 131072, 4096, context, ' tokens')}
  `;
  const update = (explanation) => {
    const weightGiB = bytesToGiB(weightBytes(params, bitWidth));
    const kvGiB = bytesToGiB(kvCacheBytes({
      layers: 32,
      kvHeads: 8,
      headDim: 128,
      bytesPerElement: 2,
      tokens: context
    }));
    const normalizedQuery = query.trim().toLowerCase();
    const matches = terms.filter((term) => !normalizedQuery || `${term.title}${term.text}`.toLowerCase().includes(normalizedQuery)).slice(0, 5);
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
    setExplanation(shell, explanation || {
      action: query ? `搜索“${query}”并按当前假设重新计算` : '查看默认 7B / 4 bit / 32K 上下文口径',
      mechanism: '术语索引定位课程章节；计算器把参数量、位宽和上下文带回同一结果。',
      evidence: `${matches.length} 条术语结果；理想权重 ${formatNumber(weightGiB, 1)} GiB，教学 KV Cache ${formatNumber(kvGiB, 1)} GiB。`,
      impact: '任何显存数字都必须和模型结构、精度、上下文一起使用，不能脱离口径引用。'
    });
  };
  shell.controls.querySelector('[data-search]').addEventListener('input', (event) => {
    query = event.currentTarget.value;
    markManipulated(root, lesson);
    update({
      action: `搜索“${query || '全部术语'}”`,
      mechanism: '搜索同时匹配术语名、定义和对应课程标题。',
      evidence: `当前命中 ${terms.filter((term) => !query.trim() || `${term.title}${term.text}`.toLowerCase().includes(query.trim().toLowerCase())).length} 条。`,
      impact: '速查页负责把术语送回原章节，不替代上下文学习。'
    });
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
