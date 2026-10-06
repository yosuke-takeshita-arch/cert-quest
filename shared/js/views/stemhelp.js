// 問題文の下の「問題文の意味」ボタンと、開いたときの中身。出し分けは lib/stemhelp.js。
// 出すのは出題画面だけ（模擬試験には置かない。本番と同じ条件にするため）。開いたかどうかは記録しない（採点に影響させない）。
import { h } from '../ui.js';
import { stemHelp } from '../lib/stemhelp.js';

let seq = 0;

/** 出すものが何も無いときは null（ボタンを出さない）。choices はシャッフル後の選択肢。open(id) は用語カードを開く。 */
export function stemHelpBlock(app, q, choices, open) {
  const help = stemHelp(q, app.data.concepts, app.data.conceptIndex, choices);
  if (!help.plain && !help.terms.length) return null;
  const id = 'stem-help-' + ++seq;
  const body = h('div', { class: 'stem-help-body', id, role: 'region', 'aria-label': '問題文の意味', hidden: '' });
  if (help.plain) body.appendChild(h('section', { class: 'stem-help-plain' }, h('h3', { text: 'かみくだくと' }), h('p', { text: help.plain })));
  if (help.terms.length) {
    const ul = h('ul', { class: 'stem-help-terms' });
    for (const c of help.terms) {
      ul.appendChild(h('li', {}, h('button', { class: 'chip link', type: 'button', onClick: () => open(c.id) }, c.title), h('span', { class: 'stem-help-line', text: c.oneLine })));
    }
    body.appendChild(h('section', { class: 'stem-help-words' }, h('h3', { text: '出てくる用語' }), ul));
  }
  const btn = h('button', { class: 'btn ghost small-btn stem-help-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id }, '問題文の意味');
  btn.addEventListener('click', () => {
    const show = body.hasAttribute('hidden');
    if (show) body.removeAttribute('hidden');
    else body.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', show ? 'true' : 'false');
  });
  return h('div', { class: 'stem-help' }, btn, body);
}
