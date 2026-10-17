// 基礎のことば（次元・パラメータのような、試験範囲の外にある土台の言葉）の画面。決まりは要件定義書 §7-5。
//   一覧（#/basics）・1語のカード（#/basic/<id>）・文中の印を押したときに下から出る窓（openBasicSheet）・カード一覧の入口（basicsEntry）。
// 試験範囲の外なので、地図・問題・模試・進み具合には入れない。データは app.data.basics（lib/basics.js）。
import { h, clear, openSheet } from '../ui.js';
import { resolveRef } from '../lib/data.js';
import { fold } from '../lib/basics.js';
import { figureBlock } from './figure.js';
import { openCardSheet } from './cards.js';
import { richEl, setBasicOpener } from './richtext.js';

const itemsOf = (app) => (app && app.data && Array.isArray(app.data.basics) ? app.data.basics : []);
const basicOf = (app, id) => itemsOf(app).find((b) => b.id === id) || null;
// 問題を解いている途中の画面（ここから別の画面へ移ると、解いている最中の問題が消える）
const inGame = () => /^#\/(play|exam|dochi|boss)(\/|$)/.test(location.hash);

/** 試験範囲のカードへのボタンの並び。解決できないカードは出さない（検査が止める）。 */
function relatedChips(app, b, open) {
  const cards = [];
  for (const id of b.related) {
    const r = resolveRef(id, app.data.conceptIndex);
    if (r.concept && !cards.includes(r.concept)) cards.push(r.concept);
  }
  if (!cards.length) return null;
  const row = h('div', { class: 'chips' });
  for (const c of cards) row.appendChild(h('button', { class: 'chip link', type: 'button', onClick: () => open(c.id) }, c.title));
  return h('div', { class: 'tie basic-related' }, h('h3', { text: 'つながる試験範囲のカード' }), row);
}

/** 1語ぶんの中身（一言・説明・図・つながる試験範囲のカード）。open(id) で、つながるカードを開く。 */
export function basicBody(app, b, open) {
  const seen = new Set([b.id]); // 自分の語には印を付けない。一言と説明は続けて読むので1区画
  const wrap = h('article', { class: 'card concept basic', 'data-basic-card': b.id });
  wrap.appendChild(h('p', { class: 'crumb small muted', text: '基礎のことば（試験範囲の外の、土台の言葉）' }));
  wrap.appendChild(h('h2', { text: b.term }));
  if (b.aliases.length) wrap.appendChild(h('p', { class: 'small muted', text: 'ほかの呼び方: ' + b.aliases.join('・') }));
  if (b.oneLine) wrap.appendChild(richEl(app, 'p', { class: 'one-line' }, b.oneLine, seen));
  const fig = figureBlock(app, b.figures);
  if (fig) wrap.appendChild(fig);
  if (b.why) wrap.appendChild(h('div', { class: 'why' }, h('h3', { text: 'くわしく' }), richEl(app, 'p', {}, b.why, seen)));
  const rel = relatedChips(app, b, open);
  if (rel) wrap.appendChild(rel);
  return wrap;
}

// ---- 下から出る窓（文中の印を押したとき） ----
/** 印を押したときの小さな窓。一言と説明を出し、図・つながりがあれば『図とつながりも見る』で同じ窓の中で全体を出す。 */
export function openBasicSheet(app, id) {
  const b = basicOf(app, id);
  if (!b) return null;
  return openSheet((body, close) => {
    const toCard = (cid) => openCardSheet(app, cid);
    const compact = () => {
      clear(body);
      const seen = new Set([b.id]);
      const art = h('article', { class: 'card concept basic basic-compact', 'data-basic-card': b.id },
        h('p', { class: 'crumb small muted', text: '基礎のことば' }),
        h('h2', { text: b.term }),
        b.oneLine ? richEl(app, 'p', { class: 'one-line' }, b.oneLine, seen) : null,
        b.why ? richEl(app, 'p', {}, b.why, seen) : null);
      body.appendChild(art);
      const row = h('div', { class: 'basic-actions' });
      if (b.figures.length || b.related.length) {
        row.appendChild(h('button', { class: 'btn', type: 'button', 'data-act': 'full', onClick: () => { clear(body); body.appendChild(basicBody(app, b, toCard)); body.appendChild(h('div', { class: 'basic-actions' }, listLink())); body.scrollTop = 0; } }, '図とつながりも見る'));
      }
      const l = listLink();
      if (l) row.appendChild(l);
      if (row.childNodes.length) body.appendChild(row);
      body.scrollTop = 0;
    };
    // 問題を解いている途中は、別の画面へ移らない（解いている問題が消える）。一覧への道は出さない
    const listLink = () => (inGame() ? null : h('button', { class: 'btn ghost', type: 'button', 'data-act': 'list', onClick: () => { close(); app.go('#/basic/' + encodeURIComponent(b.id)); } }, '基礎のことばのカードを開く'));
    compact();
  }, { label: '基礎のことば：' + b.term });
}

// ---- 一覧・1語 ----
export function renderBasicList(app) {
  const items = itemsOf(app);
  const root = h('section', { class: 'view' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => history.back() }, '← 戻る'));
  root.appendChild(h('h1', { text: '基礎のことば' }));
  if (!items.length) {
    root.appendChild(h('div', { class: 'empty' }, h('p', { text: '基礎のことばは準備中です。' })));
    return root;
  }
  root.appendChild(h('p', { class: 'small muted', text: '次元・パラメータのような、試験には出ないけれど、カードや解説を読むために知っておきたい土台の言葉です。カードや解説の中で下線のついた言葉を押しても、ここと同じ説明が開きます。' }));
  const input = h('input', { type: 'search', class: 'search', placeholder: '言葉を検索（例: 次元）', 'aria-label': '基礎のことばを検索' });
  const list = h('div', { class: 'card-groups basic-list' });
  root.appendChild(input);
  root.appendChild(list);
  const draw = () => {
    clear(list);
    const kw = fold(input.value).trim();
    const hit = items.filter((b) => !kw || fold([b.term, ...b.aliases, b.oneLine].join(' ')).includes(kw));
    if (!hit.length) {
      list.appendChild(h('p', { class: 'empty small', text: '「' + input.value + '」に合う言葉はありません。' }));
      return;
    }
    for (const b of hit) {
      list.appendChild(h('button', { class: 'row-btn', type: 'button', 'data-basic-row': b.id, onClick: () => app.go('#/basic/' + encodeURIComponent(b.id)) },
        h('span', { class: 'row-main' }, h('strong', { text: b.term }), b.oneLine ? h('span', { class: 'small muted', text: b.oneLine }) : null)));
    }
  };
  input.addEventListener('input', draw);
  draw();
  return root;
}

export function renderBasic(app, id) {
  const b = basicOf(app, id);
  const root = h('section', { class: 'view' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => history.back() }, '← 戻る'));
  if (!b) {
    root.appendChild(h('div', { class: 'empty' }, h('p', { text: 'この言葉は見つかりません。' })));
    return root;
  }
  root.appendChild(basicBody(app, b, (cid) => app.go('#/card/' + encodeURIComponent(cid))));
  return root;
}

// カード一覧の先頭の入口は views/cards.js が出す（cards.js ⇄ basics.js が互いを読み込まないため）。
setBasicOpener(openBasicSheet);
