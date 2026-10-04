// 苦手の分析の画面。計算は lib/weakness.js。ここは並べて見せるだけ。
import { h, mascotLine } from '../ui.js';
import { analyze, WEAK_MIN_ANSWERED, WEAK_BELOW } from '../lib/weakness.js';
import { weakMascot } from '../lib/characters.js';
import { startSession } from './play.js';
import { weakSpec } from './home.js';

function crumb(stat) {
  const p = stat.unit.path;
  const c = p.length >= 3 ? p[1] : p[0];
  // 章と小項目が同じ名前のとき（例: 「AI に必要な数理・統計知識」）は、同じ言葉を2行並べず、分野の名前を出す
  return c === stat.unit.name ? p[0] : c;
}

function bar(stat, ok) {
  return h('div', { class: 'progress weak-bar' + (ok ? ' ok' : ''), role: 'progressbar', 'aria-label': stat.unit.name + ' の正答率', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(stat.percent) },
    h('div', { class: 'progress-fill', style: { width: stat.percent + '%' } }));
}

function row(app, stat, kind) {
  const solve = (label) => h('button', { class: 'btn small-btn', type: 'button', 'data-weak-solve': stat.unit.key, 'aria-label': stat.unit.name + ' を解く', onClick: () => startSession(app, weakSpec(app, stat.unit, '#/weak')) }, label);
  if (kind === 'untouched') {
    return h('div', { class: 'weak-row untouched', 'data-weak-row': 'untouched' },
      h('span', { class: 'row-main' }, h('strong', { text: stat.unit.name }), h('span', { class: 'small muted', text: crumb(stat) + '・' + stat.total + '問' })),
      solve('解く'));
  }
  return h('div', { class: 'weak-row ' + kind, 'data-weak-row': kind },
    h('div', { class: 'weak-head' },
      h('span', { class: 'row-main' }, h('strong', { text: stat.unit.name }), h('span', { class: 'small muted', text: crumb(stat) })),
      h('strong', { class: 'weak-rate', text: stat.percent + '%' })),
    bar(stat, kind === 'strong'),
    h('p', { class: 'small muted weak-note', text: '答えた ' + stat.answered + ' 問のうち、最後に正解だったのは ' + stat.lastOk + ' 問' }),
    kind === 'weak' ? solve('ここを解く') : null);
}

export function renderWeak(app) {
  const root = h('section', { class: 'view weak' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: '苦手の分析' }));
  const a = analyze(app.data.tree, app.state.qstats);
  if (a.state === 'none') {
    root.appendChild(h('div', { class: 'card empty' }, h('p', { text: '分析できる問題がまだありません。' })));
    return root;
  }
  const m = weakMascot(a.state, a.remaining);
  if (m) root.appendChild(h('div', { class: 'weak-mascot' }, mascotLine(m.art, m.text, 'weak-say')));
  root.appendChild(h('p', { class: 'small muted', text: '正答率は、答えた問題のうち最後に解いたとき正解だった割合です（地図の色と同じ）。答えた問題が ' + WEAK_MIN_ANSWERED + ' 問（問題がそれより少ない項目は、その全部）に届いた項目だけ、' + Math.round(WEAK_BELOW * 100) + '% 未満を苦手として低い順に並べます。' }));

  const weak = h('div', { class: 'card', 'data-weak': 'weak' }, h('h2', { text: '苦手な所' }));
  if (a.weak.length) {
    a.weak.forEach((s) => weak.appendChild(row(app, s, 'weak')));
    if (a.weakTotal > a.weak.length) weak.appendChild(h('p', { class: 'small muted', text: 'ほか ' + (a.weakTotal - a.weak.length) + ' 件（正答率が上がると順に出ます）' }));
  } else {
    weak.appendChild(h('p', { class: 'muted', text: a.state === 'clear' ? '苦手と言える所は、いまのところありません。' : 'まだ分かりません。答えた問題が増えると、ここに出ます。' }));
  }
  root.appendChild(weak);

  const un = h('div', { class: 'card', 'data-weak': 'untouched' }, h('h2', { text: 'まだ手を付けていない所' }));
  if (a.untouched.length) {
    a.untouched.forEach((s) => un.appendChild(row(app, s, 'untouched')));
    if (a.untouchedTotal > a.untouched.length) un.appendChild(h('p', { class: 'small muted', text: 'ほか ' + (a.untouchedTotal - a.untouched.length) + ' 件（「地図」で全部見られます）' }));
  } else {
    un.appendChild(h('p', { class: 'muted', text: 'すべての項目に、一度は手をつけました。' }));
  }
  root.appendChild(un);

  if (a.strong.length) {
    const st = h('div', { class: 'card', 'data-weak': 'strong' }, h('h2', { text: '得意な所' }));
    a.strong.forEach((s) => st.appendChild(row(app, s, 'strong')));
    root.appendChild(st);
  }
  return root;
}
