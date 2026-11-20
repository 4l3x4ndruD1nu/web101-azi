'use strict';

/* Exercises. Relies on the helpers defined in app.js. */
(() => {
  /* ----------------------------------------------------------------
     Saved answers
     ---------------------------------------------------------------- */
  const STORE = 'web101-recap:v1';
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    saved = {};
  }
  saved.answers ||= {};
  saved.solved ||= {};

  const persist = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      /* storage blocked or full: answers live only for this visit */
    }
  };
  const answerOf = (ex, fallback) => saved.answers[ex.id] ?? fallback;
  const save = (ex, value) => {
    saved.answers[ex.id] = value;
    persist();
  };

  /* ----------------------------------------------------------------
     Helpers for the checks
     ---------------------------------------------------------------- */
  const q = (r, s) => r.querySelector(s);
  const qa = (r, s) => [...r.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const box = (el) => el.getBoundingClientRect();
  const textBox = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
  };
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
  const midX = (r) => r.left + r.width / 2;
  const midY = (r) => r.top + r.height / 2;
  const cs = (el) => getComputedStyle(el);
  const px = (v) => parseFloat(v) || 0;

  const labelFor = (d, input) =>
    (input.id && d.querySelector(`label[for="${CSS.escape(input.id)}"]`)) || input.closest('label');
  const fields = (d) =>
    qa(d, 'input:not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]), select, textarea');

  const patternWorks = (pattern, good, bad) => {
    if (!pattern) return false;
    for (const flags of ['v', 'u']) {
      try {
        const re = new RegExp(`^(?:${pattern})$`, flags);
        return good.every((s) => re.test(s)) && bad.every((s) => !re.test(s));
      } catch {
        /* try the next flag */
      }
    }
    return false;
  };

  /* All style rules the student wrote (including rules inside @media). */
  const userRules = (root) => {
    const out = [];
    const walk = (list) => {
      for (const rule of list) {
        if (rule.selectorText) out.push(rule);
        else if (rule.cssRules) walk(rule.cssRules);
      }
    };
    walk(root.userSheet.cssRules);
    return out;
  };
  const opacityOf = (v) => (v.trim().endsWith('%') ? parseFloat(v) / 100 : parseFloat(v));

  const deepEqual = (a, b) => {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  };

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`no result after ${ms / 1000}s`)), ms)),
    ]);

  const HTML_BASE = `
form { display: grid; gap: 6px; max-width: 300px; }
fieldset { display: flex; flex-wrap: wrap; gap: 12px; }
table { border-collapse: collapse; }
th, td { padding: 4px 10px; text-align: left; border: 1px solid #dadce0; }
img { display: block; max-width: 180px; }
`;

  const SELECTOR_BASE = `
header { display: flex; align-items: center; gap: 24px; }
nav { display: flex; gap: 12px; }
.logo { font-weight: 700; }
ul { margin: 0; padding-left: 22px; }
table { border-collapse: collapse; }
th, td { padding: 4px 12px; text-align: left; border: 1px solid #dadce0; }
p { margin: 12px 0 0; }
`;

  /* ----------------------------------------------------------------
     The exercises, in order. Numbering follows this array.
     ---------------------------------------------------------------- */
  const EXERCISES = [
    /* ---------------------------- HTML ---------------------------- */
    {
      id: 'checkout-form',
      group: 'html',
      type: 'html',
      min: 3,
      title: 'Checkout form',
      reqs: [
        ['A `<form>` that sends with `method="post"`', (d) => /^post$/i.test(q(d, 'form')?.getAttribute('method') || '')],
        ['An email field that is `required`', (d) => q(d, 'form input[type="email"][required]')],
        [
          'An expiration date field with placeholder `MM/YYYY` and a `pattern` that accepts 05/2027 but not 5/27',
          (d) => {
            const input = q(d, 'input[placeholder="MM/YYYY"]');
            return input && patternWorks(input.getAttribute('pattern'), ['05/2027', '12/2030'], ['5/27', '05/27', 'ab/cdef', '052027']);
          },
        ],
        ['Every field has a `<label>`', (d) => fields(d).length > 0 && fields(d).every((i) => labelFor(d, i))],
        [
          'A submit button that says Pay',
          (d) => {
            const btn = q(d, 'form button:not([type=button]):not([type=reset]), form input[type=submit]');
            return btn && /pay/i.test(btn.localName === 'input' ? btn.value : txt(btn));
          },
        ],
      ],
      solution: `<form action="/pay" method="post">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required>

  <label for="expiry">Expiration date</label>
  <input id="expiry" name="expiry" placeholder="MM/YYYY" pattern="\\d{2}/\\d{4}" required>

  <button type="submit">Pay</button>
</form>`,
    },
    {
      id: 'radios',
      group: 'html',
      type: 'html',
      min: 2,
      title: 'Print size',
      text: 'The user picks exactly one size: Small, Medium or Large.',
      reqs: [
        ['Three radio buttons', (d) => qa(d, 'input[type=radio]').length === 3],
        [
          'Only one can be selected at a time',
          (d) => {
            const r = qa(d, 'input[type=radio]');
            return r.length > 1 && r[0].name && r.every((x) => x.name === r[0].name);
          },
        ],
        [
          'Each one has its own `value`',
          (d) => {
            const v = qa(d, 'input[type=radio]').map((x) => x.getAttribute('value'));
            return v.length > 0 && v.every(Boolean) && new Set(v).size === v.length;
          },
        ],
        ['Each one has a label', (d) => { const r = qa(d, 'input[type=radio]'); return r.length > 0 && r.every((x) => labelFor(d, x)); }],
        [
          'Medium is selected when the page loads',
          (d) => {
            const c = qa(d, 'input[type=radio][checked]');
            return c.length === 1 && (/^m(edium)?$/i.test(c[0].getAttribute('value') || '') || /^medium$/i.test(txt(labelFor(d, c[0]))));
          },
        ],
        [
          'Grouped in a `<fieldset>` with a `<legend>`',
          (d) => { const f = q(d, 'fieldset'); return f && q(f, 'legend') && qa(f, 'input[type=radio]').length === 3; },
        ],
      ],
      solution: `<fieldset>
  <legend>Size</legend>
  <label><input type="radio" name="size" value="s"> Small</label>
  <label><input type="radio" name="size" value="m" checked> Medium</label>
  <label><input type="radio" name="size" value="l"> Large</label>
</fieldset>`,
    },
    {
      id: 'table',
      group: 'html',
      type: 'html',
      min: 2,
      title: 'Cart table',
      text: 'Two artworks with frame and price, then a total row.',
      reqs: [
        ['`<thead>`, `<tbody>` and `<tfoot>` inside a `<table>`', (d) => q(d, 'table > thead') && q(d, 'table > tbody') && q(d, 'table > tfoot')],
        [
          'Header cells are `<th>`: Artwork, Frame, Price',
          (d) => {
            const th = qa(d, 'thead th').map(txt);
            return th.length === 3 && /artwork/i.test(th[0]) && /frame/i.test(th[1]) && /price/i.test(th[2]);
          },
        ],
        [
          'Two rows in the body, three `<td>` each',
          (d) => { const rows = qa(d, 'tbody > tr'); return rows.length === 2 && rows.every((r) => qa(r, ':scope > td').length === 3); },
        ],
        [
          'In the footer, the cell "Total" spans the first two columns',
          (d) => { const c = q(d, 'tfoot td, tfoot th'); return c && c.getAttribute('colspan') === '2' && /total/i.test(txt(c)); },
        ],
      ],
      solution: `<table>
  <thead>
    <tr><th>Artwork</th><th>Frame</th><th>Price</th></tr>
  </thead>
  <tbody>
    <tr><td>Starry Night</td><td>Classic</td><td>€ 87.20</td></tr>
    <tr><td>The Kiss</td><td>Natural</td><td>€ 114.50</td></tr>
  </tbody>
  <tfoot>
    <tr><td colspan="2">Total</td><td>€ 201.70</td></tr>
  </tfoot>
</table>`,
    },
    {
      id: 'structure',
      group: 'html',
      type: 'html',
      min: 2,
      title: 'Page structure',
      inspect: STAGES.semantic.inspect,
      reqs: [
        ['`<header>` with a `<nav>` inside', (d) => q(d, 'header nav')],
        ['Three links in the nav', (d) => qa(d, 'nav a[href]').length === 3],
        ['`<main>` with an `<article>` inside', (d) => q(d, 'main article')],
        ['The article starts with an `<h2>`', (d) => q(d, 'main article')?.firstElementChild?.localName === 'h2'],
        [
          '`<footer>` after `<main>`, on the same level as `<header>`',
          (d) => {
            const hd = q(d, 'header');
            const m = q(d, 'main');
            const f = q(d, 'main ~ footer');
            return hd && m && f && hd.parentNode === m.parentNode && f.parentNode === m.parentNode;
          },
        ],
      ],
      solution: `<header>
  <nav>
    <a href="search.html">Search</a>
    <a href="cart.html">Cart</a>
    <a href="checkout.html">Checkout</a>
  </nav>
</header>
<main>
  <article>
    <h2>Starry Night</h2>
    <p>Vincent van Gogh, 1889</p>
  </article>
</main>
<footer>© Artmart</footer>`,
    },
    {
      id: 'linked-image',
      group: 'html',
      type: 'html',
      min: 1,
      title: 'Linked image',
      text: 'Show `img/painting.svg` with a caption. Clicking the image opens `framing.html`.',
      reqs: [
        ['A `<figure>` with an `<img>` and a `<figcaption>`', (d) => q(d, 'figure img') && q(d, 'figure figcaption')],
        ['The image is `img/painting.svg`', (d) => /^(\.\/)?img\/painting\.svg$/.test(q(d, 'img')?.getAttribute('src') || '')],
        ['The image has alt text', (d) => (q(d, 'img')?.getAttribute('alt') || '').trim().length > 0],
        ['The image links to `framing.html`', (d) => /^(\.\/)?framing\.html$/.test(q(d, 'img')?.closest('a')?.getAttribute('href') || '')],
      ],
      solution: `<figure>
  <a href="framing.html">
    <img src="img/painting.svg" alt="Abstract composition in red, yellow and blue">
  </a>
  <figcaption>Composition No. 1</figcaption>
</figure>`,
    },

    /* ----------------------------- CSS ---------------------------- */
    {
      id: 'sel-nav',
      group: 'css',
      type: 'selector',
      min: 1,
      title: 'Links in the nav',
      text: 'Select only the links inside `<nav>`.',
      html: `<header>
  <a class="logo" href="search.html">Artmart</a>
  <nav>
    <a href="search.html">Search</a>
    <a href="cart.html">Cart</a>
  </nav>
</header>
<p>Read the <a href="faq.html">FAQ</a>.</p>`,
      answer: 'nav a',
    },
    {
      id: 'sel-menu',
      group: 'css',
      type: 'selector',
      min: 1,
      title: 'Top-level items',
      text: 'Select the three items of `.menu`, not the nested ones.',
      html: `<ul class="menu">
  <li>Paintings
    <ul>
      <li>Oil</li>
      <li>Watercolor</li>
    </ul>
  </li>
  <li>Prints</li>
  <li>Frames</li>
</ul>`,
      answer: '.menu > li',
    },
    {
      id: 'sel-zebra',
      group: 'css',
      type: 'selector',
      min: 1,
      title: 'Every second row',
      text: 'Select the 2nd and 4th row of the table body.',
      html: `<table>
  <thead>
    <tr><th>Artwork</th><th>Price</th></tr>
  </thead>
  <tbody>
    <tr><td>Starry Night</td><td>€ 49</td></tr>
    <tr><td>The Kiss</td><td>€ 35</td></tr>
    <tr><td>Water Lilies</td><td>€ 42</td></tr>
    <tr><td>The Harvesters</td><td>€ 39</td></tr>
  </tbody>
</table>`,
      answer: 'tbody tr:nth-child(even)',
    },
    {
      id: 'specificity',
      group: 'css',
      type: 'quiz',
      min: 2,
      title: 'Which rule wins?',
      items: [
        {
          html: '<p id="intro" class="lead">Hello</p>',
          code: '#intro { color: green; }\np.lead { color: red; }\n.lead  { color: blue; }',
          label: 'Text color',
          answer: 'green',
        },
        {
          html: '<p class="lead note">Hello</p>',
          code: '.note { color: red; }\n.lead { color: blue; }',
          label: 'Text color',
          answer: 'blue',
        },
        {
          html: '<p class="lead">Hello</p>',
          code: 'p     { color: orange !important; }\n.lead { color: blue; }',
          label: 'Text color',
          answer: 'orange',
        },
        {
          html: '<div class="card"><p>Hello</p></div>',
          code: '.card {\n  color: purple;\n  border: 1px solid;\n}',
          label: 'Does the `<p>` get a border?',
          placeholder: 'yes / no',
          answer: ['no', 'false'],
        },
      ].map((it) => ({ lang: 'css', ...it })),
    },
    {
      id: 'box-width',
      group: 'css',
      type: 'quiz',
      min: 1,
      title: 'How wide is the box?',
      items: [
        {
          code: '.box {\n  width: 300px;\n  padding: 16px;\n  border: 2px solid;\n  margin: 20px;\n}',
          label: 'Rendered width in px',
          answer: '336',
        },
        {
          code: '.box {\n  box-sizing: border-box;\n  width: 300px;\n  padding: 16px;\n  border: 2px solid;\n  margin: 20px;\n}',
          label: 'Rendered width in px',
          answer: '300',
        },
        {
          html: '<div class="parent">\n  <div class="box"></div>\n</div>',
          code: '.parent { width: 500px; padding: 20px; }\n.box    { width: 50%; }',
          label: 'Width of `.box` in px',
          answer: '250',
        },
      ].map((it) => ({ lang: 'css', ...it })),
    },
    {
      id: 'center',
      group: 'css',
      type: 'css',
      min: 1,
      title: 'Center the box',
      html: '<div class="stage">\n  <div class="box"></div>\n</div>',
      base: '.stage { height: 180px; background: #eff2ed; }\n.box { width: 60px; height: 60px; background: #8cb6c0; }',
      starter: '.stage {\n  \n}\n',
      reqs: [
        ['`.stage` is a flex container', (r) => cs(q(r, '.stage')).display.includes('flex')],
        ['The box is centered horizontally', (r) => near(midX(box(q(r, '.box'))), midX(box(q(r, '.stage'))))],
        ['The box is centered vertically', (r) => near(midY(box(q(r, '.box'))), midY(box(q(r, '.stage'))))],
      ],
      solution: '.stage {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}',
    },
    {
      id: 'header-bar',
      group: 'css',
      type: 'css',
      min: 2,
      title: 'Header bar',
      html: `<header class="bar">
  <a class="logo" href="search.html">Artmart</a>
  <nav class="links">
    <a href="search.html">Search</a>
    <a href="cart.html">Cart</a>
  </nav>
</header>`,
      base: '.bar { height: 64px; padding: 0 16px; background: #eff2ed; }\n.logo { font-weight: 700; }',
      starter: '',
      reqs: [
        [
          'Logo on the left, links on the right',
          (r) => {
            const bar = box(q(r, '.bar'));
            const last = textBox(qa(r, '.links a').at(-1));
            return near(textBox(q(r, '.logo')).left, bar.left + 16, 2) && near(last.right, bar.right - 16, 2);
          },
        ],
        [
          'Both are vertically centered in the bar',
          (r) => {
            const bar = box(q(r, '.bar'));
            return [q(r, '.logo'), q(r, '.links a')].every((el) => near(midY(textBox(el)), midY(bar), 3));
          },
        ],
        [
          'Search and Cart are 16px apart (use `gap`)',
          (r) => {
            const [a, b] = qa(r, '.links a').map(textBox);
            return near(b.left - a.right, 16, 1.5);
          },
        ],
      ],
      solution: '.bar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.links {\n  display: flex;\n  gap: 16px;\n}',
    },
    {
      id: 'gallery',
      group: 'css',
      type: 'css',
      min: 2,
      title: 'Gallery grid',
      text: 'Columns are 120px wide, as many as fit in the row. 20px between items.',
      html: `<div class="gallery">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
  <div class="item">4</div>
  <div class="item">5</div>
  <div class="item">6</div>
  <div class="item">7</div>
</div>`,
      base: '.item {\n  padding: 16px;\n  text-align: center;\n  background: #8cb6c0;\n}',
      starter: '.gallery {\n  \n}\n',
      reqs: [
        ['`.gallery` is a grid', (r) => cs(q(r, '.gallery')).display.includes('grid')],
        [
          'Every column is 120px wide',
          (r) => {
            const cols = cs(q(r, '.gallery')).gridTemplateColumns.split(' ');
            return cols.length > 1 && cols.every((c) => near(px(c), 120, 0.5));
          },
        ],
        [
          'As many columns as fit (resize the window to test)',
          (r) => {
            const g = q(r, '.gallery');
            const style = cs(g);
            const gap = px(style.columnGap);
            const width = g.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
            const cols = style.gridTemplateColumns.split(' ');
            return cols.length === Math.max(1, Math.floor((width + gap) / (120 + gap)));
          },
        ],
        ['20px gap between columns and rows', (r) => { const s = cs(q(r, '.gallery')); return px(s.columnGap) === 20 && px(s.rowGap) === 20; }],
      ],
      solution: '.gallery {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, 120px);\n  gap: 20px;\n}',
    },
    {
      id: 'remove-button',
      group: 'css',
      type: 'css',
      min: 1,
      title: 'Remove button',
      text: 'The × button covers the top right corner of the label.',
      html: `<div class="label">
  <h3>Gustav Klimt</h3>
  <p>The Kiss, 1908</p>
  <button class="remove" aria-label="Remove">×</button>
</div>`,
      base: `.label {
  width: 260px;
  margin: 8px 0 0 24px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 2px 3px rgb(0 0 0 / 0.5);
}
.label h3, .label p { margin: 0; }
.remove {
  width: 24px;
  height: 24px;
  padding: 0;
  color: #fff;
  background: #26231f;
  border: 0;
  border-radius: 50%;
}`,
      starter: '',
      reqs: [
        ['`.label` is the positioning context', (r) => cs(q(r, '.label')).position !== 'static'],
        ['The button uses `position: absolute`', (r) => cs(q(r, '.remove')).position === 'absolute'],
        [
          'Its top right corner sits exactly on the label\'s top right corner',
          (r) => {
            const l = box(q(r, '.label'));
            const b = box(q(r, '.remove'));
            return near(b.top, l.top) && near(b.right, l.right);
          },
        ],
      ],
      solution: '.label {\n  position: relative;\n}\n\n.remove {\n  position: absolute;\n  top: 0;\n  right: 0;\n}',
    },
    {
      id: 'button-states',
      group: 'css',
      type: 'css',
      min: 2,
      title: 'Button states',
      text: 'On hover the button has 90% opacity. While pressed it shrinks to 95%. The change takes 0.2s.',
      html: '<button class="btn">Checkout</button>',
      base: '.btn {\n  height: 2.5em;\n  padding: 0 2em;\n  font-size: 16px;\n  color: #fff;\n  background: #26231f;\n  border: 0;\n}',
      starter: '',
      reqs: [
        [
          '`.btn:hover` sets `opacity` to 0.9',
          (r) => userRules(r).some((rule) => /\.btn:hover/.test(rule.selectorText) && near(opacityOf(rule.style.opacity || 'x'), 0.9, 0.001)),
        ],
        [
          '`.btn:active` scales it to 0.95',
          (r) =>
            userRules(r).some(
              (rule) => /\.btn:active/.test(rule.selectorText) && (/scale\(0?\.95\)|scale\(95%\)/.test(rule.style.transform) || /^(0?\.95|95%)$/.test(rule.style.scale)),
            ),
        ],
        ['`.btn` has a `transition` of 0.2s', (r) => cs(q(r, '.btn')).transitionDuration.split(',').some((d) => d.trim() === '0.2s')],
      ],
      solution: '.btn {\n  transition: opacity 0.2s, transform 0.2s;\n}\n\n.btn:hover {\n  opacity: 0.9;\n}\n\n.btn:active {\n  transform: scale(0.95);\n}',
    },

    /* ------------------------- JavaScript ------------------------- */
    {
      id: 'predict',
      group: 'js',
      type: 'quiz',
      min: 2,
      title: 'What does it log?',
      items: [
        { code: 'console.log(typeof NaN);', answer: 'number' },
        { code: 'console.log("10" + 1);', answer: '101' },
        { code: 'console.log("10" - 1);', answer: '9' },
        { code: 'console.log("" == 0);', answer: 'true' },
        { code: 'console.log(Boolean("false"));', answer: 'true' },
        { code: 'console.log([25, 100, 3].sort());', answer: ['[100, 25, 3]', '100, 25, 3'] },
      ].map((it) => ({ lang: 'js', label: 'Output', ...it })),
    },
    {
      id: 'total',
      group: 'js',
      type: 'js',
      min: 1,
      title: 'Sum of prices',
      text: 'Return the sum of all numbers in the array.',
      starter: 'function total(prices) {\n  \n}\n',
      tests: [
        ['total([10, 20, 5])', 35],
        ['total([87.5, 12.5])', 100],
        ['total([])', 0],
      ],
      solution: 'function total(prices) {\n  return prices.reduce((sum, p) => sum + p, 0);\n}',
    },
    {
      id: 'available',
      group: 'js',
      type: 'js',
      min: 2,
      title: 'Available artworks',
      text: 'Return the titles of the artworks that are in stock.',
      given: 'const artworks = [\n  { title: "Starry Night", stock: 2 },\n  { title: "The Kiss", stock: 0 },\n  { title: "Water Lilies", stock: 5 },\n];',
      starter: 'function available(list) {\n  \n}\n',
      tests: [
        ['available(artworks)', ['Starry Night', 'Water Lilies']],
        ['available([])', []],
        ['available([{ title: "Sold", stock: 0 }])', []],
      ],
      solution: 'function available(list) {\n  return list\n    .filter((art) => art.stock > 0)\n    .map((art) => art.title);\n}',
    },
    {
      id: 'count-words',
      group: 'js',
      type: 'js',
      min: 2,
      title: 'Count words',
      text: 'Return an object with how often each word appears. Upper and lower case count as the same word.',
      starter: 'function countWords(text) {\n  \n}\n',
      tests: [
        ['countWords("the cat and the hat")', { the: 2, cat: 1, and: 1, hat: 1 }],
        ['countWords("Art art ART")', { art: 3 }],
      ],
      solution: 'function countWords(text) {\n  const counts = {};\n  for (const word of text.toLowerCase().split(" ")) {\n    counts[word] = (counts[word] || 0) + 1;\n  }\n  return counts;\n}',
    },
    {
      id: 'dom-list',
      group: 'js',
      type: 'dom',
      min: 2,
      title: 'Update the list',
      text: 'Change the page with JavaScript only.',
      html: '<h2 id="title">Favorites</h2>\n<ul id="list">\n  <li>Starry Night</li>\n  <li>The Kiss</li>\n</ul>',
      base: '.active { color: #1a73e8; font-weight: 700; }\nh2 { margin: 0 0 8px; font-size: 20px; }',
      reqs: [
        [
          'A third item, Water Lilies, at the end of the list',
          (r) => { const li = qa(r, '#list > li'); return li.length === 3 && txt(li[2]) === 'Water Lilies'; },
        ],
        [
          'The first two items are unchanged',
          (r) => { const li = qa(r, '#list > li'); return txt(li[0]) === 'Starry Night' && txt(li[1]) === 'The Kiss'; },
        ],
        ['The first item has the class `active`', (r) => q(r, '#list > li')?.classList.contains('active')],
        ['The heading reads Favorites (3)', (r) => txt(q(r, '#title')) === 'Favorites (3)'],
      ],
      solution: `const list = document.querySelector("#list");

const li = document.createElement("li");
li.textContent = "Water Lilies";
list.append(li);

list.querySelector("li").classList.add("active");

const title = document.querySelector("#title");
title.textContent = \`Favorites (\${list.children.length})\`;`,
    },
    {
      id: 'like',
      group: 'js',
      type: 'dom',
      min: 2,
      title: 'Like button',
      html: '<button id="like">Like</button>\n<p>Likes: <span id="count">0</span></p>',
      reqs: [
        ['The counter starts at 0', (r) => txt(q(r, '#count')) === '0'],
        [
          'Each click adds 1',
          (r) => {
            const b = q(r, '#like');
            b.click();
            b.click();
            b.click();
            return txt(q(r, '#count')) === '3';
          },
        ],
        [
          'After 5 likes the button is disabled',
          (r) => {
            const b = q(r, '#like');
            b.click();
            b.click();
            const ok = txt(q(r, '#count')) === '5' && b.disabled;
            b.click();
            return ok && txt(q(r, '#count')) === '5';
          },
        ],
      ],
      solution: `const button = document.querySelector("#like");
const count = document.querySelector("#count");
let likes = 0;

button.addEventListener("click", () => {
  likes++;
  count.textContent = likes;
  if (likes === 5) button.disabled = true;
});`,
    },
    {
      id: 'greet',
      group: 'js',
      type: 'dom',
      min: 2,
      title: 'Greeting form',
      text: 'Handle the `submit` event of the form.',
      html: '<form id="greet">\n  <label for="name">Name</label>\n  <input id="name">\n  <button>Greet</button>\n</form>\n<p id="out"></p>',
      reqs: [
        ['Submitting does not reload the page', (r) => submitGreet(r, 'Ana').defaultPrevented],
        ['For Ana, `#out` shows Hello, Ana!', (r) => { submitGreet(r, 'Ana'); return txt(q(r, '#out')) === 'Hello, Ana!'; }],
        ['For an empty name, `#out` shows Please enter a name.', (r) => { submitGreet(r, ''); return txt(q(r, '#out')) === 'Please enter a name.'; }],
      ],
      solution: `const form = document.querySelector("#greet");
const out = document.querySelector("#out");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#name").value.trim();
  out.textContent = name ? \`Hello, \${name}!\` : "Please enter a name.";
});`,
    },
    {
      id: 'order',
      group: 'js',
      type: 'quiz',
      min: 1,
      title: 'In which order?',
      items: [
        {
          code: 'setTimeout(() => console.log("A"), 0);\nconsole.log("B");\nPromise.resolve().then(() => console.log("C"));\nsetTimeout(() => console.log("D"), 0);\nconsole.log("E");',
          label: 'Letters in the order they are logged',
          placeholder: 'e.g. A B C D E',
          answer: 'BECAD',
        },
        {
          code: 'async function run() {\n  console.log(1);\n  await null;\n  console.log(2);\n}\n\nrun();\nconsole.log(3);',
          label: 'Numbers in the order they are logged',
          placeholder: 'e.g. 1 2 3',
          answer: '132',
        },
      ].map((it) => ({ lang: 'js', norm: 'seq', ...it })),
    },
    {
      id: 'fetch',
      group: 'js',
      type: 'js',
      min: 2,
      title: 'Fetch a title',
      text: '`fetch("/api/artworks/1")` answers with `{ id, title, artist, year }`. Return the title, or `null` if the response is not ok.',
      starter: 'async function getTitle(id) {\n  \n}\n',
      tests: [
        ['await getTitle(1)', 'Starry Night'],
        ['await getTitle(2)', 'The Kiss'],
        ['await getTitle(42)', null],
      ],
      solution: 'async function getTitle(id) {\n  const res = await fetch(`/api/artworks/${id}`);\n  if (!res.ok) return null;\n  const art = await res.json();\n  return art.title;\n}',
    },
  ];

  function submitGreet(root, name) {
    q(root, '#name').value = name;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    q(root, '#greet').dispatchEvent(event);
    return event;
  }

  /* ----------------------------------------------------------------
     Editor: transparent textarea over highlighted code
     ---------------------------------------------------------------- */
  function editor({ lang, file, value, placeholder = '', onInput, onRun }) {
    const hl = h('pre', { class: `ed-hl lang-${lang}`, 'aria-hidden': 'true' });
    const ta = h('textarea', {
      class: 'ed-ta',
      rows: '7',
      spellcheck: 'false',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      placeholder,
      'aria-label': `Edit ${file}`,
      'aria-describedby': 'editor-help',
    });
    ta.value = value;

    const paint = () => {
      hl.innerHTML = `${highlight(ta.value, lang)}\n`;
    };
    const insert = (text) => {
      if (!document.execCommand('insertText', false, text)) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    };

    ta.addEventListener('input', () => {
      paint();
      onInput(ta.value);
    });
    ta.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onRun();
      } else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        insert('  ');
      } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
        const before = ta.value.slice(0, ta.selectionStart);
        const indent = before.slice(before.lastIndexOf('\n') + 1).match(/^ */)[0];
        e.preventDefault();
        insert(`\n${indent}${/[{[(]\s*$/.test(before) ? '  ' : ''}`);
      } else if (e.key === 'Escape') {
        ta.blur();
      }
    });

    paint();
    const el = h('div', { class: 'pane editor' }, h('div', { class: 'bar' }, h('span', { text: file })), h('div', { class: 'ed' }, hl, ta));
    return { el, get value() { return ta.value; } };
  }

  /* ----------------------------------------------------------------
     Requirement lists
     ---------------------------------------------------------------- */
  function reqList(reqs) {
    const items = reqs.map(([label]) => h('li', { html: rich(label) }, h('span', { class: 'sr-only' })));
    return {
      el: h('ul', { class: 'reqs' }, items),
      async evaluate(run) {
        const results = [];
        for (const [, fn] of reqs) {
          let ok = false;
          try {
            ok = Boolean(await run(fn));
          } catch {
            ok = false;
          }
          results.push(ok);
        }
        items.forEach((li, i) => {
          li.dataset.state = results[i] ? 'ok' : 'fail';
          li.lastChild.textContent = results[i] ? ' (met)' : ' (not met)';
        });
        const passed = results.filter(Boolean).length;
        const ok = passed === results.length;
        return { ok, msg: ok ? 'All requirements met' : `${passed} of ${results.length} requirements met` };
      },
    };
  }

  const normalize = (value, mode) => {
    const s = String(value).trim().toLowerCase();
    if (mode === 'seq') return s.replace(/[^a-z0-9]/g, '');
    return s.replace(/["'`\s;]/g, '').replace(/px$/, '');
  };
  const accepts = (item, value) =>
    value.trim() !== '' && [].concat(item.answer).some((a) => normalize(a, item.norm) === normalize(value, item.norm));

  /* ----------------------------------------------------------------
     Exercise types
     ---------------------------------------------------------------- */
  const TYPES = {
    html(ex, el, run) {
      const reqs = reqList(ex.reqs);
      const host = h('div');
      const root = mount(host, { base: HTML_BASE, inspect: ex.inspect || '' });
      const refresh = debounce(() => { root.innerHTML = ed.value; }, 150);
      const ed = editor({
        lang: 'html',
        file: 'index.html',
        value: answerOf(ex, ''),
        placeholder: 'Write the HTML here',
        onRun: run,
        onInput: (v) => { save(ex, v); refresh(); },
      });
      root.innerHTML = ed.value;
      el.append(
        reqs.el,
        h('div', { class: 'task-body' },
          h('div', { class: 'task-in' }, ed.el),
          h('div', { class: 'task-out' }, pane('Result', h('div', { class: 'view' }, host)))),
      );
      return {
        solutionLang: 'html',
        check() {
          const t = document.createElement('template');
          t.innerHTML = ed.value;
          return reqs.evaluate((fn) => fn(t.content));
        },
      };
    },

    css(ex, el, run) {
      const reqs = reqList(ex.reqs);
      const host = h('div');
      const root = mount(host, { html: ex.html, base: ex.base });
      const ed = editor({
        lang: 'css',
        file: 'style.css',
        value: answerOf(ex, ex.starter),
        placeholder: 'Write the CSS here',
        onRun: run,
        onInput: (v) => { save(ex, v); setCSS(root, v); },
      });
      setCSS(root, ed.value);
      el.append(
        reqs.el,
        h('div', { class: 'task-body' },
          h('div', { class: 'task-in' },
            codeBlock({ lang: 'html', code: ex.html }),
            codeBlock({ lang: 'css', file: 'base.css', code: ex.base }),
            ed.el),
          h('div', { class: 'task-out' }, pane('Result', h('div', { class: 'view' }, host)))),
      );
      return {
        solutionLang: 'css',
        check() {
          setCSS(root, ed.value);
          return reqs.evaluate((fn) => fn(root));
        },
      };
    },

    selector(ex, el, run) {
      const host = h('div');
      const layer = h('div', { class: 'hit-layer' });
      const view = h('div', { class: 'view' }, host, layer);
      const root = mount(host, { html: ex.html, base: SELECTOR_BASE });
      const input = h('input', {
        class: 'sel-input',
        type: 'text',
        value: answerOf(ex, ''),
        placeholder: 'selector',
        spellcheck: 'false',
        autocomplete: 'off',
        autocapitalize: 'off',
        'aria-label': `Selector: ${ex.title}`,
      });
      const count = h('span', { class: 'sel-count' });
      const draw = () => {
        const { els, error } = matchSelector(root, input.value);
        drawHits(view, layer, els);
        if (error) count.textContent = 'Invalid selector';
        else count.textContent = input.value.trim() ? `${els.length} ${els.length === 1 ? 'match' : 'matches'}` : '';
      };
      input.addEventListener('input', () => { save(ex, input.value); draw(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          run();
        }
      });
      el.append(
        h('div', { class: 'task-body' },
          h('div', { class: 'task-in' },
            codeBlock({ lang: 'html', code: ex.html }),
            h('div', { class: 'sel-row' }, input, h('span', { class: 'sel-brace', text: '{ }' }), count)),
          h('div', { class: 'task-out' }, pane('Result', view))),
      );
      new ResizeObserver(draw).observe(view);
      return {
        hint: '<kbd>Enter</kbd>',
        solutionLang: 'css',
        solution: `${ex.answer} { }`,
        check() {
          const { els, error } = matchSelector(root, input.value);
          if (error) return { ok: false, msg: 'Invalid selector' };
          const want = [...root.querySelectorAll(ex.answer)];
          const ok = els.length === want.length && want.every((x) => els.includes(x));
          let msg = 'Selects exactly the right elements';
          if (!ok) msg = els.length === want.length ? 'Right count, wrong elements' : `Selects ${els.length}, expected ${want.length}`;
          return { ok, msg };
        },
      };
    },

    quiz(ex, el, run) {
      const rows = ex.items.map((it, i) => {
        const input = h('input', {
          class: 'q-input',
          type: 'text',
          value: answerOf(ex, [])[i] || '',
          placeholder: it.placeholder || 'Answer',
          spellcheck: 'false',
          autocomplete: 'off',
          autocapitalize: 'off',
        });
        input.addEventListener('input', () => {
          const all = [...answerOf(ex, [])];
          all[i] = input.value;
          save(ex, all);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            run();
          }
        });
        const sol = h('span', { class: 'q-sol', hidden: true, text: [].concat(it.answer)[0] });
        const row = h('div', { class: 'q-row' },
          h('div', { class: 'q-code' }, it.html ? preCode(it.html, 'html') : null, preCode(it.code, it.lang)),
          h('label', { class: 'q-answer' }, h('span', { html: rich(it.label || 'Answer') }), input, sol));
        return { row, input, sol, it };
      });
      el.append(h('div', { class: 'quiz' }, rows.map((r) => r.row)));
      return {
        hint: '<kbd>Enter</kbd>',
        check() {
          let right = 0;
          for (const r of rows) {
            const ok = accepts(r.it, r.input.value);
            r.row.dataset.state = ok ? 'ok' : 'fail';
            right += ok ? 1 : 0;
          }
          return { ok: right === rows.length, msg: `${right} of ${rows.length} correct` };
        },
        toggleSolution(open) {
          rows.forEach((r) => { r.sol.hidden = !open; });
        },
      };
    },

    js(ex, el, run) {
      const ed = editor({
        lang: 'js',
        file: 'script.js',
        value: answerOf(ex, ex.starter),
        onRun: run,
        onInput: (v) => save(ex, v),
      });
      const tests = ex.tests.map(([call, expected]) => {
        const got = h('div', { class: 'test-got' });
        const li = h('li', {},
          h('div', {}, h('code', { html: highlight(call, 'js') }), h('span', { class: 'test-exp', text: `  returns ${fmt(expected, true)}` })),
          got);
        return { li, got, call, expected };
      });
      const lines = h('div', { class: 'console-lines' });
      const consolePane = pane('Console', lines);
      consolePane.hidden = true;
      el.append(
        h('div', { class: 'task-body' },
          h('div', { class: 'task-in' }, ex.given ? codeBlock({ lang: 'js', file: 'data.js', code: ex.given }) : null, ed.el),
          h('div', { class: 'task-out' }, pane('Tests', h('ul', { class: 'tests' }, tests.map((t) => t.li))), consolePane)),
      );
      return {
        solutionLang: 'js',
        async check() {
          lines.replaceChildren();
          consolePane.hidden = true;
          const cons = makeConsole(lines);
          let passed = 0;
          for (const t of tests) {
            let ok = false;
            let note = '';
            try {
              const fn = new AsyncFunction('fetch', 'console', `${ex.given || ''}\n${ed.value}\n;return (${t.call});`);
              const value = await withTimeout(fn((url) => fakeFetch(url, 40), cons), 3000);
              ok = deepEqual(value, t.expected);
              if (!ok) note = `got ${fmt(value, true)}`;
            } catch (err) {
              note = err && err.name ? `${err.name}: ${err.message}` : String(err);
            }
            t.li.dataset.state = ok ? 'ok' : 'fail';
            t.got.textContent = note;
            passed += ok ? 1 : 0;
          }
          return { ok: passed === tests.length, msg: `${passed} of ${tests.length} tests passed` };
        },
      };
    },

    dom(ex, el, run) {
      const reqs = reqList(ex.reqs);
      const ed = editor({
        lang: 'js',
        file: 'script.js',
        value: answerOf(ex, ''),
        placeholder: 'Write the JavaScript here',
        onRun: run,
        onInput: (v) => save(ex, v),
      });
      const view = h('div', { class: 'view' });
      const lines = h('div', { class: 'console-lines' });
      const consolePane = pane('Console', lines);
      const show = (code) => {
        const host = h('div');
        view.replaceChildren(host);
        const root = mount(host, { html: ex.html, base: ex.base || '' });
        lines.replaceChildren();
        consolePane.hidden = true;
        return code == null ? Promise.resolve(true) : runScript(code, { root, console: makeConsole(lines) });
      };
      show(null);
      el.append(
        reqs.el,
        h('div', { class: 'task-body' },
          h('div', { class: 'task-in' }, codeBlock({ lang: 'html', code: ex.html }), ed.el),
          h('div', { class: 'task-out' }, pane('Result', view), consolePane)),
      );
      return {
        solutionLang: 'js',
        async check() {
          const code = ed.value;
          /* Test on a hidden copy so the visible preview stays clean. */
          const host = h('div', { class: 'test-host', 'aria-hidden': 'true' });
          document.body.append(host);
          const root = mount(host, { html: ex.html, base: ex.base || '' }, false);
          await runScript(code, { root, console: makeConsole(null) });
          await new Promise((resolve) => setTimeout(resolve, 0));
          const result = await reqs.evaluate((fn) => fn(root));
          host.remove();
          const ran = await show(code);
          if (!ran) result.msg += '. script.js throws an error, see the console';
          return result;
        },
      };
    },
  };

  /* ----------------------------------------------------------------
     Rendering, progress, timer
     ---------------------------------------------------------------- */
  const painters = [];

  function refreshProgress() {
    const done = EXERCISES.filter((ex) => saved.solved[ex.id]).length;
    $$('[data-solved]').forEach((x) => { x.textContent = done; });
    $$('.ex-map a').forEach((a, i) => a.classList.toggle('is-solved', Boolean(saved.solved[EXERCISES[i].id])));
    painters.forEach((paint) => paint());
  }

  function renderTask(ex, n) {
    const el = h('article', { class: 'task', id: `ex-${n}`, 'aria-labelledby': `ex-${n}-title` });
    const state = h('span', { class: 'task-state' });
    el.append(h('header', { class: 'task-head' },
      h('span', { class: 'task-no', text: n, 'aria-hidden': 'true' }),
      h('h4', { id: `ex-${n}-title`, text: ex.title }),
      state));
    if (ex.text) el.append(h('p', { class: 'task-text', html: rich(ex.text) }));

    const ui = TYPES[ex.type](ex, el, () => check());
    const msg = h('span', { class: 'task-msg', 'aria-live': 'polite' });
    const checkBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Check', onclick: () => check() });
    const solBtn = h('button', { class: 'btn', type: 'button', text: 'Show solution', 'aria-expanded': 'false' });
    let solEl = null;

    solBtn.addEventListener('click', () => {
      const open = solBtn.getAttribute('aria-expanded') !== 'true';
      solBtn.setAttribute('aria-expanded', String(open));
      solBtn.textContent = open ? 'Hide solution' : 'Show solution';
      if (ui.toggleSolution) {
        ui.toggleSolution(open);
        return;
      }
      if (!solEl) {
        solEl = h('div', { class: 'task-solution' }, codeBlock({ lang: ui.solutionLang, file: 'Solution', code: ui.solution || ex.solution }));
        el.append(solEl);
      }
      solEl.hidden = !open;
    });

    el.append(h('div', { class: 'task-actions' },
      checkBtn,
      solBtn,
      msg,
      h('span', { class: 'hint', html: ui.hint || '<kbd>Ctrl</kbd> + <kbd>Enter</kbd>' })));

    async function check() {
      if (checkBtn.disabled) return;
      checkBtn.disabled = true;
      let result;
      try {
        result = await ui.check();
      } catch (err) {
        result = { ok: false, msg: String(err && err.message ? err.message : err) };
      }
      checkBtn.disabled = false;
      msg.textContent = result.msg;
      msg.className = `task-msg ${result.ok ? 'is-ok' : 'is-bad'}`;
      if (result.ok) saved.solved[ex.id] = true;
      else delete saved.solved[ex.id];
      persist();
      refreshProgress();
    }

    painters.push(() => {
      const solved = Boolean(saved.solved[ex.id]);
      el.classList.toggle('is-solved', solved);
      state.textContent = solved ? 'Solved' : '';
    });
    return el;
  }

  function render() {
    const map = $('.ex-map');
    EXERCISES.forEach((ex, i) => {
      const n = i + 1;
      $(`[data-group="${ex.group}"]`).append(renderTask(ex, n));
      map.append(h('li', {}, h('a', { href: `#ex-${n}`, text: n, title: ex.title, 'aria-label': `Exercise ${n}: ${ex.title}` })));
    });
    for (const group of ['html', 'css', 'js']) {
      const list = EXERCISES.map((ex, i) => ({ ex, n: i + 1 })).filter((x) => x.ex.group === group);
      const minutes = list.reduce((sum, x) => sum + x.ex.min, 0);
      $(`#ex-${group} .meta`).textContent = `Exercises ${list[0].n}–${list.at(-1).n}, about ${minutes} minutes`;
    }
    $$('[data-ex-count]').forEach((x) => { x.textContent = EXERCISES.length; });
    refreshProgress();
  }

  function initTimer() {
    const DURATION = 40 * 60;
    const time = $('.timer-time');
    const button = $('[data-timer]');
    let remaining = DURATION;
    let endAt = 0;
    let tick = null;

    const show = () => {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      time.textContent = `${m}:${String(s).padStart(2, '0')}`;
      time.classList.toggle('is-over', remaining === 0);
    };
    const stop = () => {
      clearInterval(tick);
      tick = null;
    };

    button.addEventListener('click', () => {
      if (tick) {
        stop();
        button.textContent = 'Resume';
        return;
      }
      if (remaining === 0) remaining = DURATION;
      endAt = Date.now() + remaining * 1000;
      button.textContent = 'Pause';
      tick = setInterval(() => {
        remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
        show();
        if (remaining === 0) {
          stop();
          button.textContent = 'Restart timer';
        }
      }, 250);
    });
    show();
  }

  $('[data-reset]').addEventListener('click', () => {
    if (!confirm('Delete all answers and progress saved in this browser?')) return;
    localStorage.removeItem(STORE);
    location.reload();
  });

  render();
  initTimer();
})();
