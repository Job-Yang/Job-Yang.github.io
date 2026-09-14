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
  const merged = step.variables.merged || [];
  const min = spec.visual.min || 0;
  const max = spec.visual.max || Math.max(...intervals.flat());
  const span = Math.max(1, max - min);
  const intervalBar = (interval, classes = '') => `
    <span
      class="algo-interval${classes ? ` ${classes}` : ''}"
      style="left:${((interval[0] - min) / span) * 100}%;width:${Math.max(5, ((interval[1] - interval[0]) / span) * 100)}%"
    >${interval[0]}–${interval[1]}</span>
  `;
  return `
    <div class="algo-intervals" data-structure-scene="interval">
      <span class="algo-scene-label">INPUT · 当前比较</span>
      ${intervals.map((interval, index) => `
        <div class="algo-interval-row">
          ${intervalBar(interval, tokenClass(index, step).trim())}
        </div>
      `).join('')}
      <div class="algo-number-line">
        ${Array.from({ length: 10 }, (_, index) => `<i style="left:${(index / 9) * 100}%"></i>`).join('')}
      </div>
      <span class="algo-scene-label">MERGED · 真正输出</span>
      <div class="algo-interval-result">
        ${merged.map((interval, index) => intervalBar(
          interval,
          index === merged.length - 1 ? 'is-arriving' : '',
        )).join('')}
      </div>
    </div>
  `;
}

function linkedPointers(index, step) {
  return Object.entries(step.view?.pointers || {})
    .filter(([, pointerIndex]) => pointerIndex === index)
    .map(([name]) => `<b class="algo-link-pointer">${escapeHtml(name)}</b>`)
    .join('');
}

function linkedNode(value, {
  classes = '',
  id = '',
  pointers = '',
  note = '',
} = {}) {
  return `
    <span class="algo-link-node${classes ? ` ${classes}` : ''}"${id ? ` data-node-id="${escapeHtml(id)}"` : ''}>
      ${pointers ? `<span class="algo-link-pointers">${pointers}</span>` : ''}
      <strong>${escapeHtml(value)}</strong>
      ${note ? `<small>${escapeHtml(note)}</small>` : ''}
    </span>
  `;
}

function linkedArrow(classes = '', label = 'next') {
  return `
    <span class="algo-link-edge${classes ? ` ${classes}` : ''}" data-edge="${escapeHtml(label)}">
      <i></i><b>›</b>
    </span>
  `;
}

function renderLinkedChain(values, {
  row = 'A',
  consumed = 0,
  current = -1,
  moved = -1,
  detached = -1,
  pointerStep,
  arriving = -1,
} = {}) {
  if (!values.length) {
    return '<span class="algo-link-empty">∅</span>';
  }
  return values.map((value, index) => {
    const classes = [
      index < consumed ? 'is-consumed' : '',
      index === current ? 'is-candidate' : '',
      index === moved ? 'is-moving-source' : '',
      index === detached ? 'is-detached' : '',
      index === arriving ? 'is-arriving' : '',
    ].filter(Boolean).join(' ');
    return `
      ${linkedNode(value, {
        classes,
        id: `${row}-${index}`,
        pointers: pointerStep ? linkedPointers(index, pointerStep) : '',
      })}
      ${index < values.length - 1
        ? linkedArrow(index === detached - 1 ? 'is-rewired' : '', `${row}-${index}-${index + 1}`)
        : ''}
    `;
  }).join('');
}

function renderReverseList(spec, step) {
  const values = spec.visual.rows?.[0] || [];
  const reversed = step.variables.reversed || [];
  const headIndex = Number(step.view?.pointers?.head ?? -1);
  const currentIndex = Number(step.view?.active?.[0] ?? -1);
  const remaining = headIndex >= 0 ? values.slice(headIndex) : [];
  const current = values[currentIndex];
  const next = step.variables.nxt;
  const nextTarget = reversed[1] ?? 'null';
  return `
    <div class="algo-linked-scene algo-linked-reverse" data-linked-scene="reverse">
      <section>
        <span class="algo-scene-label">尚未处理 · head</span>
        <div class="algo-link-chain">
          ${renderLinkedChain(remaining, { row: 'source' })}
        </div>
      </section>
      <div class="algo-link-action" data-link-action="rewire">
        <span>先保存 <b>nxt = ${escapeHtml(next)}</b></span>
        ${linkedNode(current, { classes: 'is-transfer-node', note: '当前节点' })}
        <span class="algo-rewire-rule"><s>next → ${escapeHtml(next)}</s><b>next → ${escapeHtml(nextTarget)}</b></span>
      </div>
      <section>
        <span class="algo-scene-label">已反转 · prev</span>
        <div class="algo-link-chain is-result">
          ${renderLinkedChain(reversed, {
            row: 'result',
            arriving: 0,
          })}
        </div>
      </section>
    </div>
  `;
}

