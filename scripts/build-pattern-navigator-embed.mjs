import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outputFlag = process.argv.indexOf('--output');
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : '';
if (!outputPath) {
  console.error('Usage: node scripts/build-pattern-navigator-embed.mjs --output <html-file>');
  process.exit(2);
}

const guide = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/learning/algorithm-pattern-guide.json'), 'utf8')
);
const algorithms = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/learning/algorithms.json'), 'utf8')
);

function safeJson(value) {
  return JSON.stringify(value).replaceAll('</', '<\\/');
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>拿到一道新题，先怎么想</title>
<style>
:root{color-scheme:dark;--bg:#030303;--ink:#eef0f6;--dim:#aaa7a2;--faint:#66635f;--line:rgba(255,255,255,.16);--gold:#f5b971;--gold2:#ffc57d;--blue:#72a7ff;--green:#65d6a6;--red:#ff7d72;--panel:#0b0c0f;--control:#171a20;--mono:"SF Mono","JetBrains Mono",monospace}
*{box-sizing:border-box;letter-spacing:0}html,body{width:100%;height:800px;margin:0;overflow:hidden;background:var(--bg);color:var(--ink);font-family:-apple-system,"PingFang SC",sans-serif}button{font:inherit}.app{height:800px;overflow:hidden;background:#030303}.head{display:flex;height:96px;padding:17px 20px;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line)}.head span,.kicker{color:var(--gold);font:10px var(--mono)}.head h1{margin:6px 0 0;font-family:"Songti SC","STSong",serif;font-size:28px}.head p{max-width:58%;margin:0;color:var(--dim);font-size:13px;line-height:1.65;text-align:right}.tabs{display:flex;height:46px;border-bottom:1px solid var(--line);background:#08090b}.tabs button{padding:0 18px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dim);cursor:pointer;font-size:13px}.tabs button[aria-pressed=true]{border-color:var(--gold);color:var(--gold)}.view{height:658px;overflow:auto;padding:17px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}.order{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--line);background:rgba(255,255,255,.02)}.order article{display:grid;padding:12px;grid-template-columns:26px 1fr;gap:8px;border-right:1px solid var(--line)}.order article:last-child{border:0}.order b{color:var(--gold);font:10px var(--mono)}.order strong{font-size:13px}.order p{margin:5px 0 0;color:var(--faint);font-size:11px;line-height:1.5}.diagnosis{margin-top:15px;border:1px solid var(--line);border-radius:6px;background:var(--panel)}.diagnosis header{display:flex;min-height:76px;padding:13px 15px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.diagnosis h2{margin:5px 0 0;font-size:18px}.diagnosis header p{margin:5px 0 0;color:var(--dim);font-size:12px;line-height:1.5}.diagnosis header button{height:32px;padding:0 10px;border:1px solid var(--line);border-radius:4px;background:var(--control);color:var(--dim);cursor:pointer;font-size:11px}.context{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--line);background:rgba(0,0,0,.22)}.context article{padding:11px 13px;border-right:1px solid var(--line)}.context article:last-child{border:0}.context span{color:var(--gold);font:9px var(--mono)}.context article:nth-child(2) span{color:var(--blue)}.context article:nth-child(3) span{color:var(--green)}.context article:nth-child(4) span{color:var(--red)}.context p{margin:6px 0 0;color:#d2cec7;font-size:11px;line-height:1.5}.crumbs{display:flex;padding:8px 14px;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--line)}.crumbs:empty{display:none}.crumbs button{padding:4px 7px;border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:11px}.options{display:grid;padding:14px;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.options button{min-height:92px;padding:11px;border:1px solid var(--line);border-radius:4px;background:var(--control);color:var(--ink);cursor:pointer;text-align:left}.options button:hover{border-color:var(--gold)}.options strong{display:block;font-size:13px;line-height:1.4}.options small{display:block;margin-top:7px;color:var(--dim);font-size:11px;line-height:1.45}.options span{display:block;margin-top:9px;color:var(--faint);font:9px var(--mono)}.results{display:grid;padding:14px;gap:9px}.result{padding:13px;border:1px solid rgba(114,167,255,.35);border-radius:5px;background:rgba(114,167,255,.055)}.result header{display:flex;min-height:auto;padding:0;justify-content:flex-start;gap:9px;border:0}.result header span{color:var(--blue);font:9px var(--mono)}.result header strong{font-size:17px}.result dl{display:grid;margin:10px 0 0;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.result dl>div{padding:9px;border:1px solid var(--line);background:rgba(0,0,0,.2)}.result dt{color:var(--gold);font:9px var(--mono)}.result dd{margin:5px 0 0;color:var(--dim);font-size:11px;line-height:1.55}.problem-tags{display:flex;margin-top:9px;flex-wrap:wrap;gap:5px}.problem-tags span{padding:4px 7px;background:rgba(101,214,166,.08);color:var(--green);font:9px var(--mono)}.result-actions{display:flex;justify-content:flex-end;gap:6px}.result-actions button{height:31px;padding:0 9px;border:1px solid var(--line);border-radius:4px;background:var(--control);color:var(--dim);cursor:pointer;font-size:11px}.atlas-head{display:flex;align-items:end;justify-content:space-between;gap:12px}.atlas-head h2,.special h2{margin:5px 0 0;font-size:19px}.atlas-head input{width:230px;height:36px;padding:0 11px;border:1px solid var(--line);border-radius:4px;background:var(--control);color:var(--ink);font-size:12px}.atlas{display:grid;margin-top:13px;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pattern{min-height:168px;padding:12px;border:1px solid var(--line);border-radius:4px;background:var(--control)}.pattern header{display:flex;gap:8px}.pattern header span{color:var(--gold);font:9px var(--mono)}.pattern strong{font-size:13px}.pattern p{margin:9px 0 0;color:var(--dim);font-size:11px;line-height:1.55}.pattern small{display:block;margin-top:9px;color:#cac6c0;font-size:11px;line-height:1.5}.pattern div{margin-top:9px;color:var(--green);font:9px var(--mono)}.special{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.special article{padding:14px;border:1px solid var(--line);background:var(--control)}.special strong{font-size:13px}.special p{margin:8px 0 0;color:var(--dim);font-size:11px;line-height:1.55}.sources{margin-top:13px;padding-top:11px;border-top:1px solid var(--line);color:var(--faint);font:10px var(--mono)}.sources a{margin-left:9px;color:var(--dim)}[hidden]{display:none!important}
.head span,.kicker,.order b,.context span,.options span,.result header span,.result dt,.problem-tags span,.pattern header span,.pattern div,.sources{font-size:11px}
@media(max-width:760px){.order,.atlas,.context{grid-template-columns:repeat(2,minmax(0,1fr))}.options{grid-template-columns:repeat(2,minmax(0,1fr))}.head p{display:none}.result dl{grid-template-columns:1fr}.special{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="app" data-iloop-pattern-navigator="v2">
  <header class="head"><div><span>ALGORITHM THINKING LAB · ${algorithms.problems.length} 题反推</span><h1>${guide.title}</h1></div><p>${guide.thesis}</p></header>
  <nav class="tabs"><button data-tab="diagnose" aria-pressed="true">跟着思路判断</button><button data-tab="atlas" aria-pressed="false">常用思路库</button><button data-tab="special" aria-pressed="false">特殊题与边界</button></nav>
  <section class="view" data-view="diagnose">
    <div class="order">${guide.diagnosticOrder.map((item,index)=>`<article><b>${String(index+1).padStart(2,'0')}</b><div><strong>${item.label}</strong><p>${item.question}</p></div></article>`).join('')}</div>
    <section class="diagnosis"><header><div><span class="kicker" data-step></span><h2 data-question></h2><p data-description></p></div><button data-reset>重置 ↺</button></header><section class="context" data-context hidden><article><span>你刚才选择了</span><p data-context-choice></p></article><article><span>这说明什么</span><p data-context-meaning></p></article><article><span>为什么接着问</span><p data-context-why></p></article><article><span>暂时排除</span><p data-context-eliminates></p></article></section><nav class="crumbs" data-crumbs></nav><div class="options" data-options></div><div class="results" data-results hidden></div></section>
  </section>
  <section class="view" data-view="atlas" hidden><header class="atlas-head"><div><span class="kicker">PATTERN LIBRARY</span><h2>${guide.patterns.length} 种常用思路，不是 ${algorithms.problems.length} 份答案</h2></div><input data-search placeholder="搜索题目信号 / 思路 / 反例"></header><div class="atlas" data-atlas></div></section>
  <section class="view" data-view="special" hidden><div class="special">${guide.specialCases.map(item=>`<article><strong>${item.name}</strong><p>${item.signal}</p></article>`).join('')}</div><footer class="sources">方法参考 ${guide.references.map(item=>`<a href="${item.url}" target="_blank">${item.name}</a>`).join('')}</footer></section>
</div>
<script>
const guide=${safeJson(guide)};
const problems=${safeJson(algorithms.problems.map(({number,title})=>({number,title})))};
const patternMap=new Map(guide.patterns.map(x=>[x.id,x]));const problemMap=new Map(problems.map(x=>[x.number,x]));let nodeId='start',history=[];
const q=s=>document.querySelector(s);const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function crumbs(){q('[data-crumbs]').innerHTML=history.map((x,i)=>'<button data-history="'+i+'"><b>'+(i+1)+'</b> '+esc(x.label)+'</button>').join('');q('[data-crumbs]').querySelectorAll('button').forEach(b=>b.onclick=()=>{const i=+b.dataset.history,t=history[i];history=history.slice(0,i);nodeId=t.nodeId;render()})}
function context(why=''){const last=history.at(-1),box=q('[data-context]');if(!last){box.hidden=true;return}q('[data-context-choice]').textContent=last.label;q('[data-context-meaning]').textContent=last.meaning;q('[data-context-why]').textContent=why||guide.nodes[nodeId]?.why||'现在检查候选思路是否真的满足条件。';q('[data-context-eliminates]').textContent=last.eliminates;box.hidden=false}
function resultCard(p){const tags=p.problems.slice(0,5).map(n=>{const x=problemMap.get(n);return '<span>#'+n+' '+esc(x?.title||'')+'</span>'}).join('');return '<article class="result"><header><span>候选思路</span><strong>'+esc(p.name)+'</strong></header><dl><div><dt>为什么像</dt><dd>'+esc(p.signal)+'</dd></div><div><dt>代码里守住什么</dt><dd>'+esc(p.invariant)+'</dd></div><div><dt>什么情况会失效</dt><dd>'+esc(p.reject)+'</dd></div><div><dt>动手前先记住</dt><dd>'+esc(p.template)+'</dd></div></dl><div class="problem-tags">'+tags+'</div></article>'}
function showResults(ids){const ps=ids.map(id=>patternMap.get(id)).filter(Boolean);q('[data-step]').textContent='判断完成 '+String(history.length).padStart(2,'0')+' 步';q('[data-question]').textContent=ps.length>1?'先比较这几种候选思路':'先验证这条候选思路';q('[data-description]').textContent='先看它为什么成立，再用失效条件反证。反证过不了，就退回上一步。';q('[data-options]').innerHTML='';const r=q('[data-results]');r.hidden=false;r.innerHTML=ps.map(resultCard).join('')+'<footer class="result-actions"><button data-back>返回上一步</button><button data-restart>重新判断</button></footer>';context('这条选择已经把范围缩到下面几种思路；现在要用失效条件确认它们是否真的成立。');r.querySelector('[data-back]').onclick=()=>{const last=history.pop();nodeId=last?.nodeId||'start';render()};r.querySelector('[data-restart]').onclick=reset;crumbs()}
function render(){const n=guide.nodes[nodeId];q('[data-step]').textContent='正在判断 '+String(history.length+1).padStart(2,'0');q('[data-question]').textContent=n.title;q('[data-description]').textContent=n.description;q('[data-results]').hidden=true;q('[data-options]').innerHTML=n.options.map((o,i)=>'<button data-option="'+i+'"><strong>'+esc(o.label)+'</strong><small>'+esc(o.hint)+'</small><span>'+(o.next?'继续缩小范围 →':'查看候选思路 →')+'</span></button>').join('');q('[data-options]').querySelectorAll('button').forEach(b=>b.onclick=()=>{const o=n.options[+b.dataset.option];history.push({nodeId,label:o.label,meaning:o.meaning,eliminates:o.eliminates});if(o.next){nodeId=o.next;render()}else showResults(o.result||[])});context();crumbs()}
function reset(){nodeId='start';history=[];q('[data-context]').hidden=true;render()}q('[data-reset]').onclick=reset;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('[data-view]').forEach(v=>v.hidden=v.dataset.view!==b.dataset.tab)});
function renderAtlas(filter=''){const f=filter.toLowerCase();q('[data-atlas]').innerHTML=guide.patterns.filter(p=>[p.name,p.signal,p.reject,p.template,...p.branches].join(' ').toLowerCase().includes(f)).map((p,i)=>'<article class="pattern"><header><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(p.name)+'</strong></header><p>'+esc(p.signal)+'</p><small>'+esc(p.template)+'</small><div>'+p.problems.slice(0,4).map(n=>'#'+n).join(' · ')+'</div></article>').join('')}q('[data-search]').oninput=e=>renderAtlas(e.target.value);renderAtlas();reset();
</script>
</body>
</html>`;

const target = path.resolve(outputPath);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, html);
console.log(JSON.stringify({
  output: target,
  bytes: Buffer.byteLength(html),
  sha256: crypto.createHash('sha256').update(html).digest('hex'),
  patterns: guide.patterns.length
}));
