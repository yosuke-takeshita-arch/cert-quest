// 図（SVG）を画面に出す部品。決まりは要件定義書 §7-2、純粋な部分は lib/figures.js。
// SVG は外部の画像として読まず、文字として取ってから安全を確かめ、画面に取り込む（色を共通CSSの変数で付けるため）。
// 取り込むのは、アプリと一緒に配る自作の SVG だけ。innerHTML は使わない。
import { h, clear } from '../ui.js';
import { figureUrl, svgProblems, viewBoxWidth, scopeIds, FIGURE_MAX_VIEWBOX_WIDTH } from '../lib/figures.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ALLOWED = new Set(['svg', 'g', 'defs', 'title', 'desc', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'marker', 'pattern', 'clipPath', 'use']);

const texts = new Map(); // URL -> Promise<string>（同じ図を何度も取らない。失敗は覚えない）
let seq = 0;

function loadText(url) {
  if (!texts.has(url)) {
    const p = fetch(url).then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });
    p.catch(() => texts.delete(url));
    texts.set(url, p);
  }
  return texts.get(url);
}

/** SVG の文字列から、画面に入れる <svg> を作る。安全でなければ例外。 */
export function buildFigure(text) {
  const bad = svgProblems(text);
  if (bad.length) throw new Error('図が安全でない: ' + bad[0]);
  const w = viewBoxWidth(text);
  if (w == null || w > FIGURE_MAX_VIEWBOX_WIDTH) throw new Error('viewBox の幅が不正');
  const doc = new DOMParser().parseFromString(scopeIds(text, 'f' + ++seq), 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || root.namespaceURI !== SVG_NS || doc.getElementsByTagName('parsererror').length) throw new Error('SVG として読めない');
  for (const el of root.querySelectorAll('*')) {
    if (el.namespaceURI !== SVG_NS || !ALLOWED.has(el.localName)) throw new Error('使えない要素: ' + el.localName);
  }
  const svg = document.importNode(root, true);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', ('fig ' + (svg.getAttribute('class') || '')).trim());
  const t = svg.querySelector('title');
  return { svg, title: t ? t.textContent.trim() : '' };
}

function figureItem(app, id) {
  const box = h('figure', { class: 'fig-box', 'data-fig': id });
  const fill = () => {
    clear(box);
    box.appendChild(h('p', { class: 'fig-status small muted', role: 'status' }, '図を読み込み中…'));
    let url;
    try { url = figureUrl(app.dataBase, id); } catch (e) { return fail(); }
    loadText(url).then((text) => {
      const { svg, title } = buildFigure(text);
      clear(box);
      box.appendChild(svg);
      if (title) box.appendChild(h('figcaption', { class: 'fig-cap small muted', text: title }));
    }).catch(fail);
  };
  const fail = () => {
    clear(box);
    box.appendChild(h('p', { class: 'fig-status small muted', role: 'status' }, '図を読み込めませんでした。',
      h('button', { class: 'btn ghost fig-retry', type: 'button', onClick: fill }, 'もう一度')));
  };
  fill();
  return box;
}

/** カード・問題の figures（図の ID の配列）から、図のかたまりを作る。図が無ければ null。 */
export function figureBlock(app, ids, { heading = '図で見る', tag = 'div', className = '' } = {}) {
  if (!Array.isArray(ids) || !ids.length || !app.dataBase) return null;
  const wrap = h(tag, { class: ('fig-block ' + className).trim() }, h('h3', { text: heading }));
  for (const id of ids) wrap.appendChild(figureItem(app, id));
  return wrap;
}
