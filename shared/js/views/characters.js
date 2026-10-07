// 「キャラクター」: サニーとあい先生の紹介。1画面に1人までの決まりを守るため、上の切り替えで1人ずつ出す（要件定義書 §6 キャラクター紹介）。
// 文言は lib/characters.js の CHARACTER_PROFILE・CHARACTER_PAGE_TEXT の1か所。絵はタップできる（隠しセリフ）。
import { h, clear, characterImg, tappable } from '../ui.js';
import { CHARACTER_PROFILE, CHARACTER_PROFILE_ORDER, CHARACTER_PAGE_TEXT, CHARACTER_NAMES } from '../lib/characters.js';

/** 切り替えの1人ぶん（絵・吹き出し・項目・会える場所）。 */
export function buildProfile(who) {
  const p = CHARACTER_PROFILE[who];
  const say = h('p', { class: 'mascot-say char-intro-say' }, h('span', { class: 'mascot-name', text: CHARACTER_NAMES[who] }), p.hello);
  const dl = h('dl', { class: 'char-facts' });
  for (const r of p.rows) {
    dl.appendChild(h('div', { class: 'char-fact', 'data-fact': r.label },
      h('dt', { text: r.label }),
      h('dd', {}, r.text, r.note ? h('span', { class: 'small muted char-note', text: r.note }) : null)));
  }
  const where = h('ul', { class: 'char-where' }, p.where.map((t) => h('li', { text: t })));
  return h('div', { class: 'char-profile', 'data-char-profile': who },
    h('div', { class: 'char-hero' }, tappable(characterImg(p.art, 'char-intro-img'), say), say),
    h('div', { class: 'card char-card' }, h('h2', { text: CHARACTER_NAMES[who] }), dl),
    h('div', { class: 'card char-card' }, h('h2', { text: CHARACTER_PAGE_TEXT.whereLabel }), where));
}

export function renderCharacters(app, arg) {
  const root = h('section', { class: 'view characters' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: CHARACTER_PAGE_TEXT.title }));
  const tabs = h('div', { class: 'char-tabs', role: 'group', 'aria-label': CHARACTER_PAGE_TEXT.title });
  const body = h('div', { class: 'char-body' });
  const buttons = {};
  const show = (who) => {
    for (const k of CHARACTER_PROFILE_ORDER) {
      buttons[k].classList.toggle('on', k === who);
      buttons[k].setAttribute('aria-pressed', k === who ? 'true' : 'false');
    }
    clear(body);
    body.appendChild(buildProfile(who)); // もう1人の絵は出さない（1画面に1人まで）
  };
  for (const k of CHARACTER_PROFILE_ORDER) {
    buttons[k] = h('button', { class: 'btn char-tab', type: 'button', 'data-char-tab': k, onClick: () => show(k) }, CHARACTER_NAMES[k]);
    tabs.appendChild(buttons[k]);
  }
  root.appendChild(tabs);
  root.appendChild(body);
  root.appendChild(h('div', { class: 'card char-secret', 'data-char': 'secret' },
    h('h2', { text: CHARACTER_PAGE_TEXT.secretLabel }),
    h('p', { text: CHARACTER_PAGE_TEXT.secretHint })));
  show(CHARACTER_PROFILE_ORDER.includes(arg) ? arg : CHARACTER_PROFILE_ORDER[0]);
  return root;
}
