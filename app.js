'use strict';

/* ==================================================================
   Shared helpers (exercises.js uses them too)
   ================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(props)) {
    if (val == null || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'text') el.textContent = val;
    else if (key === 'html') el.innerHTML = val;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), val);
    else el.setAttribute(key, val === true ? '' : val);
  }
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

const escapeHTML = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* Plain text with `code` spans. */
const rich = (s) => escapeHTML(s).replace(/`([^`]+)`/g, '<code>$1</code>');

const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

/* ==================================================================
   Syntax highlighting
   ================================================================== */

const GRAMMAR = {
  js: [
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^\\`])*`|"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*')|\b(const|let|var|function|return|if|else|for|of|in|while|do|new|class|extends|async|await|try|catch|finally|throw|typeof|instanceof|true|false|null|undefined|this|break|continue|switch|case|default)\b|((?<![\w$])\d+(?:\.\d+)?)/g,
    ['com', 'str', 'kw', 'num'],
  ],
  css: [
    /(\/\*[\s\S]*?\*\/)|("[^"\n]*"|'[^'\n]*')|(@[\w-]+|!important)|([^{};/\s][^{};/]*?)(?=\s*\{)|([\w-]+)(?=\s*:(?!:))|(#[\da-fA-F]{3,8}\b|(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em|%|vh|vw|fr|s|ms|deg)?)/g,
    ['com', 'str', 'kw', 'sel', 'prop', 'num'],
  ],
  html: [
    /(<!--[\s\S]*?-->)|(<!DOCTYPE[^>]*>)|(<\/?[\w-]+)|([\w:-]+)(?==)|("[^"]*")|(\/?>)/gi,
    ['com', 'kw', 'tag', 'attr', 'str', 'tag'],
  ],
};

function highlight(code, lang) {
  const grammar = GRAMMAR[lang];
  if (!grammar) return escapeHTML(code);
  const [re, names] = grammar;
  re.lastIndex = 0;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    if (m[0] === '') {
      re.lastIndex += 1;
      continue;
    }
    const group = m.findIndex((v, i) => i > 0 && v !== undefined);
    out += escapeHTML(code.slice(last, m.index));
    out += `<span class="t-${names[group - 1]}">${escapeHTML(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + escapeHTML(code.slice(last));
}

const FILE = { html: 'index.html', css: 'style.css', js: 'script.js' };

function dedent(text) {
  const lines = text.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(pad)).join('\n');
}

/* ==================================================================
   Panes
   ================================================================== */

function pane(title, body, action) {
  return h('div', { class: 'pane' }, h('div', { class: 'bar' }, h('span', { text: title }), action), body);
}

function codeBlock({ lang, file, code }) {
  const codeEl = h('code');
  const copy = h('button', { class: 'bar-btn', type: 'button', text: 'Copy' });
  const el = pane(file || FILE[lang], h('pre', { class: `code-body lang-${lang}` }, codeEl), copy);
  el.classList.add('code');
  el.setCode = (text, html) => {
    el.source = text;
    codeEl.innerHTML = html ?? highlight(text, lang);
  };
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el.source);
      copy.textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren(codeEl);
      copy.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
  });
  el.setCode(code);
  return el;
}

function preCode(code, lang) {
  return h('pre', { class: `pre lang-${lang}` }, h('code', { html: highlight(code, lang) }));
}

/* ==================================================================
   Console output (formats values roughly like the browser console)
   ================================================================== */

