// 科目を選ぶ画面（科目のあるアプリ。例: 中小企業診断士 第1次試験の7科目）。ブラウザ専用。
// 最初に開いたとき（standalone）と、あとから替えるとき（ホームの「科目をかえる」）の両方で使う。
// 一覧に出すのは、科目の名前・試験時間・その科目で答えた問題の数だけ（記録は科目ごとに別々に保存されている）。
import { h } from '../ui.js';

/**
 * 返すもの: 画面の要素。
 *   subjects  … normalizeSubjects の結果
 *   peek(id)  … その科目の平らな記録（createSubjectStore の peek）
 *   currentId … いま開いている科目（あれば印を付ける）
 *   onPick(id) … 科目を押したとき
 *   onBack()  … 戻るボタン（standalone では出さない）
 */
export function renderSubjectPicker({ config, subjects, peek, currentId = null, onPick, onBack = null, standalone = false }) {
  const root = h('section', { class: 'view subject-picker', 'data-view': 'subjects' });
  if (onBack && !standalone) root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: onBack }, '← ホーム'));
  root.appendChild(h('h1', { text: standalone ? '科目を選んでください' : '科目をかえる' }));
  root.appendChild(h('p', { class: 'small muted', text: standalone
    ? (config.shortName || config.name || '') + 'は、科目ごとに地図・学習の記録・合格予想・ボスがあります。あとからいつでも替えられます。経験値・連続日数・設定は、全科目で共通です。'
    : '科目ごとに記録は別々に残ります。替えても、ほかの科目の記録は消えません。経験値・連続日数・設定は、全科目で共通です。' }));
  const list = h('div', { class: 'subject-list' });
  for (const s of subjects) {
    const answered = peek(s.id).totals.answered;
    const here = s.id === currentId;
    list.appendChild(h('button', {
      class: 'btn big subject-card' + (here ? ' current' : ''),
      type: 'button',
      'data-subject': s.id,
      'aria-current': here ? 'true' : null,
      onClick: () => onPick(s.id),
    },
    h('span', { class: 'subject-code', 'aria-hidden': 'true', text: s.code || '' }),
    h('span', { class: 'subject-main' },
      h('strong', { class: 'subject-name', text: s.name }),
      h('span', { class: 'small muted', text: (s.exam && s.exam.minutes ? s.exam.minutes + '分' : '') + (answered ? (s.exam && s.exam.minutes ? '・' : '') + '答えた問題 ' + answered + '問' : '') })),
    here ? h('span', { class: 'chip subject-here', text: 'いま' }) : null));
  }
  root.appendChild(list);
  return root;
}
