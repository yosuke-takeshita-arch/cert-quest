// 学習時間の振り返りの画面（要件定義書 §6-2）。集計は lib/studyreport.js。ここは並べて見せるだけ。
// 棒グラフは HTML の棒（1本ずつボタン）で描く。細くなりすぎるときは横にスクロールさせる。色は CSS の変数。
// 単位・期間を切り替えても棒の入れ物は作り直さず、右端（今）をそろえて引き継ぎ、高さ・数値・縦軸の目盛りをなめらかに変える（動きは CSS の transition と tween。
// 「視差効果を減らす」では CSS の一括停止と、下の reduced() で、すぐ切り替わる）。
import { h, clear } from '../ui.js';
import { dateKey } from '../lib/srs.js';
import {
  UNITS, UNIT_LABEL, MIN_SLOT_PX, PLOT_PX, DAY_UNIT_HINT_OVER, defaultRange, normalizeRange, studyReport, formatDuration, formatAxis, bucketText,
  formatBarValue, pickBarValues, BAR_VALUE_FONT_PX, barPx, labelEvery, matchColumns,
} from '../lib/studyreport.js';

const RANGE_MSG = {
  swapped: '開始日が終了日より後だったので、入れ替えました。',
  clippedToToday: '終了日は今日までです。今日にそろえました。',
  clippedLength: '期間は最長10年です。新しいほうの10年分にしました。',
};
const ANIM_MS = 420;
const PAD_X = 16; // 棒の並びの左右の余白（端の名前が切れないように）