function fmt(value, nested = false, seen = new Set()) {
  if (typeof value === 'string') return nested ? `'${value}'` : value;
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}()`;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return value.toString();
  if (value === null || typeof value !== 'object') return Object.is(value, -0) ? '-0' : String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  try {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (value instanceof Element) {
      const id = value.id ? `#${value.id}` : '';
      const cls = [...value.classList].map((c) => `.${c}`).join('');
      return `<${value.localName}${id}${cls}>`;
    }
    if (value instanceof NodeList || value instanceof HTMLCollection) {
      return `${value.constructor.name}(${value.length}) [${[...value].map((v) => fmt(v, true, seen)).join(', ')}]`;
    }
    if (value instanceof Promise) return 'Promise {…}';
    if (Array.isArray(value)) return `[${value.map((v) => fmt(v, true, seen)).join(', ')}]`;
    const entries = Object.entries(value).map(([k, v]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`;
      return `${key}: ${fmt(v, true, seen)}`;
    });
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  } finally {
    seen.delete(value);
  }
}

/* lines: the element that receives log lines, or null for a silent console. */
function makeConsole(lines) {
  const write = (kind) => (...args) => {
    if (!lines) return;
    const box = lines.closest('.pane');
    if (box) box.hidden = false;
    lines.append(h('div', { class: kind ? `log log-${kind}` : 'log', text: args.map((a) => fmt(a)).join(' ') }));
  };
  const api = {
    log: write(''),
    info: write(''),
    debug: write(''),
    table: write(''),
    warn: write('warn'),
    error: write('error'),
  };
  api.uncaught = (err) => {
    write('error')(`Uncaught ${err && err.name ? `${err.name}: ${err.message}` : fmt(err)}`);
  };
  return api;
}

/* ==================================================================
   Sandboxed previews (shadow DOM) and script runner
   ================================================================== */

const BASE_CSS = `
:host {
  all: initial;
  display: flow-root;
  position: relative;
  padding: 16px;
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #202124;
  background: #fff;
}
h1, h2, h3, h4 { line-height: 1.25; }
img { max-width: 100%; height: auto; }
button, input, select, textarea { font: inherit; font-size: 14px; }
`;

function makeSheet(text) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  return sheet;
}

/* Renders html + css inside host's shadow root. Styles are adopted sheets,
   so they never show up as elements (selectors like :first-child stay honest). */
function mount(host, { html = '', css = '', base = '', inspect = '' } = {}, safe = true) {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.userSheet = makeSheet(css);
  root.adoptedStyleSheets = [makeSheet(BASE_CSS + base), root.userSheet, makeSheet(inspect)];
  root.innerHTML = html;
  if (safe && !root.isSafe) {
    root.isSafe = true;
    root.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('a[href]')) e.preventDefault();
    });
    root.addEventListener('submit', (e) => e.preventDefault());
  }
  return root;
}

function setCSS(root, css) {
  root.userSheet.replaceSync(css);
}

/* A document stand-in: queries go to the preview, everything else to the real document. */
function docProxy(root) {
  const own = {
    querySelector: (s) => root.querySelector(s),
    querySelectorAll: (s) => root.querySelectorAll(s),
    getElementById: (id) => root.getElementById(id),
    getElementsByClassName: (c) => root.querySelectorAll(c.trim().split(/\s+/).map((x) => `.${CSS.escape(x)}`).join('')),
    getElementsByTagName: (t) => root.querySelectorAll(t),
    addEventListener: (type, fn, opts) => {
      if (type === 'DOMContentLoaded' || type === 'load') queueMicrotask(() => fn(new Event(type)));
      else root.addEventListener(type, fn, opts);
    },
    removeEventListener: (type, fn, opts) => root.removeEventListener(type, fn, opts),
    body: root,
    documentElement: root,
  };
  return new Proxy(document, {
    get(target, prop) {
      if (Object.hasOwn(own, prop)) return own[prop];
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set() {
      return true;
    },
  });
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const ARTWORKS = {
  1: { id: 1, title: 'Starry Night', artist: 'Vincent van Gogh', year: 1889 },
  2: { id: 2, title: 'The Kiss', artist: 'Gustav Klimt', year: 1908 },
  3: { id: 3, title: 'Water Lilies', artist: 'Claude Monet', year: 1906 },
};

/* Simulated API: /api/artworks and /api/artworks/:id */
function fakeFetch(url, delay = 250) {
  const match = String(url).match(/^\/api\/artworks(?:\/(\d+))?\/?$/);
  let status = 404;
  let body = { error: 'Not found' };
  if (match && !match[1]) {
    status = 200;
    body = Object.values(ARTWORKS);
  } else if (match && ARTWORKS[match[1]]) {
    status = 200;
    body = ARTWORKS[match[1]];
  }
  const response = {
    ok: status === 200,
    status,
    url: String(url),
    json: () => Promise.resolve(structuredClone(body)),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
  return new Promise((resolve) => setTimeout(() => resolve(response), delay));
}

/* Runs code as the body of an async function. Resolves to false if it threw. */
function runScript(code, { root = null, console: cons }) {
  let fn;
  try {
    fn = new AsyncFunction('document', 'console', 'fetch', code);
  } catch (err) {
    cons.uncaught(err);
    return Promise.resolve(false);
  }
  return fn(root ? docProxy(root) : document, cons, (url) => fakeFetch(url)).then(
    () => true,
    (err) => {
      cons.uncaught(err);
      return false;
    },
  );
}

function matchSelector(root, sel) {
  if (!sel.trim()) return { els: [] };
  try {
    return { els: [...root.querySelectorAll(sel)] };
  } catch {
    return { els: [], error: true };
  }
}

/* DevTools-like highlight boxes over matched elements. */
function drawHits(view, layer, els) {
  const base = view.getBoundingClientRect();
  const boxes = els.flatMap((el) =>
    [...el.getClientRects()].map((r) =>
      h('div', {
        class: 'hit',
        style: `left:${r.left - base.left - view.clientLeft}px;top:${r.top - base.top - view.clientTop}px;width:${r.width}px;height:${r.height}px`,
      }),
    ),
  );
  layer.replaceChildren(...boxes);
}

/* ==================================================================
   Theory: static demos (code from <script type="text/plain"> blocks)
   ================================================================== */

const STAGES = {
  semantic: {
    inspect: `
header, nav, main, article, aside, footer, section {
  display: block; position: relative; margin: 6px 0; padding: 22px 10px 8px;
  border: 1px dashed #7a9ca5; background: rgb(140 182 192 / 0.12);
}
:is(header, nav, main, article, aside, footer, section)::before {
  position: absolute; top: 5px; left: 8px;
  font: 12px/1 ui-monospace, Menlo, monospace; color: #1a5fb4;
}
header::before { content: "header"; } nav::before { content: "nav"; }
main::before { content: "main"; } article::before { content: "article"; }
aside::before { content: "aside"; } footer::before { content: "footer"; }
section::before { content: "section"; }
h1, h2, p { margin: 0; } h1 { font-size: 20px; } h2 { font-size: 17px; }
a { margin-right: 10px; }
`,
  },
};

function logRequest(form, cons) {
  const method = (form.getAttribute('method') || 'get').toUpperCase();
  const action = form.getAttribute('action') || '';
  const query = new URLSearchParams(new FormData(form)).toString();
  if (method === 'GET') {
    cons.log(`GET ${action}?${query}`);
  } else {
    cons.log(`${method} ${action}`);
    cons.log(query);
  }
}

function buildDemo(fig) {
  const parts = $$('script[type="text/plain"]', fig).map((s) => ({
    lang: s.dataset.lang,
    file: s.dataset.file || FILE[s.dataset.lang],
    code: dedent(s.textContent.replace(/<\\\//g, '</')),
  }));
  const pick = (lang) => parts.filter((p) => p.lang === lang).map((p) => p.code).join('\n');
  const html = pick('html');
  const css = pick('css');
  const js = pick('js');
  const { stage, note, submit } = fig.dataset;

  fig.textContent = '';
  fig.append(h('div', { class: 'demo-code' }, parts.map(codeBlock)));
  if (fig.dataset.preview === 'none') {
    fig.classList.add('demo-solo');
    return;
  }

  const out = h('div', { class: 'demo-out' });
  let view = null;
  let lines = null;
  if (html || css) {
    view = h('div', { class: 'view' });
    out.append(pane('Result', view));
  }
  if (js || submit) {
    lines = h('div', { class: 'console-lines' });
    const again = js ? h('button', { class: 'bar-btn', type: 'button', text: 'Run again', onclick: () => run() }) : null;
    const box = pane(fig.dataset.console || 'Console', lines, again);
    box.hidden = Boolean(view);
    out.append(box);
  }
  if (note) out.append(h('p', { class: 'demo-note', text: note }));
  fig.append(out);

  function run() {
    let root = null;
    if (view) {
      const host = h('div');
      view.replaceChildren(host);
      root = mount(host, { html, css, ...(STAGES[stage] || {}) });
    }
    if (lines) lines.replaceChildren();
    const cons = makeConsole(lines);
    if (submit && root) root.addEventListener('submit', (e) => logRequest(e.target, cons));
    if (js) runScript(js, { root, console: cons });
  }
  run();
}

/* ==================================================================
   Theory: playgrounds (buttons change one CSS value at a time)
   ================================================================== */

const STAGE_COLORS = 'background:#8cb6c0;outline:1px solid #5b8a96;font:600 14px/1.4 ui-monospace,Menlo,monospace';

const PLAYGROUNDS = {
  box: {
    html: '<div class="box">Content</div>',
    css: `.box {
  box-sizing: {{sizing}};
  width: 200px;
  padding: {{pad}};
  border: 5px solid;
  margin: 10px;
}`,
    controls: [
      { key: 'sizing', prop: 'box-sizing', values: ['content-box', 'border-box'] },
      { key: 'pad', prop: 'padding', values: ['20px', '40px', '0'] },
    ],
    inspect: `.box {
  background: linear-gradient(#8cb6c0, #8cb6c0) content-box, #c3d08b;
  border-color: #f4c862;
  box-shadow: 0 0 0 10px #f9cc9d;
  font: 13px/1.4 ui-monospace, Menlo, monospace;
}`,
    readout(root) {
      const box = root.querySelector('.box');
      const cs = getComputedStyle(box);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const border = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      const content = box.offsetWidth - pad - border;
      return `Rendered width ${box.offsetWidth}px = ${content} content + ${pad} padding + ${border} border`;
    },
  },

  display: {
    html: `<p>
  Text before
  <span class="tag">One</span>
  <span class="tag">Two</span>
  and after.
</p>`,
    css: `.tag {
  display: {{d}};
  width: 120px;
  height: 40px;
  margin: 12px;
}`,
    controls: [{ key: 'd', prop: 'display', values: ['inline', 'inline-block', 'block', 'none'] }],
    inspect: `.tag { ${STAGE_COLORS}; } p { margin: 0; }`,
  },

  position: {
    html: `<div class="card">
  <span class="badge">New</span>
  <h3>Starry Night</h3>
  <p>Vincent van Gogh</p>
</div>`,
    css: `.card {
  position: {{card}};
}
.badge {
  position: {{badge}};
  top: 8px;
  right: 8px;
}`,
    controls: [
      { key: 'card', sel: '.card', prop: 'position', values: ['static', 'relative'], value: 'relative' },
      { key: 'badge', sel: '.badge', prop: 'position', values: ['static', 'relative', 'absolute'], value: 'absolute' },
    ],
    base: `.card { width: 220px; margin: 8px 0 8px 32px; padding: 16px; background: #eff2ed; }
.card h3, .card p { margin: 0; }
.badge { padding: 2px 8px; font-size: 13px; color: #fff; background: #26231f; }`,
  },

  flex: {
    html: `<div class="row">
  <div class="item">1</div>
  <div class="item grow">2</div>
  <div class="item tall">3</div>
</div>`,
    css: `.row {
  display: flex;
  flex-direction: {{dir}};
  justify-content: {{jc}};
  align-items: {{ai}};
  gap: {{gap}};
}
.grow {
  flex: {{grow}};
}`,
    controls: [
      { key: 'dir', prop: 'flex-direction', values: ['row', 'column'] },
      { key: 'jc', prop: 'justify-content', values: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'] },
      { key: 'ai', prop: 'align-items', values: ['stretch', 'flex-start', 'center', 'flex-end'] },
      { key: 'gap', prop: 'gap', values: ['0', '8px', '24px'], value: '8px' },
      { key: 'grow', sel: '.grow', prop: 'flex', values: ['0 1 auto', '1'] },
    ],
    base: `.row { height: 200px; padding: 8px; background: #eff2ed; }
.item { padding: 8px 16px; ${STAGE_COLORS}; }
.grow { background: #c3d08b; }
.tall { padding-block: 24px; }`,
  },

  grid: {
    html: `<div class="grid">
  <div class="cell">1</div>
  <div class="cell">2</div>
  <div class="cell">3</div>
  <div class="cell">4</div>
  <div class="cell">5</div>
  <div class="cell">6</div>
</div>`,
    css: `.grid {
  display: grid;
  grid-template-columns: {{cols}};
  gap: {{gap}};
}
.cell:first-child {
  grid-column: {{span}};
}`,
    controls: [
      { key: 'cols', prop: 'grid-template-columns', values: ['1fr 1fr 1fr', 'repeat(2, 1fr)', '100px 1fr', 'repeat(auto-fill, 90px)'] },
      { key: 'gap', prop: 'gap', values: ['0', '8px', '16px'], value: '8px' },
      { key: 'span', sel: '.cell:first-child', prop: 'grid-column', values: ['auto', 'span 2', '1 / -1'] },
    ],
    base: `.grid { padding: 8px; background: #eff2ed; }
.cell { padding: 12px; text-align: center; ${STAGE_COLORS}; }
.cell:first-child { background: #c3d08b; }`,
  },

  media: {
    html: `<header class="top">
  <a class="logo" href="search.html">Artmart</a>
  <nav>
    <a href="search.html">Search</a>
    <a href="cart.html">Cart (2)</a>
  </nav>
</header>`,
    css: `.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 3rem;
  font-size: 2rem;
}

@media (max-width: 600px) {
  .top {
    height: 2rem;
    font-size: 1rem;
  }
}`,
    controls: [],
    base: `.top { padding: 0 12px; background: #eff2ed; font-family: Palatino, "Palatino Linotype", Georgia, serif; }
.top a { color: #26231f; text-decoration: none; }
.logo { font-weight: 700; letter-spacing: 0.08em; }
nav { display: flex; gap: 1em; }`,
    note: 'Make the window narrower than 600px, or use the device toolbar in DevTools.',
    readout: () => `Window width: ${innerWidth}px. ${innerWidth <= 600 ? 'The media query applies.' : 'The media query does not apply.'}`,
  },
};

/* Highlights a template and wraps the current values in <mark>. */
function renderTemplate(template, state, lang) {
  const keys = [];
  const tokenized = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    keys.push(key);
    return `__V${keys.length - 1}__`;
  });
  return highlight(tokenized, lang).replace(/__V(\d+)__/g, (_, i) => `<mark>${escapeHTML(state[keys[i]])}</mark>`);
}

function buildPlayground(fig) {
  const cfg = PLAYGROUNDS[fig.dataset.playground];
  const state = {};
  for (const c of cfg.controls) state[c.key] = c.value ?? c.values[0];

  const cssBlock = codeBlock({ lang: 'css', code: '' });
  const host = h('div');
  const view = h('div', { class: 'view' }, host);
  const readout = cfg.readout ? h('div', { class: 'readout', 'aria-live': 'polite' }) : null;

  const control = (c) => {
    const buttons = c.values.map((v) =>
      h('button', {
        type: 'button',
        'aria-pressed': String(v === state[c.key]),
        text: v,
        onclick: () => {
          state[c.key] = v;
          buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === v)));
          update();
        },
      }),
    );
    const label = (c.sel ? `<span class="t-sel">${escapeHTML(c.sel)}</span> ` : '') + `<span class="t-prop">${escapeHTML(c.prop)}</span>`;
    return h('div', { class: 'control', role: 'group', 'aria-label': `${c.sel || ''} ${c.prop}`.trim() },
      h('span', { class: 'control-label', html: label }),
      h('div', { class: 'seg' }, buttons));
  };

  fig.textContent = '';
  if (cfg.controls.length) fig.append(h('div', { class: 'controls' }, cfg.controls.map(control)));
  fig.append(
    h('div', { class: 'demo-code' }, codeBlock({ lang: 'html', code: cfg.html }), cssBlock),
    h('div', { class: 'demo-out' },
      pane('Result', h('div', {}, view, readout)),
      cfg.note ? h('p', { class: 'demo-note', text: cfg.note }) : null),
  );

  const root = mount(host, { html: cfg.html, base: cfg.base || '', inspect: cfg.inspect || '' });
  const measure = () => {
    if (readout) readout.textContent = cfg.readout(root);
  };

  function update() {
    const css = cfg.css.replace(/\{\{(\w+)\}\}/g, (_, key) => state[key]);
    setCSS(root, css);
    cssBlock.setCode(css, renderTemplate(cfg.css, state, 'css'));
    measure();
  }

  update();
  if (readout) new ResizeObserver(measure).observe(view);
}