function renderCycleList(spec, step) {
  const values = spec.visual.rows?.[0] || [];
  const markerId = `algo-cycle-arrow-${spec.number}`;
  const positions = [
    [12, 49],
    [42, 18],
    [78, 39],
    [59, 77],
  ];
  const pointers = step.view?.pointers || {};
  return `
    <div class="algo-linked-scene algo-linked-cycle" data-linked-scene="cycle">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z"></path>
          </marker>
        </defs>
        <path d="M17 46 C24 37 31 28 37 23" marker-end="url(#${markerId})"></path>
        <path d="M48 20 C60 21 68 28 74 35" marker-end="url(#${markerId})"></path>
        <path d="M78 46 C75 59 69 68 63 73" marker-end="url(#${markerId})"></path>
        <path class="is-cycle-edge" d="M54 76 C35 84 27 61 37 28" marker-end="url(#${markerId})"></path>
      </svg>
      <span class="algo-cycle-entry">入环点</span>
      ${values.map((value, index) => {
        const names = Object.entries(pointers)
          .filter(([, pointerIndex]) => pointerIndex === index)
          .map(([name]) => `<b class="algo-link-pointer">${escapeHtml(name)}</b>`)
          .join('');
        const selected = includesToken(step.view?.selected, index);
        return `
          <span
            class="algo-cycle-node${selected ? ' is-selected' : ''}${names ? ' has-pointer' : ''}"
            style="--cycle-x:${positions[index]?.[0] ?? 50}%;--cycle-y:${positions[index]?.[1] ?? 50}%"
            data-node-id="cycle-${index}"
          >
            ${names ? `<span class="algo-link-pointers">${names}</span>` : ''}
            <strong>${escapeHtml(value)}</strong>
          </span>
        `;
      }).join('')}
      <div class="algo-cycle-caption">
        <span>3 先进入链表</span>
        <b>-4.next 重新指向 2，形成闭环</b>
      </div>
    </div>
  `;
}

function renderMergeLists(spec, step, stepIndex) {
  const rows = spec.visual.rows || [];
  const previous = spec.steps[stepIndex - 1]?.variables || { i: 0, j: 0, out: [] };
  const i = Number(step.variables.i ?? previous.i ?? 0);
  const j = Number(step.variables.j ?? previous.j ?? 0);
  let source = i > Number(previous.i || 0) ? 0 : j > Number(previous.j || 0) ? 1 : -1;
  let sourceIndex = source === 0 ? i - 1 : source === 1 ? j - 1 : -1;
  if (source < 0 && Array.isArray(step.variables.rest) && step.variables.rest.length) {
    source = i < (rows[0]?.length || 0) ? 0 : 1;
    sourceIndex = source === 0 ? i : j;
  }
  const movedValue = source >= 0 ? rows[source]?.[sourceIndex] : step.variables.tail;
  const out = step.variables.out || [];

  return `
    <div class="algo-linked-scene algo-linked-merge" data-linked-scene="merge-two">
      <div class="algo-link-sources">
        ${rows.map((row, rowIndex) => {
          const consumed = rowIndex === 0 ? i : j;
          return `
            <section>
              <span class="algo-row-name">${rowIndex === 0 ? 'A' : 'B'}</span>
              <div class="algo-link-chain">
                ${renderLinkedChain(row, {
                  row: rowIndex === 0 ? 'A' : 'B',
                  consumed,
                  current: consumed,
                  moved: rowIndex === source ? sourceIndex : -1,
                })}
              </div>
            </section>
          `;
        }).join('')}
      </div>
      <div class="algo-link-transfer" data-link-action="append">
        <span>${source >= 0 ? `从 ${source === 0 ? 'A' : 'B'} 摘下` : '接入剩余链'}</span>
        ${linkedNode(movedValue ?? '—', { classes: 'is-transfer-node' })}
        <i></i>
        <b>接到 tail.next</b>
      </div>
      <section class="algo-link-result">
        <span class="algo-scene-label">RESULT · 新链持续增长</span>
        <div class="algo-link-chain is-result">
          ${renderLinkedChain(out, {
            row: 'out',
            arriving: Math.max(0, out.length - 1),
          })}
          <b class="algo-tail-label">tail</b>
        </div>
      </section>
    </div>
  `;
}

function renderRemoveNode(spec, step) {
  const values = spec.visual.rows?.[0] || [];
  const removedIndex = step.variables.removed === undefined
    ? -1
    : values.findIndex((value) => value === step.variables.removed);
  const pointers = step.view?.pointers || {};
  const result = removedIndex >= 0
    ? values.filter((_, index) => index !== removedIndex)
    : [];
  return `
    <div class="algo-linked-scene algo-linked-remove" data-linked-scene="remove">
      <section>
        <span class="algo-scene-label">固定间距 ${escapeHtml(step.variables.gap ?? 2)} · fast 先探路</span>
        <div class="algo-link-chain">
          ${linkedNode('D', {
            classes: 'is-dummy',
            pointers: Object.entries(pointers)
              .filter(([, index]) => index === -1)
              .map(([name]) => `<b class="algo-link-pointer">${escapeHtml(name)}</b>`)
              .join(''),
          })}
          ${linkedArrow('', 'dummy-head')}
          ${values.map((value, index) => `
            ${linkedNode(value, {
              id: `source-${index}`,
              classes: index === removedIndex ? 'is-detached' : '',
              pointers: linkedPointers(index, step),
              note: index === removedIndex ? '待删除' : '',
            })}
            ${index < values.length - 1
              ? linkedArrow(removedIndex === index + 1 ? 'is-rewired' : '', `source-${index}-${index + 1}`)
              : ''}
          `).join('')}
        </div>
      </section>
      ${removedIndex >= 0 ? `
        <div class="algo-remove-action">
          ${linkedNode(values[removedIndex], { classes: 'is-transfer-node is-removed', note: '断开' })}
          <span>${escapeHtml(values[removedIndex - 1])}.next 跨过它，改指向 ${escapeHtml(values[removedIndex + 1])}</span>
        </div>
        <section class="algo-link-result">
          <span class="algo-scene-label">RESULT · 重新接好的链</span>
          <div class="algo-link-chain is-result">
            ${renderLinkedChain(result, { row: 'result', arriving: Math.max(0, removedIndex) })}
          </div>
        </section>
      ` : ''}
    </div>
  `;
}

