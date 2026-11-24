// カードめくり（要件定義書 §3-4-c）。題名だけを見て頭の中で答え、めくって確かめる。数え方・並べ方は lib/flip.js。
import { h, clear } from '../ui.js';
import { flipDeck, flipCounts, markFlip, sectionCards, flipWeakSections, FLIP_MAX } from '../lib/flip.js';
import { laterCardItems } from '../lib/later.js';
import { cardSections } from '../lib/cardtree.js';
import { statsByKey, WEAK_BELOW } from '../lib/weakness.js';
import { openCardSheet } from './cards.js';
import { richEl } from './richtext.js';
import { basicIdsOfTitle } from '../lib/basics.js';

const openKeys = new Set(); // 範囲の一覧で開いた節（画面を出入りしても覚えておく。起動の間だけ）

/** 範囲 { key, name, cards } を key から作る。'all'・'later'・'s:<節の key>'。無ければ null。 */
export function flipScope(app, key) {
  const all = app.data.concepts;
  if (key === 'all') return { key, name: '全部', cards: all };
  if (key === 'later') return { key, name: 'あとで見るのカード', cards: laterCardItems(app.state, all, 'chapter').map((x) => x.c) };
  if (typeof key === 'string' && key.startsWith('s:')) {
    const want = key.slice(2);
    const find = (list) => {
      for (const s of list) {
        if (s.key === want) return s;
        const r = find(s.children || []);
        if (r) return r;
      }
      return null;
    };
    const sec = find(cardSections(app.data.tree, all));
    if (sec) return { key, name: sec.name, cards: sectionCards(sec) };
  }
  return null;
}

/** #/flip（範囲を選ぶ）・#/flip/<範囲の key>（その範囲で始める。#/later のカードの一覧からは 'later'）。 */
export function renderFlip(app, key) {
  const root = h('section', { class: 'view flip' });
  const start = key ? flipScope(app, key) : null;
  if (start && start.cards.length) drawRound(app, root, start, flipDeck(app.state, start.cards));
  else drawPicker(app, root);
  return root;
}

/** 範囲の1行。押すとその範囲でめくり始める。stat があれば正答率を添える。 */
function scopeRow(app, root, scope, label, stat) {
  const n = scope.cards.length;
  const cnt = flipCounts(app.state, scope.cards);
  const weak = !!(stat && stat.qualified && stat.rate < WEAK_BELOW);
  const sub = [n ? n + '枚（覚えた ' + cnt.ok + '・まだ ' + cnt.ng + '・めくっていない ' + cnt.fresh + '）' : 'カードがありません'];
  return h('button', { class: 'row-btn', type: 'button', 'data-flip-scope': scope.key, disabled: n ? null : true, onClick: () => drawRound(app, root, scope, flipDeck(app.state, scope.cards)) },
    h('span', { class: 'row-main' },
      h('strong', { text: label || scope.name }),
      h('span', { class: 'small muted', text: sub[0] }),
      stat && stat.qualified ? h('span', { class: 'small flip-rate' + (weak ? ' weak' : ''), 'data-flip-rate': String(stat.percent), text: '問題の正答率 ' + stat.percent + '%' + (weak ? '・苦手' : '') }) : null),
    h('span', { class: 'basics-entry-arrow', 'aria-hidden': 'true', text: n ? '›' : '' }));
}

/** 開け閉めできる節。中に「この◯◯を全部」と、下の節の行が並ぶ。 */
function sectionBlock(app, root, sec, depth, rates) {
  const det = h('details', { class: depth === 0 ? 'major card-major' : 'card-sub', 'data-flip-sec': sec.key, open: openKeys.has(sec.key) ? true : null });
  const st = depth >= 1 ? rates.get(sec.key) : null;
  const weak = !!(st && st.qualified && st.rate < WEAK_BELOW);
  det.appendChild(h('summary', {}, h('span', { class: 'sum-name', text: sec.name }), h('span', { class: 'small muted', text: sec.count + '枚' + (weak ? '・苦手' : '') })));
  det.addEventListener('toggle', () => (det.open ? openKeys.add(sec.key) : openKeys.delete(sec.key)));
  const inner = h('div', { class: 'card-tree-inner' });
  inner.appendChild(scopeRow(app, root, { key: 's:' + sec.key, name: sec.name, cards: sectionCards(sec) }, depth === 0 ? 'この分野を全部' : 'この中項目を全部', st));
  for (const ch of sec.children) {
    if (ch.children.length) inner.appendChild(sectionBlock(app, root, ch, depth + 1, rates));
    else inner.appendChild(scopeRow(app, root, { key: 's:' + ch.key, name: ch.name, cards: sectionCards(ch) }, null, rates.get(ch.key)));
  }
  det.appendChild(inner);
  return det;
}

function drawPicker(app, root) {
  clear(root);
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/cards') }, '← 用語カード'));
  root.appendChild(h('h1', { text: 'カードめくり' }));
  root.appendChild(h('p', { class: 'small muted', text: '用語の名前だけを見て、意味を頭の中で答えてから、めくって確かめます。「まだ」にしたカードは、次に先に出ます。1回に' + FLIP_MAX + '枚までです。' }));
  const secs = cardSections(app.data.tree, app.data.concepts);
  const rates = statsByKey(app.data.tree, app.state.qstats);

  // 苦手な分野から（問題の正答率が低い中項目・小項目）
  const weak = flipWeakSections(secs, rates, WEAK_BELOW);
  const wbox = h('div', { class: 'card', 'data-flip-weak': String(weak.length) }, h('h2', { text: '苦手な分野から' }));
  if (weak.length) {
    for (const { sec, stat } of weak) wbox.appendChild(scopeRow(app, root, { key: 's:' + sec.key, name: sec.name, cards: sectionCards(sec) }, null, stat));
  } else wbox.appendChild(h('p', { class: 'small muted', 'data-flip-weak-none': '1', text: '問題を解くと、正答率の低い分野がここに出ます（1つの分野で5問以上答えると出ます）。' }));
  root.appendChild(wbox);

  const top = h('div', { class: 'card' });
  for (const k of ['all', 'later']) top.appendChild(scopeRow(app, root, flipScope(app, k)));
  root.appendChild(top);
  for (const s of secs) root.appendChild(sectionBlock(app, root, s, 0, rates));
}

/** 1回分（deck）をめくる。終わったら結果を出す。 */
function drawRound(app, root, scope, deck) {
  let i = 0;
  const ok = [];
  const ng = [];
  const back = () => drawPicker(app, root);
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
