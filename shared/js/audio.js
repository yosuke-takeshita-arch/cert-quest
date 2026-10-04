// 音を鳴らす側（ブラウザ専用）。設定の正規化や音量の計算は lib/sound.js。
// - 効果音: 小さいので WebAudio で鳴らす。ファイルが取れない・読めないときは、昔の「ピッ」に切り替える
// - BGM: 大きいので、最初に流すときに取ってきてキャッシュに入る（sw-core.js が /audio/ をキャッシュ優先で返す）
//   音量は iOS でも効くよう WebAudio の GainNode でかける
// - スマホは画面を一度さわるまで音を出せない。BGM は、さわったあとから流す
import { SFX_FILES, BGM_TRACKS, sfxGain, bgmGain, nextBgmPosition } from './lib/sound.js';

const SFX_BASE = new URL('../audio/sfx/', import.meta.url).href;
const BGM_BASE = new URL('../audio/bgm/', import.meta.url).href;

let getSettings = () => null;
let ctx = null;
const sfxBytes = new Map(); // キー → Promise<ArrayBuffer|null>
const sfxBuffers = new Map(); // キー → AudioBuffer（ファイルが読めなかったら null）

function audioCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { ctx = null; }
  return ctx;
}

function resumeCtx() {
  const c = audioCtx();
  if (c && c.state === 'suspended') return c.resume().catch(() => {});
  return Promise.resolve();
}

// ---- 効果音 ----
function fetchSfxBytes(name) {
  if (!sfxBytes.has(name)) {
    sfxBytes.set(name, fetch(SFX_BASE + SFX_FILES[name])
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null));
  }
  return sfxBytes.get(name);
}

/** 効果音のファイルを先に取っておく（鳴らすときの遅れを無くす）。 */
export function preloadSfx() {
  Object.keys(SFX_FILES).forEach((k) => { fetchSfxBytes(k); });
}

async function sfxBuffer(name, c) {
  if (sfxBuffers.has(name)) return sfxBuffers.get(name);
  let buf = null;
  try {
    const bytes = await fetchSfxBytes(name);
    if (bytes) buf = await c.decodeAudioData(bytes.slice(0));
  } catch (e) { buf = null; }
  sfxBuffers.set(name, buf);
  return buf;
}

// ファイルが使えないときの代わりの音（昔の beep と同じ）
function synthBeep(c, name, gain) {
  const notes = name === 'ok' ? [660, 880] : name === 'ng' ? [220] : [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * 0.09;
    o.frequency.value = f;
    o.type = 'sine';
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.15 * gain), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + 0.18);
  });
}

/** 効果音を1回鳴らす。settings.sound が false なら何もしない。name は SFX_FILES のキー。 */
export function playSfx(settings, name) {
  if (!settings || !settings.sound || !SFX_FILES[name]) return;
  const c = audioCtx();
  if (!c) return;
  const gain = sfxGain(settings.sfxVolume);
  if (gain <= 0) return;
  resumeCtx();
  sfxBuffer(name, c).then((buf) => {
    try {
      if (!buf) return synthBeep(c, name, gain);
      const src = c.createBufferSource();
      const g = c.createGain();
      src.buffer = buf;
      g.gain.value = gain;
      src.connect(g);
      g.connect(c.destination);
      src.start();
    } catch (e) { /* 音が出せなくても学習は続ける */ }
  });
}

// ---- BGM ----
const B = {
  scene: false, // BGM を流す場面（問題を解いている画面）にいるか
  preview: false, // 設定画面の「試しに聴く」
  el: null,
  gainNode: null,
  track: 0,
  plays: 0,
  loadedTrack: -1,
  urls: new Map(), // 曲の番号 → blob の URL
  starting: false,
  waitingGesture: false,
};

function wantBgm() {
  const s = getSettings();
  return !!(s && s.bgm && (B.scene || B.preview) && !document.hidden);
}

async function trackUrl(i) {
  if (B.urls.has(i)) return B.urls.get(i);
  const res = await fetch(BGM_BASE + BGM_TRACKS[i].file);
  if (!res.ok) throw new Error('bgm ' + res.status);
  const url = URL.createObjectURL(await res.blob());
  B.urls.set(i, url);
  return url;
}

