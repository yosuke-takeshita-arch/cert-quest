// カードめくり（要件定義書 §3-4-c）。題名だけを見て頭の中で答え、めくって確かめる。数え方・並べ方は lib/flip.js。
import { h, clear } from '../ui.js';
import { flipDeck, flipCounts, flipMajors, markFlip, FLIP_MAX } from '../lib/flip.js';
import { laterCardItems } from '../lib/later.js';
import { openCardSheet } from './cards.js';
import { richEl } from './richtext.js';
import { basicIdsOfTitle } from '../lib/basics.js';

/** 選べる範囲。0枚の範囲も返す（画面で押せなくする）。 */
export function flipScopes(app) {
  const all = app.data.concepts;
  const later = laterCardItems(app.state, all, 'chapter').map((x) => x.c);
  return [
    { key: 'all', name: '全部', cards: all },
    { key: 'later', name: 'あとで見るのカード', cards: later },
    ...flipMajors(all).map((m, i) => ({ key: 'm' + i, name: m.name, cards: m.cards })),
  ];
}

/** 範囲の選び方。key に合う範囲から始める（#/later のカードの一覧からは 'later'）。 */
export function renderFlip(app, key) {
  const root = h('section', { class: 'view flip' });
  const scopes = flipScopes(app);
  const start = scopes.find((s) => s.key === key && s.cards.length);
  if (start) drawRound(app, root, start, flipDeck(app.state, start.cards));
  else drawPicker(app, root, scopes);
  return root;
}

function drawPicker(app, root, scopes) {
  clear(root);
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/cards') }, '← 用語カード'));
  root.appendChild(h('h1', { text: 'カードめくり' }));
  root.appendChild(h('p', { class: 'small muted', text: '用語の名前だけを見て、意味を頭の中で答えてから、めくって確かめます。「まだ」にしたカードは、次に先に出ます。1回に' + FLIP_MAX + '枚までです。' }));
  const list = h('div', { class: 'card' });
  for (const s of scopes) {
    const n = s.cards.length;
    const cnt = flipCounts(app.state, s.cards);
    list.appendChild(h('button', { class: 'row-btn', type: 'button', 'data-flip-scope': s.key, disabled: n ? null : true, onClick: () => drawRound(app, root, s, flipDeck(app.state, s.cards)) },
      h('span', { class: 'row-main' },
        h('strong', { text: s.name }),
        h('span', { class: 'small muted', text: n ? n + '枚（覚えた ' + cnt.ok + '・まだ ' + cnt.ng + '・めくっていない ' + cnt.fresh + '）' : 'カードがありません' })),
      h('span', { class: 'basics-entry-arrow', 'aria-hidden': 'true', text: n ? '›' : '' })));
  }
  root.appendChild(list);
}

/** 1回分（deck）をめくる。終わったら結果を出す。 */
function drawRound(app, root, scope, deck) {
  let i = 0;
  const ok = [];
  const ng = [];
  const back = () => drawPicker(app, root, flipScopes(app));
  const draw = (opened) => {
    clear(root);
    window.scrollTo(0, 0);
    root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: back }, '← 範囲をえらぶ'));
    if (i >= deck.length) return drawResult();
    const c = deck[i];
    root.appendChild(h('p', { class: 'small muted', 'data-flip-progress': '1', text: scope.name + '・' + (i + 1) + ' / ' + deck.length + ' 枚' }));
    const card = h('article', { class: 'card flip-card', 'data-flip-card': c.id },
      h('p', { class: 'crumb small muted', text: c.syllabus.join(' › ') }),
      h('h2', { class: 'flip-title', text: c.title }));
    if (opened) {
      card.appendChild(c.oneLine ? richEl(app, 'p', { class: 'one-line' }, c.oneLine, basicIdsOfTitle(app.data.basicsMatcher, c.title)) : h('p', { class: 'muted', text: '（一言の説明がありません）' }));
      card.appendChild(h('button', { class: 'btn small-btn', type: 'button', 'data-flip-read': '1', onClick: () => openCardSheet(app, c.id) }, 'カードを全部読む'));
    } else card.appendChild(h('p', { class: 'small muted', text: '意味を頭の中で答えてから、めくってください。' }));
    root.appendChild(card);
    if (!opened) {
      root.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-flip-open': '1', onClick: () => draw(true) }, 'めくる'));
      return;
    }
    const pick = (yes) => {
      markFlip(app.state, c.id, yes);
      app.commit();
      (yes ? ok : ng).push(c);
      i++;
      draw(false);
    };
    root.appendChild(h('div', { class: 'btn-row' },
      h('button', { class: 'btn big', type: 'button', 'data-flip-ng': '1', onClick: () => pick(false) }, 'まだ'),
      h('button', { class: 'btn primary big', type: 'button', 'data-flip-ok': '1', onClick: () => pick(true) }, '覚えた')));
  };
  const drawResult = () => {
    root.appendChild(h('h1', { text: 'おつかれさまでした' }));
    root.appendChild(h('div', { class: 'card', 'data-flip-result': '1' },
      h('p', { class: 'one-line', text: '覚えた ' + ok.length + ' 枚・まだ ' + ng.length + ' 枚' }),
      ng.length ? h('p', { class: 'small muted', text: '「まだ」のカード: ' + ng.map((c) => c.title).join('、') }) : null));
    if (ng.length) root.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-flip-again': '1', onClick: () => drawRound(app, root, scope, ng.slice()) }, 'まだのカードだけもう一度'));
    root.appendChild(h('button', { class: 'btn big', type: 'button', 'data-flip-next': '1', onClick: () => drawRound(app, root, scope, flipDeck(app.state, scope.cards)) }, 'この範囲の次の' + Math.min(FLIP_MAX, scope.cards.length) + '枚'));
    root.appendChild(h('button', { class: 'btn big', type: 'button', onClick: back }, '範囲をえらぶ'));
  };
  draw(false);
}
