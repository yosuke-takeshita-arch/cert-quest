// 受験日の画面（ブラウザ専用）。初回に聞く画面と、設定画面のカード。処理そのものは lib/examdate.js。
import { h } from '../ui.js';
import { normalizeExamDate, examStatus, examDateDefault, formatExamDate } from '../lib/examdate.js';

/**
 * 初回に「受験日はいつですか」を聞く画面。
 * 返すもの: { el, done }。done は、利用者が答えたとき { examDate: 'YYYY-MM-DD' | null } で解ける
 *（null は「まだ決めていない」）。
 */
export function createExamDateAsk({ config, now = new Date() }) {
  const input = h('input', { type: 'date', id: 'ask-date', class: 'date-input', value: examDateDefault(config.examDate, now), 'aria-describedby': 'ask-error' });
  const error = h('p', { id: 'ask-error', class: 'small ng-text', role: 'alert' });
  const decide = h('button', { class: 'btn primary big', type: 'button', 'data-ask': 'date' }, 'この日に決める');
  const undecided = h('button', { class: 'btn big', type: 'button', 'data-ask': 'none' }, 'まだ決めていない');
  const el = h('section', { class: 'view ask-screen', 'data-exam-ask': '1' },
    h('h1', { text: '受験日はいつですか' }),
    h('p', { text: '受験日までの日数を、ホームに出します。受ける回が決まっていなければ、「まだ決めていない」で大丈夫です。' }),
    h('div', { class: 'card' },
      h('label', { class: 'field-label', for: 'ask-date', text: '受験日' }),
      input,
      error),
    decide,
    undecided,
    h('p', { class: 'small muted', text: 'あとで、「もっと」の「設定」で変えられます。' }));
  const done = new Promise((resolve) => {
    let finished = false;
    const finish = (examDate) => {
      if (finished) return;
      finished = true;
      resolve({ examDate });
    };
    decide.addEventListener('click', () => {
      const d = normalizeExamDate(input.value);
      if (!d) {
        error.textContent = '日付を選んでください。決めていないときは、「まだ決めていない」を押してください。';
        input.focus();
        return;
      }
      finish(d);
    });
    undecided.addEventListener('click', () => finish(null));
  });
  setTimeout(() => input.focus({ preventScroll: true }), 0);
  return { el, done };
}

/** 設定画面の「受験日」カード。変えると、その場で保存する。 */
export function buildExamDateCard(app) {
  const s = app.state.settings;
  const status = h('p', { class: 'small', id: 'exam-status', 'aria-live': 'polite' });
  const input = h('input', { type: 'date', id: 'set-examDate', class: 'date-input', value: s.examDate || '' });
  const none = h('button', { class: 'btn', type: 'button', id: 'set-examDate-none' }, 'まだ決めていない');
  const refresh = () => {
    const st = examStatus(s, new Date());
    input.value = s.examDate || '';
    none.disabled = st.kind === 'unset' && s.examAsked === true;
    status.textContent = st.kind === 'unset' ? 'いまは、まだ決めていません。日数は出していません。'
      : st.kind === 'upcoming' ? formatExamDate(st.date) + '（あと ' + st.days + ' 日）'
      : st.kind === 'today' ? formatExamDate(st.date) + '（今日です）'
      : formatExamDate(st.date) + '（過ぎました。次の受験日を決めてください）';
  };
  const save = (examDate) => {
    s.examDate = examDate;
    s.examAsked = true;
    app.commit();
    refresh();
  };
  input.addEventListener('change', () => {
    const d = normalizeExamDate(input.value);
    if (d) save(d);
    else if (input.value === '') save(null); // 日付を消した＝まだ決めていない
    else refresh();
  });
  none.addEventListener('click', () => save(null));
  refresh();
  return h('div', { class: 'card', 'data-card': 'exam-date' },
    h('h2', { text: '受験日' }),
    h('p', { class: 'small muted', text: '受験日までの日数を、ホームとタイトル画面に出します。受験する回が変わったら、ここで変えてください。' }),
    status,
    h('label', { class: 'field-label', for: 'set-examDate', text: '受験日を選ぶ' }),
    input,
    none);
}
