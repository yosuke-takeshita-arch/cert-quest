// 使い方の案内の画面（ブラウザ専用）。初めて開いたときと、「もっと」の「使い方」から。文言と判定は lib/intro.js。
import { h, characterImg } from '../ui.js';
import { characterName } from '../lib/characters.js';
import { INTRO_SLIDES, INTRO_TEXT } from '../lib/intro.js';

const SWIPE_PX = 48;

/**
 * 案内の画面。左右にスワイプするか、「次へ」「もどる」で進む。「とばす」はいつでも押せる。最後のページのボタンは「はじめる」。
 * 返すもの: { el, done }。done は、最後まで見た・とばしたとき { skipped: boolean } で解ける。
 */
export function createIntro({ slides = INTRO_SLIDES } = {}) {
  let idx = 0;
  let finished = false;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const stage = h('div', { class: 'intro-stage', 'aria-live': 'polite' });
  const dots = h('div', { class: 'intro-dots', 'aria-hidden': 'true' });
  const backBtn = h('button', { class: 'btn big', type: 'button', 'data-intro': 'back' }, INTRO_TEXT.back);
  const nextBtn = h('button', { class: 'btn primary big', type: 'button', 'data-intro': 'next' }, INTRO_TEXT.next);
  const skipBtn = h('button', { class: 'btn ghost intro-skip', type: 'button', 'data-intro': 'skip' }, INTRO_TEXT.skip);
  const actions = h('div', { class: 'intro-actions' }, backBtn, nextBtn);
  const el = h('section', { class: 'intro-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': '使い方の案内', 'data-intro-screen': '1' },
    h('div', { class: 'intro-top' }, skipBtn),
    stage,
    h('div', { class: 'intro-bottom' }, dots, actions));

  const finish = (skipped) => {
    if (finished) return;
    finished = true;
    document.removeEventListener('keydown', onKey);
    resolveDone({ skipped });
  };

  function render() {
    const s = slides[idx];
    const last = idx === slides.length - 1;
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    const name = characterName(s.art);
    // ページを替えるたびに絵を作り直すので、キャラクターは毎回ぴょこんと出る（動きを減らす設定では、CSS が止める）
    stage.appendChild(h('div', { class: 'intro-slide', 'data-slide': String(idx + 1) },
      characterImg(s.art, 'intro-img'),
      h('p', { class: 'mascot-say intro-say' }, name ? h('span', { class: 'mascot-name', text: name }) : null, s.text),
      h('h2', { class: 'intro-title', text: s.title }),
      h('p', { class: 'small muted intro-step', text: (idx + 1) + ' / ' + slides.length })));
    while (dots.firstChild) dots.removeChild(dots.firstChild);
    slides.forEach((_, i) => dots.appendChild(h('span', { class: 'intro-dot' + (i === idx ? ' on' : '') })));
    backBtn.classList.toggle('hidden', idx === 0);
    actions.classList.toggle('single', idx === 0);
    nextBtn.textContent = last ? INTRO_TEXT.start : INTRO_TEXT.next;
    nextBtn.setAttribute('data-intro', last ? 'start' : 'next');
  }

  const go = (d) => {
    const n = idx + d;
    if (n < 0) return;
    if (n >= slides.length) { finish(false); return; }
    idx = n;
    render();
    if (!el.contains(document.activeElement)) nextBtn.focus({ preventScroll: true }); // スワイプなどでフォーカスが外れていたら、案内の中へ戻す
  };
  nextBtn.addEventListener('click', () => go(1));
  backBtn.addEventListener('click', () => go(-1));
  skipBtn.addEventListener('click', () => finish(true));

  // 左右にスワイプ（指を48px以上、ほぼ横に動かしたとき）。縦のスクロールは邪魔しない
  let startX = null;
  let startY = null;
  stage.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; });
  stage.addEventListener('pointerup', (e) => {
    if (startX == null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => { startX = null; });

  function onKey(e) {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Escape') finish(true);
    else if (e.key === 'Tab') {
      const f = Array.from(el.querySelectorAll('button')).filter((b) => !b.disabled && b.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }
  // 画面のどこかを押してフォーカスが外れても、矢印キーと Esc が効くように、document で受ける（終わったら外す）
  document.addEventListener('keydown', onKey);

  render();
  setTimeout(() => nextBtn.focus({ preventScroll: true }), 0);
  return { el, done };
}

/** 「もっと」の「使い方」から見直す。画面いっぱいに重ねて出し、終わったら元の画面に戻る（記録は変えない）。 */
export function openIntro() {
  const prevFocus = document.activeElement;
  const intro = createIntro();
  document.body.appendChild(intro.el);
  intro.done.then(() => {
    intro.el.remove();
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  });
  return intro;
}
