// 「あとで見る」: 印を付けた問題の一覧と、解かずに読む画面（要件定義書 §3-4）。数え方・並べ方は lib/later.js。
import { h } from '../ui.js';
import { laterItems } from '../lib/later.js';
import { startSession } from './play.js';
import { explanation, laterButton, stemPlainBlock, CHOICE_LABELS } from './explain.js';
import { openCardSheet, statusChip } from './cards.js';

export const LATER_SOLVE_MAX = 20;
const STEM_PREVIEW = 40;

/** 問題文の最初の部分（改行は空白にして、長ければ「…」で切る）。 */
export function stemPreview(stem, n = STEM_PREVIEW) {
  const s = String(stem || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function chapterOf(q) {
  return q.syllabus.slice(1, 3).join(' › ') || q.syllabus[0];
}

function dayLabel(at) {
  const d = new Date(at);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日に印';
}

function laterSpec(app) {
  return {
    mode: 'later',
    title: 'あとで見る',
    small: true, // 章の星は付けない
    backHash: '#/later',
    pick: (a) => laterItems(a.state, a.data.questions, 'chapter').map((x) => x.q).slice(0, LATER_SOLVE_MAX),
  };
}

let sortOrder = 'recent'; // 画面を出入りしても、選んだ並べ方を覚えておく（起動の間だけ）

export function renderLater(app, id) {
  return id ? renderLaterOne(app, id) : renderLaterList(app);
}

function renderLaterList(app) {
  const root = h('section', { class: 'view later' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: 'あとで見る' }));
  const items = laterItems(app.state, app.data.questions, sortOrder);
  if (!items.length) {
    root.appendChild(h('div', { class: 'card empty', 'data-later-empty': '1' },
      h('p', { text: '「あとで見る」の問題はまだありません。' }),
      h('p', { class: 'small muted', text: '問題の画面と、答えたあとの解説の画面にある「あとで見る」ボタンを押すと、ここに集まります。ゆっくり理解したい問題に印を付けてください。' })));
    return root;
  }
  root.appendChild(h('p', { class: 'small muted', text: '印を付けた問題は ' + items.length + ' 問です。問題を押すと、解かずに解説まで読めます。' }));
  root.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-later-solve': '1', onClick: () => startSession(app, laterSpec(app)) },
    '印を付けた問題だけを解く' + (items.length > LATER_SOLVE_MAX ? '（まず' + LATER_SOLVE_MAX + '問）' : '')));
  const sw = h('div', { class: 'map-switch', role: 'group', 'aria-label': '並べ方' });
  for (const [key, label] of [['recent', '印を付けた順'], ['chapter', '章の順']]) {
    sw.appendChild(h('button', { class: 'map-switch-btn' + (sortOrder === key ? ' on' : ''), type: 'button', 'data-later-sort': key, 'aria-pressed': String(sortOrder === key), onClick: () => {
      sortOrder = key;
      app.go('#/later');
    } }, label));
  }
  root.appendChild(sw);
  const list = h('div', { class: 'card later-list' });
  for (const { q, at } of items) {
    list.appendChild(h('button', { class: 'later-item', type: 'button', 'data-later-item': q.id, onClick: () => app.go('#/later/' + encodeURIComponent(q.id)) },
      h('span', { class: 'small muted', text: chapterOf(q) + '・' + dayLabel(at) }),
      h('span', { class: 'later-stem', text: stemPreview(q.stem) })));
  }
  root.appendChild(list);
  return root;
}

/** 解かずに読む画面。選択肢の並びは元のまま、正解に印を付けて見せる。 */
function renderLaterOne(app, id) {
  const q = app.data.questionById.get(id);
  const root = h('section', { class: 'view later-one' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/later') }, '← あとで見る'));
  if (!q) {
    // データから消えた問題。一覧には出さないが、古い URL で来たときはここで案内する
    root.appendChild(h('div', { class: 'card empty' }, h('p', { text: 'この問題は見つかりませんでした。' })));
    return root;
  }
  const sq = {
    q,
    perm: q.choices.map((_, i) => i),
    choices: q.choices,
    answer: q.answer,
    whyWrong: q.choices.map((_, i) => (q.whyWrong && q.whyWrong[i] !== undefined ? q.whyWrong[i] : null)),
  };
  const open = (cid) => openCardSheet(app, cid);
  const card = h('div', { class: 'card q-card' });
  const tags = h('div', { class: 'q-tags' }, h('span', { class: 'chip', text: chapterOf(q) }), statusChip(q.status));
  if (q.format === 'not') tags.appendChild(h('span', { class: 'chip warn', text: '適切でないものを選ぶ' }));
  if (q.format === 'scenario') tags.appendChild(h('span', { class: 'chip', text: '場面問題' }));
  card.appendChild(tags);
  card.appendChild(h('p', { class: 'stem', text: q.stem }));
  const ul = h('ul', { class: 'read-choices' });
  q.choices.forEach((c, i) => {
    const right = i === q.answer;
    ul.appendChild(h('li', { class: 'read-choice' + (right ? ' ok' : '') },
      h('span', { class: 'mark', 'aria-hidden': 'true', text: right ? '✓' : CHOICE_LABELS[i] }),
      h('span', { class: 'ctext', text: c }),
      right ? h('span', { class: 'chip', text: '正解' }) : null));
  });
  card.appendChild(ul);
  card.appendChild(h('div', { class: 'later-row' }, laterButton(app, q)));
  root.appendChild(card);
  const meaning = stemPlainBlock(q);
  if (meaning) root.appendChild(meaning);
  root.appendChild(explanation(app, sq, null, open, { sensei: false, later: false }));
  root.appendChild(h('button', { class: 'btn big', type: 'button', onClick: () => app.go('#/later') }, '一覧にもどる'));
  return root;
}