function renderIntersectionList(spec, step) {
  const positions = {
    A1: [8, 24], A2: [27, 24],
    B1: [5, 76], B2: [20, 76], B3: [35, 76],
    C1: [61, 50], C2: [83, 50],
  };
  const paths = [
    ['A1', 'A2'], ['A2', 'C1'],
    ['B1', 'B2'], ['B2', 'B3'], ['B3', 'C1'],
    ['C1', 'C2'],
  ];
  const markerId = `algo-intersection-arrow-${spec.number}`;
  const pointerByValue = {
    [step.variables.p]: 'p',
    [step.variables.q]: step.variables.p === step.variables.q ? 'p · q' : 'q',
  };
  return `
    <div class="algo-linked-scene algo-linked-intersection" data-linked-scene="intersection">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z"></path>
          </marker>
        </defs>
        ${paths.map(([from, to]) => {
          const [x1, y1] = positions[from];
          const [x2, y2] = positions[to];
          return `<path d="M${x1 + 5} ${y1} L${x2 - 5} ${y2}" marker-end="url(#${markerId})"></path>`;
        }).join('')}
      </svg>
      <span class="algo-branch-label is-a">A</span>
      <span class="algo-branch-label is-b">B</span>
      <span class="algo-shared-label">共享同一批节点，不是值相同</span>
      ${Object.entries(positions).map(([value, [x, y]]) => {
        const pointer = pointerByValue[value];
        return `
          <span
            class="algo-intersection-node${value.startsWith('C') ? ' is-shared' : ''}${pointer ? ' is-active' : ''}"
            style="--node-x:${x}%;--node-y:${y}%"
            data-node-id="${value}"
          >
            ${pointer ? `<span class="algo-link-pointers"><b class="algo-link-pointer">${pointer}</b></span>` : ''}
            <strong>${value}</strong>
          </span>
        `;
      }).join('')}
    </div>
  `;
}

function renderAddTwoNumbers(spec, step) {
  const rows = spec.visual.rows || [];
  const position = Number(step.variables.position || 0);
  const out = spec.steps
    .slice(0, position + 1)
    .map((item) => item.variables.digit)
    .filter((value) => value !== undefined);
  return `
    <div class="algo-linked-scene algo-linked-add" data-linked-scene="add-two">
      <div class="algo-digit-grid">
        <span class="algo-row-name">A</span>
        ${rows[0].map((value, index) => linkedNode(value, {
          classes: index === position ? 'is-candidate' : '',
          id: `A-${index}`,
        })).join('')}
        <span class="algo-row-name">B</span>
        ${rows[1].map((value, index) => linkedNode(value, {
          classes: index === position ? 'is-candidate' : '',
          id: `B-${index}`,
        })).join('')}
      </div>
      <div class="algo-column-equation">
        <span>第 ${position + 1} 位</span>
        <strong>${escapeHtml(step.variables.a)} + ${escapeHtml(step.variables.b)} + 进位 ${escapeHtml(step.variables.carryIn)}</strong>
        <b>= 写 ${escapeHtml(step.variables.digit)}，向后进 ${escapeHtml(step.variables.carryOut)}</b>
      </div>
      <section class="algo-link-result">
        <span class="algo-scene-label">RESULT · 低位在前</span>
        <div class="algo-link-chain is-result">
          ${renderLinkedChain(out, { row: 'sum', arriving: out.length - 1 })}
        </div>
      </section>
    </div>
  `;
}

function renderLinked(spec, step, stepIndex) {
  switch (spec.runner.entry) {
    case 'reverseList': return renderReverseList(spec, step);
    case 'detectCycle': return renderCycleList(spec, step);
    case 'mergeTwoLists': return renderMergeLists(spec, step, stepIndex);
    case 'removeNthFromEnd': return renderRemoveNode(spec, step);
    case 'getIntersectionNode': return renderIntersectionList(spec, step);
    case 'addTwoNumbers': return renderAddTwoNumbers(spec, step);
    default: {
      const rows = spec.visual.rows || [];
      return `
        <div class="algo-linked" data-linked-scene="generic">
          ${rows.map((row, rowIndex) => `
            <div class="algo-list-row">
              <span class="algo-row-name">${String.fromCharCode(65 + rowIndex)}</span>
              ${renderLinkedChain(row, {
                row: String.fromCharCode(65 + rowIndex),
                pointerStep: step,
              })}
            </div>
          `).join('')}
        </div>
      `;
    }
  }
}

function normalizeSecondary(step) {
  const secondary = step.view?.secondary || [];
  if (Array.isArray(secondary)) return secondary;
  return Object.entries(secondary).map(([key, value]) => `${key}: ${formatValue(value)}`);
}

