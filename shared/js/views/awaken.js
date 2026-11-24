// 真ボスが初めて現れる演出（要件定義書 §3-9『出現の演出』、2026-10-25 先生決定「Aだな。」）。
// 最後の章のボスを倒して地図に戻ると、地鳴りで画面が揺れ、暗いもやが広がって平和な地図が呪われた地図に変わり、稲光のあと真ボスの影（一つ目だけ光る）が浮かんで消え、
// 「（場所）で、おおきな なにかが めざめた……」が1文字ずつ出て、真ボスの入口が光りながら現れる。タップで飛ばせる。1回だけ（出したと先に記録するのは home.js）。
// 見た目は CSS（css/app.css の .awaken-*）。ここは重ねる要素を作り、時刻の順に class を付けるだけ。style 属性は使わない（CSP）。
import { h, vibrate } from '../ui.js';
import { playBossSfx, playSynth } from '../audio.js';
import { trueBossAwakeText } from '../lib/trueboss.js';
import { trueGeom } from '../lib/trueboss-geom.js';

export const AWAKEN_START_MS = 700; // 地図が出てから始めるまで（章の画面から戻る覆いが明けるのを待つ。lib/transition.js の TIMES の最長 out 300ms に余裕）
export const AWAKEN_START_REDUCED_MS = 50; // 動きを減らす設定では覆いが出ないので、画面が付くのを待つだけ
export const AWAKEN_TEXT_MAX_MS = 1300; // 1文字ずつ出す時間の上限（文が長いときは1文字を速くする）
export const AWAKEN_TEXT_STEP_MS = 45; // 1文字ごとの間隔（ふつう）

// 時刻の表（演出が始まってからの ms）。動きのあるとき。名前の意味は runAwakening の handlers を見る
export const AWAKEN_PLAN = Object.freeze([
  { at: 0, name: 'quake' }, // 地鳴り。画面がだんだん強く揺れる
  { at: 0, name: 'rumble' },
  { at: 150, name: 'haze' }, // 画面の真ん中から暗いもやが広がる
  { at: 600, name: 'curse' }, // 地図の絵が暗くなり、呪われた地図の層が浮かぶ
  { at: 2300, name: 'quakeEnd' },
  { at: 2500, name: 'bolt' }, // 稲光
  { at: 2800, name: 'shadow' }, // 真ボスの影。一つ目だけ光る
  { at: 3100, name: 'heartbeat' },
  { at: 3600, name: 'text' }, // 1文字ずつ
  { at: 5000, name: 'place' }, // 入口が光りながら現れる
  { at: 5800, name: 'fadeOut' },
  { at: 6300, name: 'end' },
]);
// 動きを減らす設定: 揺れ・もやの動き・1文字ずつを止め、呪われた地図と文と入口が一度に出る。文を読める間だけ置いて閉じる
export const AWAKEN_PLAN_REDUCED = Object.freeze([
  { at: 0, name: 'instant' },
  { at: 3500, name: 'end' },
]);

export function awakenPlan(reduced) { return reduced ? AWAKEN_PLAN_REDUCED : AWAKEN_PLAN; }
/** 1文字ずつ出すときの間隔（ms）。全体が AWAKEN_TEXT_MAX_MS を超えないように。 */
export function awakenTextStep(len) { return Math.max(10, Math.min(AWAKEN_TEXT_STEP_MS, Math.floor(AWAKEN_TEXT_MAX_MS / Math.max(1, len)))); }
export function prefersReducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

/** 稲光（ぎざぎざの光の筋。属性だけで描く SVG）。画面の上から下へ、枝を1本つける。 */
function boltBox() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'awaken-bolt-line');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ['M64 0 L56 14 L63 18 L50 36 L57 40 L44 62 L50 64 L40 88', 'M50 36 L66 48 L62 52 L74 66']) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'awaken-bolt-path');
    svg.appendChild(p);
  }
  return h('div', { class: 'awaken-bolt' }, svg);
}

/** 真ボスの影（第1形態の絵を黒くつぶし、一つ目だけ光る）。絵が読めなければ null（壊れた画像は出さない）。 */
function shadowBox(app, imageUrl) {
  const NS = 'http://www.w3.org/2000/svg';
  const geom = trueGeom(app && app.config && app.config.id);
  const eyes = Array.isArray(geom.eye) ? geom.eye : [geom.eye];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'awaken-eye-layer');
  svg.setAttribute('aria-hidden', 'true');
  for (const e of eyes) {
    const el = document.createElementNS(NS, 'ellipse');
    el.setAttribute('class', 'awaken-eye');
    el.setAttribute('cx', String(e.x));
    el.setAttribute('cy', String(e.y));
    el.setAttribute('rx', String(e.rx));
    el.setAttribute('ry', String(e.ry));
    svg.appendChild(el);
  }
  const img = h('img', { class: 'awaken-shadow-img', src: imageUrl, alt: '', decoding: 'async', draggable: 'false' });
  const box = h('div', { class: 'awaken-shadow', 'aria-hidden': 'true', 'data-awaken-shadow': '1' }, img, svg);
  img.addEventListener('error', () => box.remove());
  return box;
}

/**
 * 演出を始める。ctl は home.js が渡す { board, layer, place, root }（board・layer は、冒険の地図のときだけ。一覧のときは null）。
 *   board … 地図の板（cursed を付けると絵が暗くなる）／layer … 呪われた地図の層（rising を外すと浮かぶ）／place … 真ボスの入口（awaken-wait で隠してある）／root … 地図の画面（揺らす）
 * opts: { app, imageUrl, reduced, startDelay } 。戻り値 { finish() }（タップで飛ばす・画面が替わったときの片づけ。何度呼んでもよい）。
 */
