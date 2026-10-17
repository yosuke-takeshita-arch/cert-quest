// 学習時間の振り返りの画面（要件定義書 §6-2）。集計は lib/studyreport.js。ここは並べて見せるだけ。
// 棒グラフは HTML の棒（1本ずつボタン）で描く。細くなりすぎるときは横にスクロールさせる。色は CSS の変数。
import { h, clear } from '../ui.js';
import { dateKey } from '../lib/srs.js';
import { UNITS, UNIT_LABEL, MIN_SLOT_PX, DAY_UNIT_HINT_OVER, defaultRange, normalizeRange, studyReport, formatDuration, formatAxis, bucketText } from '../lib/studyreport.js';

const RANGE_MSG = {
  swapped: '開始日が終了日より後だったので、入れ替えました。',
  clippedToToday: '終了日は今日までです。今日にそろえました。',
  clippedLength: '期間は最長10年です。新しいほうの10年分にしました。',
};

function stat(label, value, sub) {
  return h('div', { class: 'sr-stat' },
    h('span', { class: 'small muted', text: label }),
    h('strong', { class: 'sr-stat-val', text: value }),
    sub ? h('span', { class: 'small muted', text: sub }) : null);
}

/** 縦軸の目盛り（上・中・下）。棒のいちばん高い所が上端になるよう、上端はきりのよい値。 */
function axis(max) {
  return h('div', { class: 'sr-axis', 'aria-hidden': 'true' },
    h('span', { text: formatAxis(max) }), h('span', { text: formatAxis(max / 2) }), h('span', { text: '0' }));
}

export function renderStudyReport(app, { today = dateKey(new Date()) } = {}) {
  const root = h('section', { class: 'view sr', 'data-study-report': '1' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/home') }, '← ホーム'));
  root.appendChild(h('h1', { text: '学習時間の振り返り' }));

  let unit = 'day';
  let range = defaultRange(unit, today);
  let message = '';
  const body = h('div', { class: 'sr-body' });

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
    const el = body.querySelector(sel);
    if (el) el.focus({ preventScroll: true });
  }

  function draw() {
    clear(body);
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

    body.appendChild(h('div', { class: 'card' }, tabs, period,
      message ? h('p', { class: 'small sr-msg', role: 'status', text: message }) : null));

    // 3. 合計・平均など
    body.appendChild(h('div', { class: 'sr-stats', 'data-sr-stats': '1' },
      stat('合計', formatDuration(t.seconds), t.rangeDays + '日間'),
      stat('1日あたり', t.averageSeconds === null ? '—' : formatDuration(t.averageSeconds), t.averageSeconds === null ? '記録がまだありません' : '平均（' + t.averageDays + '日）'),
      stat('勉強した日', t.studiedDays + '日', '全 ' + t.rangeDays + '日のうち'),
      stat('答えた問題', t.answered + '問', t.answered > 0 ? '正解 ' + t.correct + '問' : null)));

    // 4. グラフ
    const card = h('div', { class: 'card sr-chart-card' });
    card.appendChild(h('h2', { text: UNIT_LABEL[unit] + 'の学習時間' }));
    const n = rep.buckets.length;
    const slot = MIN_SLOT_PX[unit];
    const step = Math.max(1, Math.ceil(40 / slot)); // 下の名前は、重ならないよう何本かおきに出す
    const detail = h('p', { class: 'sr-detail', 'aria-live': 'polite', 'data-sr-detail': '1' });
    const cols = h('div', { class: 'sr-cols', role: 'group', 'aria-label': UNIT_LABEL[unit] + 'の学習時間の棒グラフ。' + n + '本' });
    const xs = h('div', { class: 'sr-xs', 'aria-hidden': 'true' });
    let selected = null;
    const show = (btn, bk) => {
      if (selected) selected.setAttribute('aria-pressed', 'false');
      selected = btn;
      btn.setAttribute('aria-pressed', 'true');
      detail.textContent = bucketText(bk);
    };
    let lastBtn = null;
    rep.buckets.forEach((bk, i) => {
      const pct = rep.axisMax > 0 ? (bk.seconds / rep.axisMax) * 100 : 0;
      const bar = h('span', { class: 'sr-bar' + (bk.seconds > 0 ? '' : ' zero') });
      if (bk.seconds > 0) bar.style.height = Math.max(pct, 1.5) + '%';
      const btn = h('button', { class: 'sr-col', type: 'button', 'aria-pressed': 'false', 'aria-label': bucketText(bk), 'data-sr-bucket': bk.key }, bar);
      btn.addEventListener('click', () => show(btn, bk));
      cols.appendChild(btn);
      lastBtn = btn;
      const shown = i % step === 0;
      xs.appendChild(h('span', { class: 'sr-x' }, shown ? bk.label : '', shown && bk.labelSub ? h('small', { text: bk.labelSub }) : null));
    });
    const minW = n * slot + 'px';
    cols.style.minWidth = minW;
    xs.style.minWidth = minW;
    const scroll = h('div', { class: 'sr-scroll', 'data-sr-scroll': '1' }, cols, xs);
    card.appendChild(h('div', { class: 'sr-chart' }, axis(rep.axisMax), scroll));
    if (lastBtn) {
      show(lastBtn, rep.buckets[n - 1]); // 開いたときは、いちばん新しい棒の数字を出す
    }
    card.appendChild(detail);
    if (unit === 'day' && t.rangeDays > DAY_UNIT_HINT_OVER) {
      card.appendChild(h('p', { class: 'small muted', text: '棒が多いので、横にスクロールして見ます。週ごとにすると見やすくなります。' }));
      card.appendChild(h('button', { class: 'btn small-btn', type: 'button', 'data-sr-to-week': '1', onClick: () => setUnit('week', true) }, '同じ期間を週ごとにする'));
    } else if (n > 1 && n * slot > 340) {
      card.appendChild(h('p', { class: 'small muted', text: '横にスクロールできます。' }));
    }
    body.appendChild(card);

    // 5. 注意書き
    const first = rep.firstRecord;
    body.appendChild(h('p', { class: 'small muted', 'data-sr-note': '1', text: first
      ? 'この画面の記録は ' + first.replace(/^(\d+)-(\d+)-(\d+)$/, (m, y, mo, d) => y + '年' + Number(mo) + '月' + Number(d) + '日') + ' から始まっています。それ以前の分は日ごとに分けられないので、ホームの総学習時間にだけ入っています。記録の無い日は 0 分として数えます。'
      : 'まだ記録がありません。アプリを開いて学ぶと、この日から日ごとにたまっていきます。ホームの総学習時間には、それ以前の分も入っています。' }));

    // 開いたときは、いちばん新しい側（右端）が見えるようにする
    requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
  }

  root.appendChild(body);
  draw();
  return root;
}
