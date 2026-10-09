// ホームの「合格予想メーター」のカード。計算は lib/forecast.js、仕様は要件定義書 §3-6。
// 合格の線は出さない（G検定は非公開、DX は100点満点に置き換えられない）。言い方は『目安』で、合格を約束しない。
import { h } from '../ui.js';
import { forecast, forecastSeries } from '../lib/forecast.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const FORECAST_NOTE = '目安です。合格を約束するものではありません。本番の問題はこのアプリの問題と同じではありません。';

/** 画面に出す点。整数に切り捨てる（目安が実際より高く見えないように）。全問正解の浮動小数の誤差（99.99999…）は 100 にする。 */
export function displayScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.floor(score + 1e-9)));
}

function md(dateKey) {
  const [, m, d] = dateKey.split('-');
  return Number(m) + '/' + Number(d);
}

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  return el;
}

/** 日ごとの推移の小さな折れ線。記録が2日より少なければ null。色は CSS の class（.fc-line）で決める。 */
export function trendChart(raw) {
  const series = forecastSeries(raw);
  if (series.length < 2) return null;
  const W = 300;
  const H = 80;
  const PAD = 8;
  const vals = series.map((p) => p.score);
  let lo = Math.max(0, Math.floor(Math.min(...vals) - 5));
  let hi = Math.min(100, Math.ceil(Math.max(...vals) + 5));
  if (hi - lo < 10) hi = Math.min(100, lo + 10);
  if (hi - lo < 10) lo = Math.max(0, hi - 10);
  const x = (i) => PAD + (i * (W - PAD * 2)) / (series.length - 1);
  const y = (v) => H - PAD - ((v - lo) * (H - PAD * 2)) / (hi - lo);
  const first = series[0];
  const last = series[series.length - 1];
  const label = '予想の推移（目安）。' + md(first.date) + ' は ' + Math.floor(first.score) + ' 点、' + md(last.date) + ' は ' + Math.floor(last.score) + ' 点';
  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'fc-chart', role: 'img', 'aria-label': label });
  svg.appendChild(svgEl('line', { class: 'fc-base', x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD }));
  svg.appendChild(svgEl('polyline', { class: 'fc-line', points: series.map((p, i) => x(i).toFixed(1) + ',' + y(p.score).toFixed(1)).join(' ') }));
  if (series.length <= 14) series.forEach((p, i) => svg.appendChild(svgEl('circle', { class: 'fc-dot', cx: x(i).toFixed(1), cy: y(p.score).toFixed(1), r: 3 })));
  return h('div', { class: 'fc-trend' },
    svg,
    h('p', { class: 'small muted fc-trend-cap', text: md(first.date) + '：' + Math.floor(first.score) + '点 → ' + md(last.date) + '：' + Math.floor(last.score) + '点' }));
}

/** ホームに置くカード。app.data.questions と app.state から、その場で計算する。 */
export function forecastCard(app) {
  const { data, state } = app;
  const f = forecast(data.questions, state.qstats);
  const card = h('div', { class: 'card forecast', 'data-forecast': f.score === null ? 'empty' : 'ready' });
  card.appendChild(h('h2', { text: '合格予想メーター' }));
  if (f.score === null) {
    card.appendChild(h('p', { class: 'fc-empty', text: '問題を解くと、ここに予想が出ます。' }));
    card.appendChild(h('p', { class: 'small muted', text: FORECAST_NOTE }));
    return card;
  }
  const pt = displayScore(f.score);
  card.appendChild(h('div', { class: 'fc-score' },
    h('strong', { class: 'fc-num', text: String(pt) }),
    h('span', { class: 'fc-unit', text: '点' }),
    h('span', { class: 'small muted fc-full', text: '100点満点の目安' })));
  card.appendChild(h('div', { class: 'progress fc-meter', role: 'progressbar', 'aria-label': '合格予想（100点満点の目安）', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pt) },
    h('div', { class: 'progress-fill', style: { width: pt + '%' } })));
  card.appendChild(h('p', { class: 'small muted', text: '答えた問題 ' + f.answered + ' / 全 ' + f.total + ' 問。まだ答えていない問題や、前回まちがえた問題は、4択を当てずっぽうで選んだ見込み（4分の1）で数えています。' }));
  card.appendChild(h('p', { class: 'small fc-note', text: FORECAST_NOTE }));

  if (f.top.length) {
    card.appendChild(h('h3', { class: 'fc-sub', text: 'ここを伸ばすと上がります' }));
    const list = h('div', { class: 'fc-gains' });
    f.top.forEach((c) => {
      const stage = data.tree.byKey.get(c.key);
      const name = stage ? stage.name : c.key.split('|').pop();
      list.appendChild(h('button', { class: 'fc-gain', type: 'button', 'data-forecast-chapter': c.key, onClick: () => app.go('#/stage/' + encodeURIComponent(c.key)) },
        h('span', { class: 'fc-gain-name' }, h('strong', { text: name }), h('span', { class: 'small muted', text: 'まだ正解していない問題 ' + c.remaining + ' 問' })),
        h('span', { class: 'fc-gain-pt', text: '最大 +' + (Math.round(c.gain * 10) / 10).toFixed(1) + '点' })));
    });
    card.appendChild(list);
  }

  const chart = trendChart(state.forecast);
  if (chart) {
    card.appendChild(h('h3', { class: 'fc-sub', text: '予想の推移' }));
    card.appendChild(chart);
  }
  return card;
}
