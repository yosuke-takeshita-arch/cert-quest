// 文中の基礎のことばに印を付ける部品（要件定義書 §7-5）。カードの一言・説明、問題の解説などの文を出すところが使う。
// 照合は lib/basics.js（DOM を使わない）。ここは、結果を画面の部品にするだけ。innerHTML は使わない（文字は必ず文字として入れる）。
// 押したときに開く窓は views/basics.js が setBasicOpener で教える（views/cards.js ⇄ views/basics.js が互いを読み込まないように、ここを間に置く）。
import { h } from '../ui.js';
import { segmentText } from '../lib/basics.js';

let opener = null;
/** 印を押したときに呼ぶ関数 (app, 基礎のことばの id) を教える。 */
export function setBasicOpener(fn) {
  opener = typeof fn === 'function' ? fn : null;
}

/** この画面で、文中の印を使えるか（基礎のことばがあり、開く窓が結ばれている）。 */
export function hasBasics(app) {
  return !!(opener && app && app.data && app.data.basicsMatcher && app.data.basicsMatcher.hasBasics);
}

/**
 * 文を、印つきの部品の並び（文字列と <button>）にする。h() の子どもにそのまま渡せる。
 * seen … 印を付けた語の id の集合。同じ区画（見出しひとつの下の文）で使い回すと、同じ語に印を付けるのは最初の1回だけになる。
 */
export function richText(app, text, seen) {
  const s = String(text == null ? '' : text);
  if (!hasBasics(app)) return [s];
  return segmentText(s, app.data.basicsMatcher, seen || new Set()).map((p) =>
    p.id
      ? h('button', { class: 'basic-term', type: 'button', 'data-basic': p.id, 'aria-haspopup': 'dialog', title: '基礎のことば：意味を見る', onClick: () => opener(app, p.id) }, p.text)
      : p.text);
}

/**
 * 文ひとつぶんの要素。印を付ける語が無い（または基礎のことばが無いアプリ）なら、これまでと同じ text 指定の要素になる。
 * props に text は入れない。
 */
export function richEl(app, tag, props, text, seen) {
  const s = String(text == null ? '' : text);
  if (!hasBasics(app)) return h(tag, { ...props, text: s });
  const parts = richText(app, s, seen);
  return parts.some((p) => typeof p !== 'string') ? h(tag, props, parts) : h(tag, { ...props, text: s });
}