/* ==================================================================
   Theory: selector lab
   ================================================================== */

const LAB = {
  html: `<nav id="main-nav">
  <a href="/">Home</a>
  <a href="https://blog.example.com">Blog</a>
</nav>
<h2>Prints</h2>
<p>Hand-picked works.</p>
<ul class="list">
  <li class="item">Starry Night <span class="price">€49</span></li>
  <li class="item sold">The Kiss <span class="price">€35</span></li>
  <li class="item">Water Lilies <span class="price">€42</span></li>
</ul>
<p>Prices include VAT.</p>`,
  base: `nav a { margin-right: 12px; }
h2 { margin: 12px 0 4px; font-size: 20px; }
p { margin: 4px 0; }
ul { margin: 6px 0; padding-left: 22px; }
.sold { color: #80868b; text-decoration: line-through; }
.price { color: #5f6368; }`,
  chips: [
    'p', '.item', '#main-nav', 'nav a', '.list > li', '.item .price', '.item.sold',
    '.item:not(.sold)', 'li:first-child', 'li:nth-child(odd)', 'h2 + p', 'h2 ~ p', 'a[href^="https"]', '*',
  ],
};

function buildSelectorLab(fig) {
  const host = h('div');
  const layer = h('div', { class: 'hit-layer' });
  const view = h('div', { class: 'view' }, host, layer);
  const input = h('input', {
    class: 'sel-input', type: 'text', value: '.item', spellcheck: 'false',
    autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'CSS selector',
  });
  const count = h('span', { class: 'sel-count', 'aria-live': 'polite' });
  const chips = LAB.chips.map((s) =>
    h('button', { type: 'button', text: s, onclick: () => { input.value = s; draw(); } }),
  );

  fig.textContent = '';
  fig.append(
    h('div', { class: 'controls' },
      h('div', { class: 'sel-row' }, input, h('span', { class: 'sel-brace', text: '{ }' }), count),
      h('div', { class: 'seg' }, chips)),
    h('div', { class: 'demo-code' }, codeBlock({ lang: 'html', code: LAB.html })),
    h('div', { class: 'demo-out' }, pane('Result', view)),
  );

  const root = mount(host, { html: LAB.html, base: LAB.base });

  function draw() {
    const { els, error } = matchSelector(root, input.value);
    drawHits(view, layer, els);
    count.textContent = error ? 'Invalid selector' : `${els.length} ${els.length === 1 ? 'match' : 'matches'}`;
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === input.value.trim())));
  }

  input.addEventListener('input', draw);
  new ResizeObserver(draw).observe(view);
  draw();
}

