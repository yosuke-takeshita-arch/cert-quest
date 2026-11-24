// 「誤りを報告」のボタン。押すと、config.json の reportUrl（アプリ名・ID・冒頭を入れた状態）を開く。
// 報告の先が決まっていなければ、何も出さない（null）。
import { h } from '../ui.js';
import { buildReportUrl, reportHint } from '../lib/report.js';

/** item … { kind: 'question' | 'card', id, text } */
export function reportButton(app, item) {
  const url = buildReportUrl(app.config, item);
  if (!url) return null;
  const mail = url.startsWith('mailto:');
  const a = h('a', { class: 'btn report-btn', href: url, 'data-report': item.kind + ':' + item.id, rel: mail ? null : 'noopener noreferrer', target: mail ? null : '_blank' }, '誤りを報告');
  return h('div', { class: 'report' }, a, h('p', { class: 'small muted', text: reportHint(app.config) }));
}