function renderStack(spec, step) {
  const input = spec.visual.input || spec.visual.values || [];
  const entry = spec.runner.entry;

  if (entry === 'LRUCache') {
    const entries = normalizeSecondary(step);
    return `
      <div class="algo-lru" data-structure-scene="lru">
        <div class="algo-operation-strip">
          ${input.map((value, index) => `<span class="algo-chip${tokenClass(index, step)}">${escapeHtml(value)}</span>`).join('')}
        </div>
        <div class="algo-lru-cache">
          <span class="algo-scene-label">LRU · 下一次优先淘汰</span>
          <div class="algo-lru-track">
            ${entries.map((value, index) => `
              ${linkedNode(value, { classes: index === entries.length - 1 ? 'is-arriving' : '' })}
              ${index < entries.length - 1 ? linkedArrow('', `lru-${index}`) : ''}
            `).join('')}
          </div>
          <span class="algo-scene-label">MRU · 刚刚使用</span>
        </div>
        ${step.variables.evicted !== '-' && step.variables.evicted !== undefined
          ? `<div class="algo-evicted">淘汰 ${escapeHtml(step.variables.evicted)}</div>`
          : ''}
      </div>
    `;
  }

  if (entry === 'MinStack') {
    const stack = step.variables.stack || [];
    const mins = step.variables.mins || [];
    return `
      <div class="algo-min-stack" data-structure-scene="min-stack">
        <div>
          <span class="algo-scene-label">VALUE STACK</span>
          <div class="algo-stack-column">
            ${stack.map((value, index) => `<span class="${index === stack.length - 1 ? 'is-active' : ''}">${escapeHtml(value)}</span>`).reverse().join('')}
          </div>
        </div>
        <div class="algo-stack-sync">同步<br>压入 / 弹出</div>
        <div>
          <span class="algo-scene-label">MIN AT THIS LEVEL</span>
          <div class="algo-stack-column is-min">
            ${mins.map((value, index) => `<span class="${index === mins.length - 1 ? 'is-selected' : ''}">${escapeHtml(value)}</span>`).reverse().join('')}
          </div>
        </div>
      </div>
    `;
  }

  if (entry === 'dailyTemperatures') {
    const stack = step.variables.stack || [];
    const answer = step.variables.answer || [];
    return `
      <div class="algo-temperature-scene" data-structure-scene="monotonic-stack">
        <div class="algo-temperature-days">
          ${input.map((value, index) => `
            <span class="${tokenClass(index, step).trim()}">
              <b>${escapeHtml(value)}°</b>
              <small>day ${index}</small>
              ${answer[index] ? `<em>等 ${answer[index]} 天</em>` : ''}
            </span>
          `).join('')}
        </div>
        <div class="algo-monotonic-stack">
          <span class="algo-scene-label">单调栈 · 仍在等更暖一天</span>
          <div>
            ${stack.map((index) => linkedNode(`${index}:${input[index]}°`)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  if (entry === 'topKFrequent') {
    const counts = step.variables.counts || {};
    const ranked = normalizeSecondary(step)
      .map((item) => String(item).match(/(-?\d+):\s*(\d+)/))
      .filter(Boolean)
      .map((match) => [match[1], Number(match[2])]);
    const entries = Object.keys(counts).length
      ? Object.entries(counts)
      : ranked;
    const max = Math.max(1, ...entries.map(([, value]) => Number(value)));
    return `
      <div class="algo-frequency-scene" data-structure-scene="frequency">
        ${entries.map(([value, count]) => `
          <div class="${String(step.variables.value) === String(value) ? 'is-selected' : ''}">
            <span>${escapeHtml(value)}</span>
            <i style="height:${Math.max(18, Number(count) / max * 130)}px"></i>
            <b>${escapeHtml(count)} 次</b>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (entry === 'decodeString') {
    const nums = step.variables.numStack || [];
    const strings = step.variables.strStack || [];
    return `
      <div class="algo-decode-scene" data-structure-scene="decode">
        <div class="algo-operation-strip">
          ${input.map((value, index) => `<span class="algo-chip${tokenClass(index, step)}">${escapeHtml(value)}</span>`).join('')}
        </div>
        <div class="algo-decode-frames">
          ${nums.map((count, index) => `
            <span style="--frame:${index}">
              <b>${escapeHtml(count)} ×</b>
              <em>${escapeHtml(strings[index] || '空前缀')}</em>
            </span>
          `).join('')}
          <strong>${escapeHtml(step.variables.cur || '空串')}</strong>
        </div>
      </div>
    `;
  }

  const stack = Array.isArray(step.variables.stack)
    ? step.variables.stack
    : normalizeSecondary(step);
  return `
    <div class="algo-split-scene" data-structure-scene="stack">
      <div>
        <span class="algo-scene-label">INPUT / OPERATIONS</span>
        <div class="algo-chips">
          ${input.map((value, index) => `<span class="algo-chip${tokenClass(index, step)}">${escapeHtml(value)}</span>`).join('')}
        </div>
      </div>
      <div>
        <span class="algo-scene-label">CURRENT STRUCTURE</span>
        <div class="algo-stack">
          ${stack.length
            ? stack.map((value) => `<span>${escapeHtml(value)}</span>`).join('')
            : '<span>empty</span>'}
        </div>
      </div>
    </div>
  `;
}

function renderTree(spec, step, stepIndex) {
  const baseValues = spec.visual.tree || spec.visual.values || [];
  const values = [...baseValues];
  const positions = [
    [50, 14],
    [28, 44],
    [72, 44],
    [14, 75],
    [38, 75],
    [62, 75],
    [86, 75],
  ];

  if (spec.runner.entry === 'invertTree') {
    const swapSubtrees = (left, right) => {
      if (left >= values.length && right >= values.length) return;
      [values[left], values[right]] = [values[right], values[left]];
      swapSubtrees(left * 2 + 1, right * 2 + 1);
      swapSubtrees(left * 2 + 2, right * 2 + 2);
    };
    for (const item of spec.steps.slice(0, stepIndex + 1)) {
      const parent = values.findIndex((value) => value === item.variables.node);
      if (parent < 0) continue;
      swapSubtrees(parent * 2 + 1, parent * 2 + 2);
    }
  }

  const visibleValues = spec.runner.entry === 'buildTree'
    ? new Set(spec.steps.slice(0, stepIndex + 1).map((item) => item.variables.root))
    : null;

  const indexesFor = (tokens = []) => {
    if (!Array.isArray(tokens)) return [];
    return values.flatMap((value, index) => (
      value !== null
      && value !== undefined
      && tokens.some((token) => JSON.stringify(token) === JSON.stringify(value))
        ? [index]
        : []
    ));
  };
  const nodeIndex = (value) => values.findIndex((item) => (
    item !== null
    && item !== undefined
    && JSON.stringify(item) === JSON.stringify(value)
  ));
  const symmetricPairs = [[1, 2], [3, 6], [4, 5], [4, 5], [3, 6]];
  const activeValues = step.variables.level
    || step.view?.active
    || [step.variables.node ?? step.variables.root ?? step.variables.visible];
  const activeIndexes = spec.runner.entry === 'isSymmetric'
    ? symmetricPairs[stepIndex] || []
    : indexesFor(Array.isArray(activeValues) ? activeValues : [activeValues]);
  const activeIndex = activeIndexes[0] ?? -1;
  const activePathEdges = new Set();
  activeIndexes.forEach((startIndex) => {
    for (let index = startIndex; index > 0;) {
      const parent = Math.floor((index - 1) / 2);
      activePathEdges.add(`${parent}-${index}`);
      index = parent;
    }
  });

  const completedValues = spec.steps.slice(0, stepIndex + 1).flatMap((item) => {
    if (spec.runner.entry === 'inorderTraversal') return item.variables.res || [];
    if (spec.runner.entry === 'levelOrder') return (item.variables.res || []).flat();
    if (spec.runner.entry === 'rightSideView') return item.variables.res || [];
    return [item.variables.node ?? item.variables.root].filter((value) => value !== undefined);
  });
  const completedIndexes = new Set(indexesFor(completedValues));
  const selectedIndexes = new Set(indexesFor(step.view?.selected));
  if (spec.runner.entry === 'isSymmetric') {
    activeIndexes.forEach((index) => selectedIndexes.add(index));
  }
  if (spec.runner.entry === 'inorderTraversal') {
    indexesFor(step.variables.res).forEach((index) => selectedIndexes.add(index));
  }
  if (spec.runner.entry === 'rightSideView') {
    indexesFor(step.variables.res).forEach((index) => selectedIndexes.add(index));
  }

  const invalidIndexes = new Set(indexesFor(step.view?.discarded));
  const returnValues = new Map();
  spec.steps.slice(0, stepIndex + 1).forEach((item) => {
    const node = item.variables.node;
    const value = item.variables.return
      ?? item.variables.returnDepth
      ?? item.variables.returnGain;
    if (node !== undefined && value !== undefined) returnValues.set(node, value);
  });
  const semanticPathEdges = new Set();
  const addPathToRoot = (index) => {
    for (let child = index; child > 0;) {
      const parent = Math.floor((child - 1) / 2);
      semanticPathEdges.add(`${parent}-${child}`);
      child = parent;
    }
  };
  const addBestBranch = (startIndex) => {
    let parent = startIndex;
    while (parent >= 0) {
      const candidates = [parent * 2 + 1, parent * 2 + 2]
        .filter((index) => index < values.length && values[index] !== null && values[index] !== undefined);
      if (!candidates.length) return;
      const child = candidates.sort((left, right) => (
        Number(returnValues.get(values[right]) ?? 0) - Number(returnValues.get(values[left]) ?? 0)
      ))[0];
      semanticPathEdges.add(`${parent}-${child}`);
      parent = child;
    }
  };
  if (spec.runner.entry === 'lowestCommonAncestor') {
    spec.steps.slice(0, 2).forEach((item) => addPathToRoot(nodeIndex(item.variables.node)));
  }
  if (['diameterOfBinaryTree', 'maxPathSum'].includes(spec.runner.entry) && activeIndex >= 0) {
    const left = activeIndex * 2 + 1;
    const right = activeIndex * 2 + 2;
    if (left < values.length && values[left] !== null && values[left] !== undefined) {
      semanticPathEdges.add(`${activeIndex}-${left}`);
      addBestBranch(left);
    }
    if (right < values.length && values[right] !== null && values[right] !== undefined) {
      semanticPathEdges.add(`${activeIndex}-${right}`);
      addBestBranch(right);
    }
  }
  const markerId = `algo-tree-arrow-${spec.number}`;
  const edges = values.flatMap((value, index) => {
    if (value === null || value === undefined) return [];
    return [index * 2 + 1, index * 2 + 2]
      .filter((child) => child < values.length && values[child] !== null && values[child] !== undefined)
      .filter((child) => !visibleValues || (visibleValues.has(value) && visibleValues.has(values[child])))
      .map((child) => [index, child]);
  });
  const returnValue = step.variables.return
    ?? step.variables.returnDepth
    ?? step.variables.returnGain;
  const hasReturnFlow = activeIndex > 0 && returnValue !== undefined;
  const modeText = {
    inorderTraversal: `遍历结果 ${formatValue(step.variables.res || [])}`,
    levelOrder: `第 ${Number(step.variables.depth ?? 0) + 1} 层 ${formatValue(step.variables.level || [])}`,
    maxDepth: '叶子返回 1 · 空节点返回 0',
    invertTree: `交换节点 ${formatValue(step.variables.node)} 的 L / R`,
    isSymmetric: `镜像配对 ${formatValue(step.variables.leftNode)} ↔ ${formatValue(step.variables.rightNode)}`,
    lowestCommonAncestor: `左返回 ${formatValue(step.variables.leftReport)} · 右返回 ${formatValue(step.variables.rightReport)}`,
    diameterOfBinaryTree: `穿过当前节点 ${formatValue(step.variables.through)} 条边`,
    maxPathSum: `穿过当前节点 ${formatValue(step.variables.through)} · best ${formatValue(step.variables.best)}`,
    buildTree: `前序取根 ${formatValue(step.variables.root)} · 中序切左右`,
    isValidBST: `合法区间 (${formatValue(step.variables.low)}, ${formatValue(step.variables.high)})`,
    rightSideView: `右侧可见 ${formatValue(step.variables.visible)}`,
  }[spec.runner.entry] || 'ROOT / LEFT / RIGHT';
  const showNullChildren = activeIndex >= 0
    && (values[activeIndex * 2 + 1] === null || values[activeIndex * 2 + 1] === undefined)
    && (values[activeIndex * 2 + 2] === null || values[activeIndex * 2 + 2] === undefined)
    && ['maxDepth', 'diameterOfBinaryTree', 'maxPathSum'].includes(spec.runner.entry);
  const targetValues = spec.runner.entry === 'lowestCommonAncestor'
    ? spec.steps.slice(0, 2).map((item) => item.variables.node)
    : [];

  return `
    <div class="algo-tree algo-tree--${escapeHtml(spec.runner.entry)}" data-structure-scene="tree" data-tree-mode="${escapeHtml(spec.runner.entry)}">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z"></path>
          </marker>
        </defs>
        ${edges.map(([parent, child]) => {
          const [x1, y1] = positions[parent];
          const [x2, y2] = positions[child];
          const classes = ['algo-tree-edge'];
          const edgeKey = `${parent}-${child}`;
          if (activePathEdges.has(edgeKey)) classes.push('is-active-edge');
          if (semanticPathEdges.has(edgeKey)) classes.push('is-semantic-edge');
          if (selectedIndexes.has(parent) && selectedIndexes.has(child)) classes.push('is-selected-edge');
          if (invalidIndexes.has(child)) classes.push('is-invalid-edge');
          if (
            spec.runner.entry === 'invertTree'
            && activeIndexes.includes(parent)
            && selectedIndexes.has(child)
          ) classes.push('is-swap-edge');
          if (hasReturnFlow && child === activeIndex) classes.push('is-return-edge');
          return `
            <path class="${classes.join(' ')}" d="M${x1} ${y1} L${x2} ${y2}"></path>
            ${parent === 0
              ? `<text class="algo-tree-branch-label" x="${(x1 + x2) / 2 + (child === 1 ? -2 : 2)}" y="${(y1 + y2) / 2 - 2}">${child === 1 ? 'L' : 'R'}</text>`
              : ''}
            ${hasReturnFlow && child === activeIndex
              ? `<path class="algo-tree-return-flow" d="M${x2} ${y2} L${x1} ${y1}" marker-end="url(#${markerId})"></path>`
              : ''}
          `;
        }).join('')}
      </svg>
      ${spec.runner.entry === 'isSymmetric' ? '<i class="algo-tree-mirror-axis"><span>镜像轴</span></i>' : ''}
      ${spec.runner.entry === 'rightSideView' ? '<i class="algo-tree-sightline"><span>RIGHT VIEW →</span></i>' : ''}
      <div class="algo-tree-mode">${escapeHtml(modeText)}</div>
      ${values.slice(0, 7).map((value, index) => {
        if (value === null || value === undefined) return '';
        if (visibleValues && !visibleValues.has(value)) return '';
        const classes = ['algo-tree-node'];
        if (index === 0) classes.push('is-root');
        if (activeIndexes.includes(index)) classes.push('is-active');
        if (selectedIndexes.has(index)) classes.push('is-selected');
        if (completedIndexes.has(index) && !activeIndexes.includes(index)) classes.push('is-complete');
        if (invalidIndexes.has(index)) classes.push('is-invalid');
        if (targetValues.some((target) => JSON.stringify(target) === JSON.stringify(value))) {
          classes.push('is-target');
        }
        if (
          spec.runner.entry === 'rightSideView'
          && (step.variables.res || []).some((item) => JSON.stringify(item) === JSON.stringify(value))
        ) classes.push('is-visible');
        const nodeReturn = returnValues.get(value);
        return `
          <span
            class="${classes.join(' ')}"
            style="--tree-x:${positions[index]?.[0] ?? 50}%;--tree-y:${positions[index]?.[1] ?? 50}%"
            data-tree-index="${index}"
          >
            <b>${escapeHtml(value)}</b>
            ${index === 0 ? '<em>ROOT</em>' : ''}
            ${nodeReturn !== undefined
              ? `<small>${activeIndexes.includes(index) ? '↑ ' : ''}${escapeHtml(nodeReturn)}</small>`
              : ''}
          </span>
        `;
      }).join('')}
      ${showNullChildren ? [-1, 1].map((direction) => `
        <span
          class="algo-tree-null"
          style="--tree-x:${positions[activeIndex][0] + direction * 6}%;--tree-y:${Math.min(94, positions[activeIndex][1] + 18)}%"
        >
          <b>∅</b><small>0</small>
        </span>
      `).join('') : ''}
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
    <div class="algo-decision" data-structure-scene="backtrack">
      <span class="algo-scene-label">CURRENT PATH</span>
      <div class="algo-path">
        ${path.length
          ? path.map((value, index) => `
              <span class="${index === path.length - 1 && step.variables.choose !== undefined ? 'is-arriving' : ''}">
                ${escapeHtml(value)}
              </span>
              ${index < path.length - 1 ? '<i>→</i>' : ''}
            `).join('')
          : '<span class="is-empty">空路径</span>'}
      </div>
      <p class="${step.variables.undo !== undefined ? 'is-undo' : ''}">
        ${step.variables.undo !== undefined
          ? `↩ 撤销 ${escapeHtml(step.variables.undo)}，回到上一层`
          : `↓ 选择 ${escapeHtml(step.variables.choose ?? '结果')}，进入第 ${escapeHtml((step.variables.depth ?? path.length) + 1)} 层 ↓`}
      </p>
      <div class="algo-choices">
        ${choices.length
          ? choices.map((value) => `<span>${escapeHtml(value)}</span>`).join('')
          : '<span>完成</span>'}
      </div>
    </div>
  `;
}

function renderGraph(spec, step) {
  const nodes = spec.visual.nodes || [];
  const edges = spec.visual.edges || [];
  const positions = nodes.map((_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / Math.max(nodes.length, 2));
    return [50 + Math.cos(angle) * 30, 50 + Math.sin(angle) * 27];
  });
  const markerId = `algo-graph-arrow-${spec.number}`;
  return `
    <div class="algo-graph" data-structure-scene="graph">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z"></path>
          </marker>
        </defs>
        ${edges.map(([from, to]) => {
          const fromIndex = nodes.indexOf(from);
          const toIndex = nodes.indexOf(to);
          if (fromIndex < 0 || toIndex < 0) return '';
          const [x1, y1] = positions[fromIndex];
          const [x2, y2] = positions[toIndex];
          return `<path d="M${x1} ${y1} L${x2} ${y2}" marker-end="url(#${markerId})"></path>`;
        }).join('')}
      </svg>
      ${nodes.map((value, index) => `
        <span
          class="algo-graph-node${includesToken(step.view?.active, value) ? ' is-active' : ''}${includesToken(step.view?.selected, value) ? ' is-selected' : ''}"
          style="--graph-x:${positions[index][0]}%;--graph-y:${positions[index][1]}%"
        >
          ${escapeHtml(value)}
          <small>入度 ${escapeHtml(step.variables.indegree?.[index] ?? 0)}</small>
        </span>
      `).join('')}
      <div class="algo-graph-queue">
        <span class="algo-scene-label">可学习队列</span>
        ${(step.variables.queue || []).map((value) => `<b>${escapeHtml(value)}</b>`).join('') || '<b>empty</b>'}
      </div>
    </div>
  `;
}

function renderHeap(spec, step) {
  const heap = Array.isArray(step.variables.heap)
    ? step.variables.heap
    : normalizeSecondary(step);
  const positions = [
    [50, 22],
    [32, 57],
    [68, 57],
    [22, 84],
    [42, 84],
    [58, 84],
    [78, 84],
  ];
  return `
    <div class="algo-heap-scene" data-structure-scene="heap">
      <div>
        <span class="algo-scene-label">INPUT STREAM</span>
        <div class="algo-chips">
          ${(spec.visual.values || []).map((value, index) => `<span class="algo-chip${tokenClass(index, step)}">${escapeHtml(value)}</span>`).join('')}
        </div>
      </div>
      <div class="algo-heap-tree">
        <span class="algo-scene-label">MIN HEAP · 根节点是第 K 大门槛</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${heap.flatMap((_, index) => [index * 2 + 1, index * 2 + 2]
            .filter((child) => child < heap.length)
            .map((child) => {
              const [x1, y1] = positions[index];
              const [x2, y2] = positions[child];
              return `<path d="M${x1} ${y1} L${x2} ${y2}"></path>`;
            })).join('')}
        </svg>
        <div>
          ${heap.map((value, index) => `
            <span
              class="algo-heap-node${index === 0 ? ' is-active' : ''}"
              style="--heap-x:${positions[index]?.[0] ?? 50}%;--heap-y:${positions[index]?.[1] ?? 50}%"
            >${escapeHtml(value)}</span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderMergeKLists(spec, step, stepIndex) {
  const rows = spec.visual.rows || [];
  const consumed = rows.map(() => new Set());
  spec.steps.slice(0, stepIndex + 1).forEach((item) => {
    const rowIndex = Number(item.variables.fromList);
    const nodeIndex = Number(item.variables.index);
    if (consumed[rowIndex]) consumed[rowIndex].add(nodeIndex);
  });
  const sourceRow = Number(step.variables.fromList);
  const sourceIndex = Number(step.variables.index);
  const heap = step.variables.heap || [];
  const out = step.variables.out || [];

  return `
    <div class="algo-linked-scene algo-linked-merge-k" data-linked-scene="merge-k">
      <div class="algo-k-sources">
        ${rows.map((row, rowIndex) => `
          <section>
            <span class="algo-row-name">L${rowIndex + 1}</span>
            <div class="algo-link-chain">
              ${row.map((value, nodeIndex) => `
                ${linkedNode(value, {
                  id: `L${rowIndex}-${nodeIndex}`,
                  classes: [
                    consumed[rowIndex].has(nodeIndex) ? 'is-consumed' : '',
                    rowIndex === sourceRow && nodeIndex === sourceIndex ? 'is-moving-source' : '',
                  ].filter(Boolean).join(' '),
                })}
                ${nodeIndex < row.length - 1 ? linkedArrow('', `L${rowIndex}-${nodeIndex}-${nodeIndex + 1}`) : ''}
              `).join('')}
            </div>
          </section>
        `).join('')}
      </div>
      <div class="algo-k-transfer">
        <div>
          <span class="algo-scene-label">MIN HEAP · 下一批候选</span>
          <div class="algo-mini-heap">
            ${heap.length
              ? heap.map((value, index) => linkedNode(value, {
                  classes: index === 0 ? 'is-candidate' : '',
                })).join('')
              : '<span class="algo-link-empty">heap empty</span>'}
          </div>
        </div>
        <div class="algo-link-transfer" data-link-action="heap-pop">
          <span>从 L${sourceRow + 1} 弹出</span>
          ${linkedNode(step.variables.value, { classes: 'is-transfer-node' })}
          <i></i>
          <b>接到结果链</b>
        </div>
      </div>
      <section class="algo-link-result">
        <span class="algo-scene-label">RESULT · 新链持续增长</span>
        <div class="algo-link-chain is-result">
          ${renderLinkedChain(out, { row: 'out', arriving: out.length - 1 })}
          <b class="algo-tail-label">tail</b>
        </div>
      </section>
    </div>
  `;
}

function renderVisual(spec, step, stepIndex) {
  if (spec.runner.entry === 'mergeKLists') {
    return renderMergeKLists(spec, step, stepIndex);
  }
  switch (spec.family) {
    case 'bars': return renderBars(spec, step);
    case 'string': return renderString(spec, step);
    case 'interval': return renderIntervals(spec, step);
    case 'linked': return renderLinked(spec, step, stepIndex);
    case 'stack': return renderStack(spec, step);
    case 'tree': return renderTree(spec, step, stepIndex);
    case 'grid': return renderGrid(spec, step);
    case 'dp': return renderDp(step);
    case 'decision': return renderDecision(spec, step);
    case 'graph': return renderGraph(spec, step);
    case 'heap': return renderHeap(spec, step);
    default: return renderSequence(spec, step);
  }
}

function visualLabel(spec) {
  const entryLabels = {
    reverseList: 'POINTER REWIRE / RESULT',
    detectCycle: 'REAL CYCLE / POINTER CHASE',
    mergeTwoLists: 'SOURCE / TRANSFER / RESULT',
    removeNthFromEnd: 'GAP / DETACH / RECONNECT',
    getIntersectionNode: 'SHARED NODE TOPOLOGY',
    addTwoNumbers: 'DIGITS / CARRY / RESULT',
    mergeKLists: 'SOURCE LISTS / HEAP / RESULT',
    inorderTraversal: 'BINARY TREE / LEFT · ROOT · RIGHT',
    levelOrder: 'BINARY TREE / LEVELS · QUEUE',
    maxDepth: 'BINARY TREE / RETURNS · DEPTH',
    invertTree: 'BINARY TREE / SWAP LEFT · RIGHT',
    isSymmetric: 'BINARY TREE / MIRROR PAIRS',
    lowestCommonAncestor: 'BINARY TREE / REPORTS · LCA',
    diameterOfBinaryTree: 'BINARY TREE / DEPTHS · DIAMETER',
    maxPathSum: 'BINARY TREE / GAINS · BEST PATH',
    buildTree: 'BINARY TREE / PREORDER · INORDER',
    isValidBST: 'BINARY TREE / VALID RANGE',
    rightSideView: 'BINARY TREE / LEVELS · RIGHT VIEW',
  };
  if (entryLabels[spec.runner.entry]) return entryLabels[spec.runner.entry];
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
  }[spec.family] || 'STATE';
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
    elements.visualLabel.textContent = visualLabel(spec);
    elements.visual.innerHTML = renderVisual(spec, step, current);
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
