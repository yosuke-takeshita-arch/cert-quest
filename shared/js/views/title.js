// タイトル画面（ブラウザ専用）。アプリを開いて最初に出す。背景・アプリ名・受験日までの日数・読み込みのゲージ、
// 読み込みが終わったら「タップしてはじめる」。資格固有のことは config.json（name / titleImage）からだけ読む。受験日は利用者の設定（examDate 引数）。
import { h, icon } from '../ui.js';
import { daysUntil } from '../lib/scoring.js';
import { unlockAudio, titleAudioLocked } from '../audio.js';
import { buildSoundCard } from './sound-settings.js';

/**
 * 返すもの:
 *   el            … 画面の要素（#app に入れる）
 *   setProgress(s) … s = { done, total, fraction }。ゲージを伸ばす
 *   ready(onTap)  … ゲージをボタンに替える。押されたら onTap() を同期的に呼ぶ（押した操作の中で音を使えるようにするため）。
 *                   返す Promise は、開始の演出（約0.6秒。動きを減らす設定では待たない）が済んで、ホームへ切り替えてよくなったときに解ける
 *   fail(message, detail) … 読み込みに失敗したとき。ゲージ・ボタンの上に、原因と「再読み込み」を出す
 */
// sound … { settings, commit }。あれば右上に歯車を出し、押すと音の設定のポップアップを開く（変えたら commit() で保存する）
export function createTitleScreen({ config, examDate = null, now = new Date(), sound = null }) {
  const name = config.name || '';
  // 受験日は利用者が決めた日（決めていなければ null＝日数を出さない）
  const left = daysUntil(examDate, now);
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
  // BGM がオンで、まだ画面をさわっていなくて曲を鳴らせないあいだだけ出す一言（鳴り始めたら消える）
  const soundHint = h('p', { class: 'title-unofficial title-sound-hint hidden', 'aria-live': 'polite', text: '画面をさわると音楽が流れます' });
  const bottom = h('div', { class: 'title-bottom' }, loading, startBtn, soundHint, h('p', { class: 'title-unofficial', text: '非公式アプリ' }));

  const el = h('div', { class: 'title-screen', 'data-title': '1' },
    bg,
    h('div', { class: 'title-scrim' }),
    h('div', { class: 'title-top' },
      h('h1', { class: 'title-name', text: name }),
      countdown ? h('p', { class: 'title-exam', text: countdown }) : null),
    bottom,
    sound ? h('button', { class: 'title-gear', type: 'button', 'aria-label': '音の設定', 'aria-haspopup': 'dialog', onClick: (e) => openSoundPopup(e.currentTarget) }, icon('gear')) : null);

  const hintTimer = setInterval(() => {
    if (!el.isConnected && Date.now() - shownAt > 2000) { clearInterval(hintTimer); return; }
    soundHint.classList.toggle('hidden', !titleAudioLocked());
  }, 300);

  // 音の設定のポップアップ。閉じる（ボタン・背景・Esc）。開いている間は Tab がポップアップの中だけを回り、うしろの画面は触れない
  const FOCUSABLE = 'button, input, select, [tabindex]:not([tabindex="-1"])';
  let popupOpen = false;
  function openSoundPopup(trigger) {
    if (popupOpen) return;
    popupOpen = true;
    // 歯車を押すことも「最初の操作」。ここで音を使える状態にして、ポップアップの中の効果音・試し聴きがすぐ鳴るようにする
    unlockAudio({ sound: true, bgm: true });
    const card = buildSoundCard(sound.settings, sound.commit, { heading: false, inTitle: true });
    const closeBtn = h('button', { class: 'btn ghost icon-only title-pop-close', type: 'button', 'aria-label': '閉じる' }, icon('close'));
    const panel = h('div', { class: 'title-pop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title-pop-h' },
      closeBtn, h('h2', { id: 'title-pop-h', class: 'title-pop-title', text: '音の設定' }), card.el);
    const back = h('div', { class: 'title-pop-back' }, panel);
    const close = () => {
      card.dispose(); // 試し聴きは、閉じたら止める
      back.remove();
      document.removeEventListener('keydown', onKey);
      el.inert = false;
      popupOpen = false;
      if (trigger && trigger.focus) trigger.focus({ preventScroll: true });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    closeBtn.addEventListener('click', close);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    el.inert = true;
    document.body.appendChild(back);
    closeBtn.focus({ preventScroll: true });
  }

  // 2回目以降はデータがキャッシュから一瞬で読めて、ゲージが見えないまま終わる（2026-10-04 先生「読み込み中のバーもなかった」）。
  // 出してから最低 MIN_SHOW_MS はゲージを見せ、満タンまで伸びてからボタンに替える。
  const MIN_SHOW_MS = 1200;
  // 開始の演出の長さ（app.css の title-flash と合わせる）。白が最も強くなる少し後でホームに切り替える
  const FLASH_MS = 1000;
  const SWITCH_MS = 600;
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
      if (failed) return Promise.resolve();
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
      return new Promise((resolve) => {
        startBtn.addEventListener('click', () => {
          if (used) return;
          used = true;
          startBtn.disabled = true;
          onTap();
          // 開始の演出: ボタンが光って輪がはじけ、画面が白く明るく抜ける。白がいちばん強いところでホームに切り替え、白は切り替えたあとで消える。
          // 動きを減らす設定では、演出なしで、すぐ切り替える
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { resolve(); return; }
          el.classList.add('starting');
          startBtn.classList.add('go');
          bottom.appendChild(h('span', { class: 'title-ring', 'aria-hidden': 'true' }));
          const flash = h('div', { class: 'title-flash', 'aria-hidden': 'true' });
          document.body.appendChild(flash);
          setTimeout(() => flash.remove(), FLASH_MS + 200);
          setTimeout(resolve, SWITCH_MS);
        });
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