function reduced() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** el の数値の表示を from から to まで数え上げ（数え下げ）る。fmt は秒→文字。動きを減らす設定では、すぐ to にする。 */
function tween(el, from, to, fmt) {
  const token = (el._tw = (el._tw || 0) + 1);
  if (reduced() || from === to || typeof requestAnimationFrame !== 'function') {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    if (el._tw !== token) return; // 新しい切り替えが始まったら、古い動きはやめる
    const k = Math.min(1, (now - t0) / ANIM_MS);
    const e = 1 - Math.pow(1 - k, 3); // 終わりでゆっくり
    el.textContent = fmt(k >= 1 ? to : from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function stat(label, value, sub) {
  return h('div', { class: 'sr-stat' },
    h('span', { class: 'small muted', text: label }),
    h('strong', { class: 'sr-stat-val', text: value }),
    sub ? h('span', { class: 'small muted', text: sub }) : null);
}

/** グラフの入れ物（作るのは1回。update で中身をなめらかに入れ替える）。 */
function createChart(app) {
  const title = h('h2', { text: '' });
  const axisTop = h('span', { text: '' });
  const axisMid = h('span', { text: '' });
  const axisBottom = h('span', { text: '0' });
  const axisEl = h('div', { class: 'sr-axis', 'aria-hidden': 'true' }, axisTop, axisMid, axisBottom);
  const cols = h('div', { class: 'sr-cols', role: 'group' });
  const xs = h('div', { class: 'sr-xs', 'aria-hidden': 'true' });
  const scroll = h('div', { class: 'sr-scroll', 'data-sr-scroll': '1' }, cols, xs);
  const detail = h('p', { class: 'sr-detail', 'aria-live': 'polite', 'data-sr-detail': '1' });
  const hintHost = h('div', { class: 'sr-hint' });
  const el = h('div', { class: 'card sr-chart-card' }, title, h('div', { class: 'sr-chart' }, axisEl, scroll), detail, hintHost);
  scroll.addEventListener('scroll', () => scroll.classList.toggle('scrolled', scroll.scrollLeft > 1), { passive: true });

  let items = []; // { col, bar, val, x, bk }（左から右）
  let selected = null;
  let axisSec = 0;
  let first = true;

  // 棒の上の数値は横書き1行。隣と重なるものは隠す（選んでいる棒と、右の新しい日を先に出す）
  let curSlot = 0;
  function placeValues() {
    const live = items.filter((x) => !x.col.classList.contains('leaving'));
    if (!live.length) return;
    const width = Math.max(scroll.clientWidth || 0, live.length * curSlot + PAD_X * 2);
    const slotPx = (width - PAD_X * 2) / live.length;
    const fontPx = parseFloat(getComputedStyle(live[0].val).fontSize) || BAR_VALUE_FONT_PX;
    const show = pickBarValues(live.map((x) => formatBarValue(x.sec)), slotPx, live.indexOf(selected), fontPx);
    live.forEach((x, i) => x.val.classList.toggle('sr-val-hidden', !show[i]));
  }

  function select(it) {
    if (selected) selected.col.setAttribute('aria-pressed', 'false');
    selected = it;
    placeValues();
    if (!it) { detail.textContent = ''; return; }
    it.col.setAttribute('aria-pressed', 'true');
    detail.textContent = bucketText(it.bk);
  }

  function makeItem(onSelect) {
    const val = h('span', { class: 'sr-val', 'aria-hidden': 'true' });
    const bar = h('span', { class: 'sr-bar' });
    const col = h('button', { class: 'sr-col', type: 'button', 'aria-pressed': 'false' }, val, bar);
    const x = h('span', { class: 'sr-x' });
    const it = { col, bar, val, x, bk: null, sec: 0 };
    col.addEventListener('click', () => onSelect(it));
    return it;
  }

  function leave(it) {
    it.col.removeAttribute('data-sr-bucket');
    it.col.setAttribute('aria-hidden', 'true');
    it.col.tabIndex = -1;
    it.col.disabled = true;
    it.col.classList.add('leaving');
    it.x.classList.add('leaving');
    it.bar.style.height = '2px';
    it.val.textContent = '';
    const done = () => { it.col.remove(); it.x.remove(); };
    if (reduced()) done(); else setTimeout(done, ANIM_MS + 80);
  }

  /** rep は studyReport の結果。unit は単位。 */
  function update(rep, unit) {
    const n = rep.buckets.length;
    const slot = MIN_SLOT_PX[unit];
    const animate = !first && !reduced();
    const m = matchColumns(items.length, n);

    // 左側の古い棒は消す（高さ0へ縮み、幅も0へ）。右端をそろえて、残りを引き継ぐ
    const gone = items.slice(0, m.leave);
    items = items.slice(m.leave);
    gone.forEach(leave);
    // 左側に新しい棒を足す（0から伸びる）
    const added = [];
    for (let i = 0; i < m.enter; i++) {
      const it = makeItem((x) => select(x));
      it.col.classList.add('entering');
      it.x.classList.add('entering');
      added.push(it);
    }
    items = added.concat(items);
    // DOM の並び: 消える棒は、いま居る場所のまま（左の端）。新しい棒は残っている棒の左
    const firstLive = items.length > m.enter ? items[m.enter] : null;
    for (const it of added) {
      cols.insertBefore(it.col, firstLive ? firstLive.col : null);
      xs.insertBefore(it.x, firstLive ? firstLive.x : null);
    }

    curSlot = slot;
    cols.setAttribute('aria-label', UNIT_LABEL[unit] + 'の学習時間の棒グラフ。' + n + '本');
    const minW = n * slot + PAD_X * 2 + 'px';
    cols.style.minWidth = minW;
    xs.style.minWidth = minW;
    title.textContent = UNIT_LABEL[unit] + 'の学習時間';

    const every = labelEvery(slot);
    items.forEach((it, i) => {
      const bk = rep.buckets[i];
      it.bk = bk;
      it.col.setAttribute('aria-label', bucketText(bk));
      it.col.setAttribute('data-sr-bucket', bk.key);
      it.bar.classList.toggle('zero', !(bk.seconds > 0));
      // 名前は、右端（今）から数えて何本おきに出す（いちばん新しい棒の名前がいつも見える）
      const shown = (n - 1 - i) % every === 0;
      clear(it.x);
      if (shown) {
        it.x.appendChild(h('span', { class: 'sr-x-in' }, bk.label, bk.labelSub ? h('small', { text: bk.labelSub }) : null));
      }
      const px = barPx(bk.seconds, rep.axisMax, PLOT_PX);
      const from = it.sec;
      it.sec = bk.seconds;
      if (it.col.classList.contains('entering')) {
        // 出たばかりの棒は 0 から。次のコマで高さを決める
        it.bar.style.height = '2px';
        it.val.textContent = '';
      }
      if (!animate) {
        it.bar.style.height = px + 'px';
        it.val.textContent = formatBarValue(bk.seconds);
      }
      it._px = px;
      it._from = it.col.classList.contains('entering') ? 0 : from;
    });

    // 縦軸の目盛り（上端・中央）も、数が変わるときは数え上がり・数え下がり
    const fromAxis = axisSec;
    axisSec = rep.axisMax;
    if (animate) {
      tween(axisTop, fromAxis, axisSec, formatAxis);
      tween(axisMid, fromAxis / 2, axisSec / 2, formatAxis);
    } else {
      axisTop.textContent = formatAxis(axisSec);
      axisMid.textContent = formatAxis(axisSec / 2);
    }

    if (animate) {
      // 1コマ待ってから、新しい高さ・幅に変える（transition が働く）
      requestAnimationFrame(() => requestAnimationFrame(() => {
        items.forEach((it) => {
          it.col.classList.remove('entering');
          it.x.classList.remove('entering');
          it.bar.style.height = it._px + 'px';
          tween(it.val, it._from, it.sec, formatBarValue);
        });
      }));
    } else {
      items.forEach((it) => { it.col.classList.remove('entering'); it.x.classList.remove('entering'); });
    }
    first = false;

    select(items.length ? items[items.length - 1] : null); // いちばん新しい棒の数字を出す

    // 注意書き
    clear(hintHost);
    const rangeDays = rep.total.rangeDays;
    if (unit === 'day' && rangeDays > DAY_UNIT_HINT_OVER) {
      hintHost.appendChild(h('p', { class: 'small muted', text: '棒が多いので、横にスクロールして見ます。週ごとにすると見やすくなります。' }));
      hintHost.appendChild(h('button', { class: 'btn small-btn', type: 'button', 'data-sr-to-week': '1', onClick: () => app.srToWeek() }, '同じ期間を週ごとにする'));
    } else if (n > 1 && n * slot + PAD_X * 2 > 340) {
      hintHost.appendChild(h('p', { class: 'small muted', text: '横にスクロールできます。' }));
    }

    // 開いたときは、いちばん新しい側（右端）が見えるようにする
    requestAnimationFrame(() => {
      scroll.scrollLeft = scroll.scrollWidth;
      scroll.classList.toggle('scrolled', scroll.scrollLeft > 1);
    });
  }

  return { el, update };
}

export function renderStudyReport(app, { today = dateKey(new Date()) } = {}) {
  const root = h('section', { class: 'view sr', 'data-study-report': '1' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/home') }, '← ホーム'));
  root.appendChild(h('h1', { text: '学習時間の振り返り' }));

  let unit = 'day';
  let range = defaultRange(unit, today);
  let message = '';
  const top = h('div', { class: 'sr-top' });
  const noteHost = h('div', { class: 'sr-note-host' });
  const chart = createChart({ srToWeek: () => setUnit('week', true) });

  function setUnit(u, keepRange) {
    unit = u;
    if (!keepRange) {
      range = defaultRange(u, today);
      message = '';
    }
    draw();
  }
  function setRange(from, to) {
    const r = normalizeRange(unit, from, to, today);
    range = { from: r.from, to: r.to };
    message = r.swapped ? RANGE_MSG.swapped : r.clippedToToday ? RANGE_MSG.clippedToToday : r.clippedLength ? RANGE_MSG.clippedLength : '';
    draw();
  }

  /** 描き直すと押した部品が作り直されるので、キーボードの人が迷わないよう、同じ部品に戻す。 */
  function refocus(sel) {
    const el = top.querySelector(sel);
    if (el) el.focus({ preventScroll: true });
  }

  function draw() {
    clear(top);
    clear(noteHost);
    const rep = studyReport(app.state, unit, range.from, range.to, today);
    const t = rep.total;

    // 1. 単位の切り替え
    const tabs = h('div', { class: 'sr-tabs', role: 'group', 'aria-label': '集計の単位' });
    UNITS.forEach((u) => tabs.appendChild(h('button', { class: 'sr-tab' + (u === unit ? ' on' : ''), type: 'button', 'data-sr-unit': u, 'aria-pressed': u === unit ? 'true' : 'false', onClick: () => { setUnit(u, false); refocus('[data-sr-unit="' + u + '"]'); } }, UNIT_LABEL[u])));

    // 2. 期間の指定
    const from = h('input', { class: 'sr-date', type: 'date', id: 'sr-from', value: range.from, max: today, 'data-sr-from': '1' });
    const to = h('input', { class: 'sr-date', type: 'date', id: 'sr-to', value: range.to, max: today, 'data-sr-to': '1' });
    const apply = (sel) => () => {
      if (!from.value || !to.value) return;
      setRange(from.value, to.value);
      refocus(sel);
    };
    from.addEventListener('change', apply('#sr-from'));
    to.addEventListener('change', apply('#sr-to'));
    const period = h('div', { class: 'sr-period' },
      h('label', { class: 'sr-field', for: 'sr-from' }, h('span', { class: 'small muted', text: '開始日' }), from),
      h('label', { class: 'sr-field', for: 'sr-to' }, h('span', { class: 'small muted', text: '終了日' }), to));

    top.appendChild(h('div', { class: 'card' }, tabs, period,
      message ? h('p', { class: 'small sr-msg', role: 'status', text: message }) : null));

    // 3. 合計・平均など
    top.appendChild(h('div', { class: 'sr-stats', 'data-sr-stats': '1' },
      stat('合計', formatDuration(t.seconds), t.rangeDays + '日間'),
      stat('1日あたり', t.averageSeconds === null ? '—' : formatDuration(t.averageSeconds), t.averageSeconds === null ? '記録がまだありません' : '平均（' + t.averageDays + '日）'),
      stat('勉強した日', t.studiedDays + '日', '全 ' + t.rangeDays + '日のうち'),
      stat('答えた問題', t.answered + '問', t.answered > 0 ? '正解 ' + t.correct + '問' : null)));

    // 4. グラフ（入れ物は作り直さず、中身をなめらかに入れ替える）
    chart.update(rep, unit);

    // 5. 注意書き
    const first = rep.firstRecord;
    noteHost.appendChild(h('p', { class: 'small muted', 'data-sr-note': '1', text: first
      ? 'この画面の記録は ' + first.replace(/^(\d+)-(\d+)-(\d+)$/, (m, y, mo, d) => y + '年' + Number(mo) + '月' + Number(d) + '日') + ' から始まっています。それ以前の分は日ごとに分けられないので、ホームの総学習時間にだけ入っています。記録の無い日は 0 分として数えます。'
      : 'まだ記録がありません。アプリを開いて学ぶと、この日から日ごとにたまっていきます。ホームの総学習時間には、それ以前の分も入っています。' }));
  }

  root.appendChild(top);
  root.appendChild(chart.el);
  root.appendChild(noteHost);
  draw();
  return root;
}