export function runAwakening(ctl, opts) {
  const { app, imageUrl } = opts;
  const reduced = !!opts.reduced;
  const settings = app && app.state ? app.state.settings : null;
  const text = trueBossAwakeText(app.config);
  const timers = [];
  let ended = false;
  let started = false;
  let placeShown = false; // 入口を見える位置へ動かしたか
  let overlay = null;
  let textBox = null;

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const alive = () => !!ctl.root && ctl.root.isConnected;
  const sfx = (name) => { try { playBossSfx(settings, name); } catch (e) { /* 音が出せなくても演出は続ける */ } };

  // ---- 最後の姿（natural に終わっても、飛ばしても同じ） ----
  function settle() {
    if (ctl.board) ctl.board.classList.add('cursed');
    if (ctl.layer) ctl.layer.classList.remove('rising');
    if (ctl.root) ctl.root.classList.remove('awaken-quake');
    if (ctl.place) ctl.place.classList.remove('awaken-wait', 'awaken-in'); // 光る動き（awaken-in）は、閉じるときに外す（脈打つ動きに戻る）
  }

  // scroll … タップ・「とばす」で飛ばしたとき true（入口が見える位置へ動かす）。画面が替わったとき・自然に終わったときは動かさない
  function end(scroll = false) {
    if (ended) return;
    ended = true;
    if (scroll === true && started && !placeShown && ctl.place) { placeShown = true; try { ctl.place.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* 動かせなくても出る */ } } // とばしたときも、入口が見える位置へ
    timers.forEach(clearTimeout);
    timers.length = 0;
    window.removeEventListener('hashchange', onHash);
    settle();
    if (overlay) { overlay.remove(); overlay = null; }
  }

  const onHash = () => end(false);

  function typeText() {
    if (!textBox) return;
    const chars = Array.from(text);
    const step = awakenTextStep(chars.length);
    textBox.classList.add('on');
    chars.forEach((_, i) => later(() => { if (textBox) textBox.textContent = chars.slice(0, i + 1).join(''); }, i * step));
  }

  function showPlace() {
    if (!ctl.place) return;
    placeShown = true;
    ctl.place.classList.remove('awaken-wait');
    ctl.place.classList.add('awaken-in');
    try { ctl.place.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { /* 動かせなくても出る */ }
    try { playSynth(settings, 'appear'); } catch (e) { /* 音が出せなくても演出は続ける */ }
  }

  const handlers = {
    quake() { ctl.root.classList.add('awaken-quake'); vibrate(settings, [60, 40, 90, 40, 120]); },
    rumble() { sfx('rumble'); },
    haze() { overlay.querySelector('.awaken-haze').classList.add('on'); },
    curse() {
      if (ctl.board) ctl.board.classList.add('cursed'); // 絵の暗さは CSS の transition（2.6秒）でゆっくり変わる
      if (ctl.layer) ctl.layer.classList.remove('rising'); // 層は不透明度の transition で浮かぶ
    },
    quakeEnd() { ctl.root.classList.remove('awaken-quake'); },
    bolt() { overlay.querySelector('.awaken-bolt').classList.add('on'); sfx('impact'); vibrate(settings, [40, 30, 40]); },
    shadow() { const s = overlay.querySelector('.awaken-shadow'); if (s) s.classList.add('on'); },
    heartbeat() { sfx('heartbeat'); },
    text() { typeText(); },
    place() { showPlace(); },
    fadeOut() { overlay.classList.add('out'); },
    end() { end(false); },
    // 動きを減らす設定: 呪われた地図と文と入口が一度に出る（動き・点滅・1文字ずつなし）
    instant() {
      settle();
      textBox.classList.add('on');
      textBox.textContent = text;
      showPlace();
    },
  };

  function begin() {
    if (ended || started) return;
    if (!alive()) { end(); return; } // 画面が替わっていたら、何も出さない（最後の姿だけ整えて終わる）
    started = true;
    textBox = h('p', { class: 'awaken-text', 'aria-hidden': 'true', 'data-awaken-text': '1' });
    const kids = [
      h('p', { class: 'boss-sr', role: 'status', text }), // 読み上げ用（1文字ずつの更新は読ませない）
      h('button', { class: 'btn small-btn awaken-skip', type: 'button', 'data-awaken-skip': '1', onClick: (e) => { e.stopPropagation(); end(true); } }, 'とばす（タップでもとばせます）'),
    ];
    if (!reduced) {
      kids.unshift(h('div', { class: 'awaken-haze' }), boltBox());
      if (imageUrl) kids.splice(2, 0, shadowBox(app, imageUrl));
    }
    kids.push(textBox);
    overlay = h('div', { class: 'awaken-overlay' + (reduced ? ' calm' : ''), 'data-awaken': '1', onClick: () => end(true) }, ...kids);
    document.body.appendChild(overlay);
    window.addEventListener('hashchange', onHash);
    for (const step of awakenPlan(reduced)) {
      const fn = handlers[step.name];
      if (step.at === 0) fn();
      else later(() => { if (!ended && alive()) fn(); else end(); }, step.at);
    }
  }

  const delay = Number.isFinite(opts.startDelay) ? opts.startDelay : (reduced ? AWAKEN_START_REDUCED_MS : AWAKEN_START_MS);
  if (delay > 0) later(begin, delay); else begin();
  return { finish: () => end(true) };
}
