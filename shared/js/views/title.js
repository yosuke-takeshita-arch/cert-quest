// タイトル画面（ブラウザ専用）。アプリを開いて最初に出す。背景・アプリ名・受験日までの日数・読み込みのゲージ、
// 読み込みが終わったら「タップしてはじめる」。資格固有のことは config.json（name / examDate / titleImage）からだけ読む。
import { h } from '../ui.js';
import { daysUntil } from '../lib/scoring.js';

/**
 * 返すもの:
 *   el            … 画面の要素（#app に入れる）
 *   setProgress(s) … s = { done, total, fraction }。ゲージを伸ばす
 *   ready(onTap)  … ゲージをボタンに替える。押されたら onTap() を同期的に呼ぶ（押した操作の中で音を使えるようにするため）
 *   fail(message, detail) … 読み込みに失敗したとき。ゲージ・ボタンの上に、原因と「再読み込み」を出す
 */
export function createTitleScreen({ config, now = new Date() }) {
  const name = config.name || '';
  const left = daysUntil(config.examDate, now);
  const countdown = left == null || left < 0 ? null : left === 0 ? '受験日は今日です' : '受験日まで あと ' + left + ' 日';

  const bg = typeof config.titleImage === 'string' && config.titleImage
    ? h('img', { class: 'title-bg', src: config.titleImage, alt: '', decoding: 'async', draggable: 'false' })
    : null;
  // 画像が読めないときは、テーマ色の背景に戻る
  if (bg) bg.addEventListener('error', () => bg.remove());

  const fill = h('div', { class: 'title-gauge-fill' });
  const gauge = h('div', { class: 'title-gauge', role: 'progressbar', 'aria-label': '読み込み', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill);
  const status = h('p', { class: 'title-status', 'aria-live': 'polite', text: '読み込み中…' });
  const loading = h('div', { class: 'title-loading' }, gauge, status);
  const startBtn = h('button', { class: 'title-start hidden', type: 'button' }, 'タップしてはじめる');
  const bottom = h('div', { class: 'title-bottom' }, loading, startBtn);

  const el = h('div', { class: 'title-screen', 'data-title': '1' },
    bg,
    h('div', { class: 'title-scrim' }),
    h('div', { class: 'title-top' },
      h('h1', { class: 'title-name', text: name }),
      countdown ? h('p', { class: 'title-exam', text: countdown }) : null),
    bottom);

  // 2回目以降はデータがキャッシュから一瞬で読めて、ゲージが見えないまま終わる（2026-10-04 先生「読み込み中のバーもなかった」）。
  // 出してから最低 MIN_SHOW_MS はゲージを見せ、満タンまで伸びてからボタンに替える。
  const MIN_SHOW_MS = 1200;
  const shownAt = Date.now();
  let failed = false;
  return {
    el,
    setProgress(s) {
      if (failed) return;
      // 一瞬で読めたときに一気に満タンにならないよう、出してからの時間でも頭打ちにする（残りは ready で伸ばす）
      const byTime = Math.min(1, (Date.now() - shownAt) / MIN_SHOW_MS);
      const pct = Math.round(Math.max(0, Math.min(1, s.fraction || 0, byTime)) * 100);
      fill.style.width = pct + '%';
      gauge.setAttribute('aria-valuenow', String(pct));
      status.textContent = s.total ? '読み込み中… ' + Math.min(s.done, s.total) + ' / ' + s.total : '読み込み中…';
    },
    ready(onTap) {
      if (failed) return;
      const rest = Math.max(350, MIN_SHOW_MS - (Date.now() - shownAt));
      fill.style.transition = 'width ' + rest + 'ms ease-out';
      fill.style.width = '100%';
      gauge.setAttribute('aria-valuenow', '100');
      status.textContent = '読み込み完了';
      setTimeout(() => {
        if (failed) return;
        loading.classList.add('hidden');
        startBtn.classList.remove('hidden');
        startBtn.focus({ preventScroll: true });
      }, rest + 200);
      let used = false;
      startBtn.addEventListener('click', () => {
        if (used) return;
        used = true;
        startBtn.disabled = true;
        onTap();
      });
    },
    fail(message, detail) {
      failed = true;
      loading.classList.add('hidden');
      startBtn.classList.add('hidden');
      const box = h('div', { class: 'title-error', role: 'alert' },
        h('div', { class: 'card empty' },
          h('h2', { text: '開けませんでした' }),
          h('p', { text: message }),
          detail ? h('p', { class: 'small muted', text: detail }) : null,
          h('button', { class: 'btn primary', type: 'button', onClick: () => location.reload() }, '再読み込み')));
      el.appendChild(box);
      box.querySelector('button').focus({ preventScroll: true });
    },
  };
}
