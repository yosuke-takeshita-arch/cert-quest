// 解説4点セットと、間違えたときの「つまずきポイント」。問題画面と模試の見直しで共通に使う。
import { h, characterImg, tappable } from '../ui.js';
import { resolveRef } from '../lib/data.js';
import { refChip, sourcesList } from './cards.js';
import { figureBlock } from './figure.js';
import { reportButton } from './report.js';
import { explainSensei, TIP_SENSEI } from '../lib/characters.js';

export const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** 問題に紐づく用語カード（解決できたものだけ）。 */
export function conceptsOf(app, q) {
  const out = [];
  for (const x of q.concepts) {
    const r = resolveRef(x, app.data.conceptIndex);
    if (r.concept && !out.includes(r.concept)) out.push(r.concept);
  }
  return out;
}

/** 問題文の意味（要件定義書 §7-3）。stemPlain が無い問題は null。解説と『まず用語を確認しよう』より前に、呼ぶ側が置く（問題の意味が分かってから用語を見る順）。 */
export function stemPlainBlock(q) {
  if (!q.stemPlain) return null;
  return h('section', { class: 'ex-block stem-plain' }, h('h3', { text: '問題文の意味' }), h('p', { text: q.stemPlain }));
}

/** 間違えた直後に、解説より先に見せる: その問題の用語カードと、混同しやすい相手。 */
export function stumbleBlock(app, q, open) {
  const cs = conceptsOf(app, q);
  if (!cs.length) return null;
  const box = h('section', { class: 'stumble', 'aria-label': 'つまずきポイント' }, h('h3', { text: 'まず用語を確認しよう' }));
  for (const c of cs) {
    const item = h('div', { class: 'stumble-item' }, h('p', {}, h('button', { class: 'chip link', type: 'button', onClick: () => open(c.id) }, c.title), ' ', h('span', { text: c.oneLine })));
    if (c.confusions.length) {
      const ul = h('ul', { class: 'conf-list' });
      for (const f of c.confusions) {
        const r = resolveRef(f, app.data.conceptIndex);
        ul.appendChild(h('li', {}, h('span', { class: 'small muted', text: '混同しやすい: ' }), refChip(app, f, open), r.point ? h('span', { class: 'point', text: ' ' + r.point }) : null));
      }
      item.appendChild(ul);
    }
    box.appendChild(item);
  }
  return box;
}

/**
 * 解説4点セット。sq は shuffleChoices の結果、chosen は選んだ位置（時間切れ・未回答は null）。
 * opts.sensei=false なら先生の絵を出さない（同じ画面に別のキャラクターがいるとき・結果の見直しの一覧のとき。1画面に1人まで）。
 */
export function explanation(app, sq, chosen, open, opts = {}) {
  const q = sq.q;
  const sensei = opts.sensei !== false;
  const box = h('div', { class: 'explain' });
  box.appendChild(h('section', { class: 'ex-block' }, h('h3', {}, h('span', { class: 'num', 'aria-hidden': 'true' }, '1'), '正解の理由', sensei ? tappable(characterImg(explainSensei(chosen !== null && chosen === sq.answer), 'sensei-mini')) : null),
    h('p', { class: 'ex-answer' }, h('strong', { text: '正解: ' + CHOICE_LABELS[sq.answer] + '. ' + sq.choices[sq.answer] })),
    h('p', { text: q.explanation || '（解説は準備中です）' })));
  const fig = figureBlock(app, q.figures, { heading: '図で確かめる', tag: 'section', className: 'ex-block' });
  if (fig) box.appendChild(fig);

  const wrongs = sq.choices.map((c, i) => ({ c, i, why: sq.whyWrong[i] })).filter((x) => x.i !== sq.answer);
  const ul = h('ul', { class: 'why-wrong' });
  for (const w of wrongs) {
    ul.appendChild(h('li', { class: w.i === chosen ? 'chosen' : '' },
      h('span', { class: 'lbl', text: CHOICE_LABELS[w.i] + '. ' + w.c }),
      h('span', { class: 'why', text: w.why || '（理由は準備中です）' }),
      w.i === chosen ? h('span', { class: 'chip you' }, 'あなたの回答') : null));
  }
  // 「適切でないもの」を選ぶ問題では、ほかの選択肢は正しい文なので「誤答」と呼ばない
  const othersHeading = q.format === 'not' ? 'ほかの選択肢がなぜ答えにならないか' : '誤答がなぜ違うか';
  box.appendChild(h('section', { class: 'ex-block' }, h('h3', {}, h('span', { class: 'num', 'aria-hidden': 'true' }, '2'), othersHeading), ul));

  if (q.memoryTip) box.appendChild(h('section', { class: 'ex-block tip' }, h('h3', {}, h('span', { class: 'num', 'aria-hidden': 'true' }, '3'), '覚え方', sensei ? tappable(characterImg(TIP_SENSEI, 'sensei-mini')) : null), h('p', { text: q.memoryTip })));

  const cs = conceptsOf(app, q);
  const unresolved = q.concepts.filter((x) => !resolveRef(x, app.data.conceptIndex).concept);
  if (cs.length || unresolved.length) {
    const row = h('div', { class: 'chips' });
    for (const c of cs) row.appendChild(h('button', { class: 'chip link', type: 'button', onClick: () => open(c.id) }, c.title));
    for (const x of unresolved) row.appendChild(refChip(app, x, null));
    box.appendChild(h('section', { class: 'ex-block' }, h('h3', {}, h('span', { class: 'num', 'aria-hidden': 'true' }, '4'), '関連する用語カード'), row));
  }
  const src = sourcesList(q.sources);
  if (src) box.appendChild(src);
  const rep = reportButton(app, { kind: 'question', id: q.id, text: q.stem });
  if (rep) box.appendChild(rep);
  return box;
}