function ensureEl() {
  if (B.el) return B.el;
  const el = new Audio();
  el.preload = 'auto';
  B.el = el;
  const c = audioCtx();
  if (c) {
    try {
      const src = c.createMediaElementSource(el);
      B.gainNode = c.createGain();
      src.connect(B.gainNode);
      B.gainNode.connect(c.destination);
    } catch (e) { B.gainNode = null; }
  }
  el.addEventListener('ended', () => {
    const p = nextBgmPosition(B.track, B.plays + 1);
    B.track = p.track;
    B.plays = p.plays;
    if (p.track === B.loadedTrack) {
      el.currentTime = 0;
      if (wantBgm()) el.play().catch(() => {});
    } else {
      B.loadedTrack = -1;
      startBgm();
    }
  });
  return el;
}

function applyBgmVolume() {
  const s = getSettings();
  const g = bgmGain(s ? s.bgmVolume : undefined);
  if (B.gainNode) B.gainNode.gain.value = g;
  else if (B.el) B.el.volume = Math.min(1, g);
}

async function startBgm() {
  if (B.starting || !wantBgm()) return;
  B.starting = true;
  try {
    const el = ensureEl();
    applyBgmVolume();
    if (B.loadedTrack !== B.track) {
      const url = await trackUrl(B.track);
      if (!wantBgm()) return; // 取っている間に切られた
      el.src = url;
      B.loadedTrack = B.track;
    }
    resumeCtx(); // 待たない（さわる前は、さわるまで終わらないことがある）
    await el.play();
    const c = audioCtx();
    if (c && c.state !== 'running') {
      await Promise.race([c.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
      if (c.state !== 'running') throw new Error('locked'); // 鳴っているように見えて、実際は無音
    }
    B.waitingGesture = false;
  } catch (e) {
    // まだ画面をさわっていない（自動再生の制限）。さわったあとにもう一度。取得に失敗したときも、さわったときに再挑戦する
    if (B.el && !B.el.paused) B.el.pause();
    B.waitingGesture = true;
  } finally {
    B.starting = false;
  }
}

function stopBgm() {
  if (B.el && !B.el.paused) B.el.pause();
}

/** 設定・場面・画面の表裏が変わったら呼ぶ。流すべきなら流し、そうでなければ止める。 */
export function syncBgm() {
  if (wantBgm()) {
    applyBgmVolume();
    if (!B.el || B.el.paused) startBgm();
  } else {
    stopBgm();
  }
}

/** BGM を流す場面（問題を解いている画面）にいるかどうかを伝える。 */
export function setBgmScene(on) {
  B.scene = !!on;
  syncBgm();
}

/** 設定画面の「試しに聴く」。場面と関係なく、BGM がオンのときだけ鳴る。 */
export function setBgmPreview(on) {
  B.preview = !!on;
  syncBgm();
}

/** 音量を変えたとき（BGM は鳴っている最中にそのまま変わる）。 */
export function applyVolumes() {
  applyBgmVolume();
}

/** 起動時に1回。getSettings は「いまの設定」を返す関数（学習記録を消すと設定の入れ物が替わるため）。 */
export function initAudio(settingsGetter) {
  getSettings = settingsGetter;
  const s = getSettings();
  if (s && s.sound) preloadSfx();
  document.addEventListener('visibilitychange', syncBgm);
  const onGesture = () => {
    resumeCtx();
    if (B.waitingGesture || (wantBgm() && (!B.el || B.el.paused))) startBgm();
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((t) => document.addEventListener(t, onGesture, { passive: true }));
}

/** 動作確認用: いまの BGM の状態。 */
export function bgmStatus() {
  return {
    scene: B.scene,
    playing: !!(B.el && !B.el.paused),
    track: B.track,
    plays: B.plays,
    volume: B.gainNode ? B.gainNode.gain.value : B.el ? B.el.volume : null,
    waitingGesture: B.waitingGesture,
  };
}