/* ==================================================================
   Page chrome
   ================================================================== */

function initToc() {
  const links = new Map($$('.toc a[href^="#"]').map((a) => [a.hash.slice(1), a]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const link = links.get(entry.target.id);
        if (!link) continue;
        $$('.toc a.is-current').forEach((a) => a.classList.remove('is-current'));
        link.classList.add('is-current');
      }
    },
    { rootMargin: '-12% 0px -80% 0px' },
  );
  $$('.topic[id], .ex-group[id]').forEach((s) => observer.observe(s));
}

/* Fills the hero diagram with its real measurements. */
function initHero() {
  const layers = $$('.hero .bm');
  const content = $('.hero .bm-content');
  if (!content) return;
  const size = $('.bm-size', content);
  const measure = () => {
    layers.forEach((layer, i) => {
      const outer = layer.getBoundingClientRect();
      const inner = (layers[i + 1] || content).getBoundingClientRect();
      const put = (side, v) => { layer.querySelector(`:scope > .bm-${side}`).textContent = Math.round(v); };
      put('t', inner.top - outer.top);
      put('r', outer.right - inner.right);
      put('b', outer.bottom - inner.bottom);
      put('l', inner.left - outer.left);
    });
    const r = content.getBoundingClientRect();
    size.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
  };
  new ResizeObserver(measure).observe(content);
}

$$('figure.demo[data-playground]').forEach(buildPlayground);
$$('figure.demo[data-lab]').forEach(buildSelectorLab);
$$('figure.demo:not([data-playground]):not([data-lab])').forEach(buildDemo);
initHero();
initToc();
