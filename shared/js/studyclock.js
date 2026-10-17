// 総学習時間を数える仕組みを、画面の出来事（操作・画面の前後・タイマー）につなぐ。数え方そのものは lib/studytime.js（純粋）。
// app.state は読み込み直しで入れ替わるので、足すたびに app.state を見る。保存は数十秒おきと、画面が裏に回るとき。
import { startClock, advance, addStudySeconds } from './lib/studytime.js';

const TICK_MS = 5000;
const SAVE_EVERY_MS = 30000;
const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove'];

/** app.state.studySeconds に学習時間を足し続ける。戻り値は止める関数。 */
export function installStudyClock(app, { win = window, doc = document, now = () => Date.now() } = {}) {
  let clock = startClock(now(), doc.visibilityState !== 'hidden');
  let dirtySince = null;
  let timer = null;

  function step(ev) {
    const r = advance(clock, ev, now());
    clock = r.clock;
    if (r.seconds > 0) {
      addStudySeconds(app.state, r.seconds, new Date(now())); // 合計と、その日の分に足す
      if (dirtySince === null) dirtySince = now();
    }
  }
  function save() {
    if (dirtySince === null) return;
    dirtySince = null;
    try {
      app.storage.save(app.state);
    } catch (e) { /* 保存の失敗で画面を止めない */ }
  }
  function onInput() { step('input'); }
  function onVisibility() {
    if (doc.visibilityState === 'hidden') {
      step('hidden');
      save();
    } else {
      step('visible');
    }
  }
  function onPageHide() {
    step('hidden');
    save();
  }
  function onTick() {
    step('tick');
    if (dirtySince !== null && now() - dirtySince >= SAVE_EVERY_MS) save();
  }

  for (const e of INPUT_EVENTS) win.addEventListener(e, onInput, { passive: true, capture: true });
  win.addEventListener('scroll', onInput, { passive: true, capture: true });
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', onPageHide);
  timer = win.setInterval(onTick, TICK_MS);

  return function stop() {
    for (const e of INPUT_EVENTS) win.removeEventListener(e, onInput, { capture: true });
    win.removeEventListener('scroll', onInput, { capture: true });
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', onPageHide);
    win.clearInterval(timer);
  };
}
