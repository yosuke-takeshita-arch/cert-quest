// 真ボス戦（要件定義書 §3-9）。章のボス戦（views/boss.js）と同じ昔の RPG 風の戦闘に、真ボスだけの違いを足す。
//   すべての章のボスを倒すと現れる／全分野から出題（苦手6:それ以外4）／3つの形態（進化するほど難しい）／ボスの技（時間制限・呪い）／
//   ときどきボスが回復／こちらの HP は 3 続けて正解で回復／戦いの最中は解説なし（結果で一覧）／負けたら第1形態から／専用の曲／エンディングとひみつのバッジ。
// 計算は lib/trueboss.js、名前・せりふは lib/trueboss-data.js（data/trueboss.json。無ければ仮）、曲は lib/trueboss-music.js。ここは画面と演出の順番だけ。
// 絵は <アプリ>/images/bosses/true-1.webp 〜 true-3.webp（形態ごとに全身を1枚。置くだけで記号と入れ替わる）。
// 動きを減らす設定（prefers-reduced-motion）では、点滅・揺れ・崩れる動きをやめ、色の変化と文だけにする（CSS と reduced() の両方で）。
import { h, clear, icon, vibrate, beep, toast, mascotLine, appImagesBase, confirmQuit } from '../ui.js';
import { CHARACTER_TEXT } from '../lib/characters.js';
import { shuffleChoices, secondsPerQuestion } from '../lib/quiz.js';
import { BOSS_XP } from '../lib/scoring.js';
import { isCritical, bossMood, BOSS_MOOD_TEXT, CRIT_DAMAGE } from '../lib/boss.js';
import { quoted, faceCrop } from '../lib/bossdata.js';
import {
  trueBossEnabled, trueBossUnlocked, trueBossWords, trueBossLockedText, trueBossWins, trueBossSeenForm2, markTrueBossSeenForm2, STREAK_HEAL, recordTrueBossWin, buildTrueBossPlan, newTrueRun, currentTrueQuestion,
  rollRunSkill, answerTrueRun, isTimedOut, timeLimitFor, SKILL_CURSE_DAMAGE, TRUE_FORMS,
} from '../lib/trueboss.js';
import { normalizeTrueBossData, trueBossForm, pickTrueLine, trueBossImageName, orbStep, EVO_1_TO_2, EVO_2_TO_3, orbTimes, orbRate } from '../lib/trueboss-data.js';
import { trueGeom } from '../lib/trueboss-geom.js';
import { setBgmBoss, startBossTheme, stopBossTheme, playSynth, playBossSfx } from '../audio.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, stemPlainBlock, CHOICE_LABELS } from './explain.js';

export const TRUE_BOSS_SYMBOL = '真';

/** 真ボスの文。現れる条件（章のボスをすべて倒す）は画面に出さない（章のボスと同じ考え）。 */
export const TRUE_BOSS_TEXT = {
  unknownName: '？？？',
  none: 'まだ 戦えません。',
};

/** 最初の問題の上に出す決まりの文。第2形態を見るまでは、形態・進化があることに触れない（要件定義書 §3-9）。 */
export function ruleText(seen2) {
  return 'すべての分野から出ます。正解でボスにダメージ。' + (seen2 ? 'ボスは進化して、だんだん 手ごわくなります。' : '') + STREAK_HEAL + '問続けて正解すると、HP が 1 回復します。戦いの最中は解説が出ません。くわしい解説は、戦いのあとの結果で読めます。';
}

// 絵の上の位置（顔・ひび・目・光の玉）。アプリごと（lib/trueboss-geom.js）。入口・戦いの画面を作るときに、そのアプリのものへ切り替える。
let GEOM = trueGeom('g-kentei');
function useGeom(app) { GEOM = trueGeom(app && app.config && app.config.id); }

/** 真ボスのデータ（名前・せりふ）。app.data.trueBoss が無ければ仮。 */
function dataOf(app) {
  return app.data && app.data.trueBoss ? app.data.trueBoss : normalizeTrueBossData(null);
}

/** 形態ごとの絵の URL。 */
export function trueBossImageUrl(form) {
  return new URL('bosses/' + trueBossImageName(form), appImagesBase()).href;
}

// ---- 形態ごとの絵: 先に読み込み、decode（画面に出せる形にすること）まで済ませておく ----
// 絵を替えるときに、新しい絵がまだ読めていないと、絵の無いときの代わりの記号（四角い枠）や壊れた画像が一瞬出てしまう
// （先生の指摘「形態が変わる時に四角い枠が一瞬出る」）。だから、(1) 戦いを始める前（入口を出したとき・画面を開いたとき）に3枚とも読み込んで decode まで済ませ、
// (2) 絵を替えるのは、新しい絵の decode が済んでから。読み込み中は何も出さない（記号は出さない）。読み込みに失敗したときだけ、記号に替える。
const formImages = new Map(); // 形態 → Promise<decode 済みの img | null>

/** 形態の絵を先に読み込む。decode まで済んだ img（コピー元）で解決する。失敗は null（次に呼んだとき、もう一度読む）。 */
export function preloadFormImage(form) {
  if (!formImages.has(form)) {
    const p = new Promise((resolve) => {
      const img = new Image();
      img.className = 'boss-img';
      img.alt = '';
      img.decoding = 'async';
      img.src = trueBossImageUrl(form);
      if (typeof img.decode === 'function') img.decode().then(() => resolve(img), () => resolve(null));
      else { img.onload = () => resolve(img); img.onerror = () => resolve(null); }
    });
    formImages.set(form, p);
    p.then((v) => { if (!v) formImages.delete(form); });
  }
  return formImages.get(form);
}

export function preloadFormImages() {
  for (let f = 1; f <= TRUE_FORMS; f++) preloadFormImage(f);
}

/** 表示用のコピー（decode まで済ませて返す）。絵が読めなければ null。 */
async function readyImage(form) {
  const src = await preloadFormImage(form);
  if (!src) return null;
  const el = src.cloneNode();
  el.decoding = 'sync';
  try { await el.decode(); } catch (e) { /* 読み込み済みなので、そのまま出す */ }
  return el;
}

/** 小さな丸（顔の切り抜き）。unknown なら絵を読まず「？」。絵が届くまでは、何も出さない（記号は、読み込みに失敗したときだけ）。 */
function fillArt(wrap, form, unknown) {
  wrap.dataset.form = String(form);
  if (unknown) { clear(wrap); wrap.appendChild(h('span', { class: 'boss-sym', text: '？' })); return Promise.resolve(); }
  return readyImage(form).then((img) => {
    if (wrap.dataset.form !== String(form)) return; // 進化したあとに遅れて届いたら捨てる
    clear(wrap);
    if (!img) { wrap.appendChild(h('span', { class: 'boss-sym', text: TRUE_BOSS_SYMBOL })); return; }
    const c = faceCrop(img.naturalWidth, img.naturalHeight, GEOM.face[form]);
    img.style.setProperty('--zoom', String(c.zoom));
    img.style.setProperty('--tx', String(c.tx));
    img.style.setProperty('--ty', String(c.ty));
    wrap.appendChild(img);
  });
}

export function trueBossArt(form, cls) {
  const unknown = String(cls || '').split(' ').includes('unknown');
  const wrap = h('span', { class: 'boss-art ' + (cls || ''), 'aria-hidden': 'true' });
  fillArt(wrap, form, unknown);
  return wrap;
}

/**
 * 全身の絵（戦いの画面）。新しい絵の decode が済んでから、中身を入れ替える（それまでは前の中身のまま。記号は出さない）。
 * 戻り値の Promise は、入れ替えが済んだら解決する。読み込みに失敗したときだけ、記号を出す。
 */
function fillFigure(wrap, form) {
  wrap.dataset.form = String(form);
  return readyImage(form).then((img) => {
    if (wrap.dataset.form !== String(form)) return;
    clear(wrap);
    if (img) { wrap.appendChild(img); wrap.classList.add('has-img'); } else { wrap.classList.remove('has-img'); wrap.appendChild(h('span', { class: 'boss-fig-sym', text: TRUE_BOSS_SYMBOL })); }
  });
}

/** 真ボスに挑む。back は終わったあとに戻る先（無ければ地図）。 */
export function openTrueBoss(app, back) {
  app.trueBossBack = back || null;
  app.go('#/trueboss');
}

/** 真ボスの入口（地図・復習の画面）。真ボスを出さないアプリでは null。現れていなければ影だけ（条件は出さない）。 */
export function trueBossPlace(app, back) {
  if (!trueBossEnabled(app.config)) return null;
  useGeom(app);
  const data = dataOf(app);
  if (!trueBossUnlocked(app.state, app.data.tree.stages)) {
    return h('div', { class: 'card boss-place off', 'data-true-boss-place': 'locked' },
      h('div', { class: 'boss-place-head' }, trueBossArt(1, 'off unknown'),
        h('div', { class: 'boss-place-text' }, h('strong', { text: TRUE_BOSS_TEXT.unknownName }), h('span', { class: 'small muted', text: trueBossLockedText(app.config) }))));
  }
  preloadFormImages(); // 入口を出したときに、3枚の絵を先に読み込む
  const wins = trueBossWins(app.state);
  return h('div', { class: 'card boss-place on' + (wins ? '' : ' cursed'), 'data-true-boss-place': 'on', ...(wins ? {} : { 'data-true-boss-cursed': '1' }) }, // まだ倒していない間は、入口の印を脈打たせて目立たせる（呪われた地図）
    h('div', { class: 'boss-place-head' }, trueBossArt(1, 'on'),
      h('div', { class: 'boss-place-text' }, h('strong', { text: data.name + ' が あらわれた！' }),
        h('span', { class: 'small', text: trueBossWords(app.config).place + 'の 真ボス。すべての分野から出ます' }),
        wins ? h('span', { class: 'small muted', text: 'たおした回数 ' + wins + ' 回' }) : null)),
    h('button', { class: 'btn primary big', type: 'button', 'data-true-boss-go': '1', onClick: () => openTrueBoss(app, back) }, '真ボスに挑む'));
}

/**
 * ひびの層。絵（.boss-fig。絵と同じ大きさの箱）の上に、絵と同じ正方形（viewBox 0 0 100 100）の SVG を重ねる。
 * ひびの形は TRUE_CRACKS（絵の中の割合）。画面の幅・文字の大きさが変わっても、絵と一緒に拡大縮小するのでずれない。
 */
function buildCrackLayer(fig) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'tb-crack-layer');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-tb-cracks', '1');
  const lines = GEOM.cracks.map((d) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    p.setAttribute('class', 'tb-crack-line');
    svg.appendChild(p);
    return p;
  });
  const eye = document.createElementNS(NS, 'ellipse'); // 一つ目が再び青白く光る
  eye.setAttribute('cx', String(GEOM.eye.x));
  eye.setAttribute('cy', String(GEOM.eye.y));
  eye.setAttribute('rx', String(GEOM.eye.rx));
  eye.setAttribute('ry', String(GEOM.eye.ry));
  eye.setAttribute('class', 'tb-eye-glow');
  svg.appendChild(eye);
  fig.appendChild(svg);
  return { svg, lines, eye };
}

/** 第2→3の進化の光の玉の層。絵（.boss-fig）と同じ正方形の SVG に、TRUE_ORBS の位置（絵の中の割合）で金色の玉を重ねる。1つずつ on を付けて灯す。 */
function buildOrbLayer(fig) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'tb-orb-layer');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-tb-orbs', '1');
  const orbs = GEOM.orbs.map((o) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(o.x));
    c.setAttribute('cy', String(o.y));
    c.setAttribute('r', String(o.r));
    c.setAttribute('class', 'tb-orb');
    svg.appendChild(c);
    return c;
  });
  fig.appendChild(svg);
  return { svg, orbs };
}

/** きらきらした粒の層。絵と同じ正方形の SVG に、緑・白の小さな粒をまぶす（上へ昇りながら消える）。粒の位置は体の範囲（絵の中の割合）。 */
function buildSparkLayer(fig) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'tb-spark-layer');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-tb-spark', '1');
  const colors = ['#9dffb0', '#5fe37a', '#ffffff', '#c8ffd4'];
  for (let k = 0; k < 36; k++) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', (14 + Math.random() * 72).toFixed(1));
    c.setAttribute('cy', (20 + Math.random() * 70).toFixed(1));
    c.setAttribute('r', (1.3 + Math.random() * 1.4).toFixed(2));
    c.setAttribute('fill', colors[k % colors.length]);
    c.setAttribute('class', 'tb-spark');
    c.style.setProperty('--delay', (Math.random() * 0.6).toFixed(2) + 's');
    c.style.setProperty('--dur', (0.8 + Math.random() * 0.6).toFixed(2) + 's');
    svg.appendChild(c);
  }
  fig.appendChild(svg);
  return svg;
}

const rand = (a, b) => a + Math.random() * (b - a);

export function renderTrueBoss(app) {
  useGeom(app);
  const root = h('section', { class: 'view boss true-boss' });
  const back = app.trueBossBack || '#/map';
  app.trueBossBack = null;
  const data = dataOf(app);
  if (trueBossEnabled(app.config) && trueBossUnlocked(app.state, app.data.tree.stages)) preloadFormImages(); // 3形態の絵を先に読み込む（戦いの途中で絵を替えるとき、待たずに済むように）
  if (!trueBossEnabled(app.config) || !trueBossUnlocked(app.state, app.data.tree.stages)) {
    root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go(back) }, '← 戻る'));
    root.appendChild(h('h1', { text: TRUE_BOSS_TEXT.unknownName }));
    root.appendChild(h('div', { class: 'card empty', 'data-true-boss-none': '1' }, h('p', { text: trueBossLockedText(app.config) })));
    return root;
  }
  const limit = secondsPerQuestion(app.config);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let S = null; // 戦いの状態
  let ui = null; // 画面の部品
  let keyHandler = null;
  let timers = [];
  let typing = null; // いま出している文（{ finish }）
  let miniWatch = null;
  let textWatch = null;
  let tick = null; // 時間制限の技の、残り時間を数える setInterval

  const later = (fn, ms) => {
    const id = setTimeout(() => { timers = timers.filter((x) => x !== id); fn(); }, ms);
    timers.push(id);
    return id;
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const stopTick = () => { if (tick) clearInterval(tick); tick = null; };

  const battle = () => S.run.battle;
  const prof = () => trueBossForm(data, battle().form);
  const skillInfo = (kind) => data.skills[kind];

  const cleanup = () => {
    if (followOff) followOff();
    clearTimers();
    stopTick();
    typing = null;
    if (miniWatch) miniWatch.disconnect();
    miniWatch = null;
    if (textWatch) textWatch.disconnect();
    textWatch = null;
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    document.body.classList.remove('boss-on');
    stopBossTheme();
    setBgmBoss(false); // ほかの BGM に戻す
  };

  // 戦いを始める。全分野の問題から3つの形態ぶんを組み立てる。1つの形態でも空になる（問題が少なすぎる）ときは false
  function begin() {
    const plan = buildTrueBossPlan(app.data.questions, app.state.qstats, { rng: app.rng });
    if (plan.forms.some((f) => !f.length)) return false;
    S = { run: newTrueRun(plan, app.rng), plan, streak: 0, xp: 0, log: [], answered: false, t0: 0, recorded: false, wins: 0, phase: 'intro', appeared: false, item: null, skipFx: null, endingShown: false };
    return true;
  }

  function leave() {
    cleanup();
    app.go(back);
  }

  const askExit = () => !(S && !battle().result && S.log.length) || confirmQuit('途中で終了します。ここまでの回答の記録は残ります。やり直すときは' + (trueBossSeenForm2(app.state) ? '第1形態から' : '最初から') + 'です。');
  app.guardBack(askExit);

  async function onExit() {
    if (!(await askExit())) return;
    leave();
  }

  // ---- 1文字ずつ出る文（窓の中） ----
  function say(lines, opts = {}) {
    if (typing) typing.finish();
    if (!opts.keep) clear(ui.text);
    const list = lines.filter(Boolean).map((l) => Array.from(l));
    ui.live.textContent = lines.filter(Boolean).join(' ');
    let li = 0;
    let ci = 0;
    let p = null;
    let tid = null;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      if (typing === me) typing = null;
      ui.text.classList.add('typed');
      if (opts.onDone) opts.onDone();
    };
    const me = {
      finish() {
        clearTimeout(tid);
        for (; li < list.length; li++, ci = 0, p = null) {
          if (!p) { p = h('p', { class: 'boss-line' }); ui.text.appendChild(p); }
          p.textContent = list[li].join('');
        }
        end();
      },
    };
    typing = me;
    ui.text.classList.remove('typed');
    if (opts.instant || reduced()) { me.finish(); return; }
    const step = () => {
      if (li >= list.length) { end(); return; }
      if (!p) { p = h('p', { class: 'boss-line' }); ui.text.appendChild(p); }
      ci++;
      p.textContent = list[li].slice(0, ci).join('');
      if (ci >= list[li].length) { li++; ci = 0; p = null; tid = setTimeout(step, 200); } else tid = setTimeout(step, 26);
    };
    tid = setTimeout(step, 26);
  }

  // ---- 自分の体力 ----
  // gainAt … 増えたばかりのハートの番号（緑に光る）。割れる動き（crackAt）とは別
  function paintHp(b, crackAt, gainAt) {
    [ui.hp, ui.miniHp].forEach((box) => {
      if (!box) return;
      clear(box);
      const hearts = h('span', { class: 'boss-hearts', role: 'img', 'aria-label': 'あなたの体力 ' + b.player + '／' + b.playerMax });
      for (let i = 0; i < b.playerMax; i++) hearts.appendChild(icon('heart', 'heart ' + (i < b.player ? 'on' : 'off') + (i === crackAt ? ' crack' : '') + (i === gainAt ? ' gain' : '')));
      box.appendChild(h('span', { class: 'boss-hp-label', 'aria-hidden': 'true', text: 'HP ' + b.player }));
      box.appendChild(hearts);
    });
  }

  function flash(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    later(() => el.classList.remove(cls), ms);
  }
  function figFlash(cls, ms) {
    flash(ui.fig, cls, ms);
    flash(ui.miniArt, cls, ms);
  }
  function figClass(op, ...names) {
    [ui.fig, ui.miniArt].forEach((el) => { if (el) el.classList[op](...names); });
  }

  // 画面いっぱい（position: fixed）の光・光の筋・輪は、絵の位置（画面の座標）を中心にする。進化の最中に画面をスクロールしても、絵と一緒に動くように、
  // スクロール・画面の大きさが変わるたびに中心を絵に合わせ直す（絵が画面の外に出れば、輪も一緒に外へ行く）。
  let followOff = null;
  function followFig() {
    const place = () => {
      if (!ui || !ui.fig || !ui.fig.isConnected) return;
      const r = ui.fig.getBoundingClientRect();
      root.querySelectorAll('.tb-rays, .tb-ring, .tb-gold-flash').forEach((e) => {
        e.style.setProperty('--cx', Math.round(r.left + r.width / 2) + 'px');
        e.style.setProperty('--cy', Math.round(r.top + r.height * 0.45) + 'px');
      });
    };
    if (followOff) followOff();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    followOff = () => { window.removeEventListener('scroll', place); window.removeEventListener('resize', place); followOff = null; };
    return place;
  }

  function atTop(fn) {
    if (reduced()) { window.scrollTo(0, 0); fn(); return; }
    if (window.scrollY <= 1) { fn(); return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const t0 = Date.now();
    const poll = () => { if (window.scrollY <= 1 || Date.now() - t0 > 1500) fn(); else later(poll, 30); };
    later(poll, 30);
  }

  // ---- 上の帯 ----
  function miniSync() {
    if (!ui || !ui.miniText) return;
    const last = ui.text.lastElementChild;
    if (last && last.textContent) ui.miniText.textContent = last.textContent;
  }
  function watchStage() {
    if (typeof IntersectionObserver !== 'function') return;
    miniWatch = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      ui.mini.classList.toggle('on', e.intersectionRatio < 0.5);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    miniWatch.observe(ui.stage);
  }

  const roundLabel = () => (battle().form > 1 ? '真ボス・第' + battle().form + '形態' : '真ボス');

  // いまの形態の名前・色・絵を、画面に反映する（始まりと、進化のとき）
  function paintForm() {
    const p = prof();
    ui.nameEl.textContent = p.name;
    // 最初に会うときは形態があることを伏せる（第1形態のあいだは札を出さない。進化してから『第2形態』を出す。要件定義書 §3-9）
    ui.formEl.textContent = battle().form > 1 ? '第' + battle().form + '形態' : '';
    ui.formEl.classList.toggle('hidden', battle().form === 1);
    const rd = ui.qarea.querySelector('.boss-round');
    if (rd) rd.textContent = roundLabel();
    ui.miniName.textContent = p.name;
    ui.stage.style.setProperty('--boss-color', p.color);
    ui.mini.style.setProperty('--boss-color', p.color);
    ui.float.classList.toggle('f2', battle().form === 2); // 第2・第3形態だけ、ゆっくり上下に浮かぶ（第1形態は動かさない）
    ui.float.classList.toggle('f3', battle().form === 3);
    ui.fig.style.setProperty('--boss-color', p.color);
    // 絵は、新しい絵の decode が済んでから替わる（それまでは、前の中身のまま。記号は出さない）。戻り値は、替わったら解決する
    return Promise.all([fillFigure(ui.fig, battle().form), fillArt(ui.miniArt, battle().form, false)]);
  }

  // ---- 画面の骨組み ----
  function buildScreen() {
    clear(root);
    root.classList.add('boss-rpg');
    document.body.classList.add('boss-on');
    const fig = h('div', { class: 'boss-fig', 'aria-hidden': 'true', 'data-boss-fig': '1' });
    const fx = h('div', { class: 'boss-fx', 'aria-hidden': 'true' });
    const confetti = h('div', { class: 'boss-confetti', 'aria-hidden': 'true' });
    const flashEl = h('div', { class: 'boss-flash', 'aria-hidden': 'true' });
    // 浮かぶ動きは、絵（fig）の外側の入れ物（float）に付ける。ダメージの点滅・揺れ・進化・崩れは fig に付くので、重なっても位置がずれず止まらない
    const floatEl = h('div', { class: 'tb-float', 'data-tb-float': '1' }, fig);
    const stageEl = h('div', { class: 'boss-stage', 'data-boss-stage': '1', onClick: onTap }, floatEl, fx, confetti, flashEl);
    const text = h('div', { class: 'boss-win-text', 'aria-hidden': 'true' });
    const live = h('p', { class: 'boss-sr', role: 'status' });
    const hp = h('span', { class: 'boss-win-hp' });
    const extra = h('div', { class: 'boss-win-extra' });
    const nameEl = h('strong', { class: 'boss-win-name' });
    const formEl = h('span', { class: 'chip tb-form', 'data-tb-form': '1' });
    const win = h('div', { class: 'boss-window', 'data-boss-window': '1', onClick: onTap },
      h('div', { class: 'boss-win-head' }, h('span', { class: 'tb-head-name' }, nameEl, formEl), hp), text, extra, live);
    const top = h('div', { class: 'boss-top' },
      h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': '終了する', 'data-boss-exit': '1', onClick: onExit }, icon('close')),
      h('span', { class: 'small boss-chapter', text: '真ボス（すべての分野）' }));
    const qarea = h('div', { class: 'boss-qarea' });
    const after = h('div', { class: 'after' });
    const scene = h('div', { class: 'boss-scene' }, stageEl, win);
    const miniArt = h('span', { class: 'boss-art mini', 'aria-hidden': 'true' });
    const miniHp = h('span', { class: 'boss-mini-hp' });
    const miniTextEl = h('span', { class: 'boss-mini-text' });
    const miniName = h('strong', { class: 'boss-mini-name' });
    const mini = h('div', { class: 'boss-mini', 'data-boss-mini': '1', 'aria-hidden': 'true' }, miniArt,
      h('div', { class: 'boss-mini-body' }, h('div', { class: 'boss-mini-row' }, miniName, miniHp), miniTextEl),
      h('span', { class: 'boss-mini-flash' }));
    [top, scene, qarea, after, mini].forEach((n) => root.appendChild(n));
    for (let k = 0; k < 56; k++) {
      const s = h('span', { class: 'confetti c' + (k % 5) });
      s.style.left = Math.round(Math.random() * 100) + '%';
      s.style.setProperty('--delay', (Math.random() * 0.9).toFixed(2) + 's');
      s.style.setProperty('--dur', (1.6 + Math.random() * 1.4).toFixed(2) + 's');
      s.style.setProperty('--sway', Math.round(Math.random() * 120 - 60) + 'px');
      confetti.appendChild(s);
    }
    ui = { scene, stage: stageEl, float: floatEl, fig, fx, confetti, flash: flashEl, text, live, hp, extra, win, qarea, after, btns: [], mini, miniArt, miniHp, miniText: miniTextEl, miniName, nameEl, formEl };
    paintForm();
    paintHp(battle());
    if (miniWatch) miniWatch.disconnect();
    if (textWatch) textWatch.disconnect();
    watchStage();
    if (typeof MutationObserver === 'function') {
      textWatch = new MutationObserver(miniSync);
      textWatch.observe(text, { childList: true, characterData: true, subtree: true });
    }
  }

  function onTap() {
    if (!S) return;
    if (S.phase === 'intro') finishIntro();
    else if ((S.phase === 'defeat' || S.phase === 'evolve') && S.skipFx) S.skipFx();
    else if (typing) typing.finish();
    else if (S.healWait) S.healWait(); // 回復のページを待っているとき、窓のタップで次のページへ
  }

  // ---- 登場の演出 ----
  function startIntro() {
    S.phase = 'intro';
    S.appeared = false;
    ui.stage.classList.add('dark');
    ui.fig.classList.add('unseen');
    clear(ui.qarea);
    ui.qarea.appendChild(h('button', { class: 'btn small-btn boss-skip', type: 'button', 'data-boss-skip': '1', onClick: finishIntro }, 'とばす（タップでもとばせます）'));
    setBgmBoss(true);
    if (reduced()) { later(appear, 250); return; }
    [500, 750, 1000].forEach((t) => {
      later(() => ui.flash.classList.add('on'), t);
      later(() => ui.flash.classList.remove('on'), t + 110);
    });
    later(appear, 1300);
  }

  function appear(instant) {
    if (S.appeared) return;
    S.appeared = true;
    ui.stage.classList.remove('dark');
    ui.fig.classList.remove('unseen');
    ui.flash.classList.remove('on');
    if (!instant && !reduced()) flash(ui.fig, 'appear', 700);
    if (!instant) playSynth(app.state.settings, 'appear');
    startBossTheme(1);
    say([prof().name + ' が あらわれた！', quoted(pickTrueLine(prof(), 'appear', app.rng))], { instant, onDone: () => { if (S.phase === 'intro') later(finishIntro, 300); } });
  }

  function finishIntro() {
    if (!S || S.phase !== 'intro') return;
    S.phase = 'question';
    clearTimers();
    appear(true);
    if (typing) typing.finish();
    ui.fig.classList.remove('appear');
    drawQuestion();
  }

  // ---- 技の表示（問題の上の帯と、時間制限の残り） ----
  function skillBanner(skill, q) {
    const info = skillInfo(skill.kind);
    const lim = timeLimitFor(skill, q, limit); // その問題の秒数（問題の長さで変わる）
    const rule = skill.kind === 'timed' ? '1問 ' + lim + ' 秒以内（時間切れは不正解）' : 'まちがえると HP が ' + SKILL_CURSE_DAMAGE + ' へる';
    const box = h('div', { class: 'tb-skill', role: 'status', 'data-tb-skill': skill.kind },
      h('strong', { class: 'tb-skill-name', text: info.name }),
      h('span', { class: 'tb-skill-turns', 'data-tb-skill-turns': String(skill.turns), text: '残り ' + skill.turns + ' ターン' }),
      h('span', { class: 'small tb-skill-rule', text: rule }));
    if (skill.kind === 'timed') {
      const left = h('span', { class: 'tb-timer-text', 'data-tb-timer': '1', text: '残り ' + lim + ' 秒' });
      const fill = h('span', { class: 'tb-timer-fill' });
      box.appendChild(h('div', { class: 'tb-timer', 'aria-hidden': 'true' }, fill));
      box.appendChild(left);
      ui.timer = { left, fill };
    } else ui.timer = null;
    return box;
  }

  function startTimer() {
    stopTick();
    const lim = timeLimitFor(battle().skill, S.item.q, limit);
    if (lim === null || !ui.timer) return;
    const tm = ui.timer;
    const t0 = S.t0;
    const paint = () => {
      const left = Math.max(0, lim - (Date.now() - t0) / 1000);
      tm.left.textContent = '残り ' + Math.ceil(left) + ' 秒';
      tm.fill.style.setProperty('--left', String(left / lim));
      tm.left.classList.toggle('low', left <= 5);
      if (left <= 0 && S && S.phase === 'question' && !S.answered) answer(null, true);
    };
    paint();
    tick = setInterval(paint, 200);
  }

  // ---- 1問 ----
  function drawQuestion() {
    clear(ui.qarea);
    clear(ui.after);
    stopTick();
    // 問題を出す前に、ボスが技を使ってくるか
    const rolled = rollRunSkill(S.run, app.rng);
    S.run = rolled.run;
    const q0 = currentTrueQuestion(S.run);
    if (!q0) { endBattle(); return; }
    const sq = shuffleChoices(q0, app.rng);
    S.item = sq;
    S.answered = false;
    S.phase = 'question';
    const q = sq.q;
    const skill = battle().skill;
    if (rolled.started) {
      playSynth(app.state.settings, 'skill');
      const sl = quoted(pickTrueLine(prof(), rolled.started === 'timed' ? 'skillTimer' : 'skillDouble', app.rng)) || skillInfo(rolled.started).line;
      say([prof().name + ' は ' + skillInfo(rolled.started).name + ' を つかった！', sl]);
    }
    ui.qarea.appendChild(h('div', { class: 'play-head boss-qhead' },
      h('span', { class: 'small muted boss-round', text: roundLabel() })));
    if (skill) ui.qarea.appendChild(skillBanner(skill, q)); else ui.timer = null;
    if (!S.log.length) ui.qarea.appendChild(h('p', { class: 'small muted boss-rule', text: ruleText(trueBossSeenForm2(app.state)) }));
    const card = h('div', { class: 'card q-card' });
    const tags = h('div', { class: 'q-tags' }, h('span', { class: 'chip', text: q.syllabus.slice(1, 3).join(' › ') || q.syllabus[0] }), statusChip(q.status));
    if (q.negative) tags.appendChild(h('span', { class: 'chip warn', text: '適切でないものを選ぶ' }));
    if (q.format === 'scenario') tags.appendChild(h('span', { class: 'chip', text: '場面問題' }));
    if (q.format === 'combo') tags.appendChild(h('span', { class: 'chip', text: '組み合わせ' }));
    card.appendChild(tags);
    card.appendChild(h('p', { class: 'stem', text: q.stem }));
    const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '選択肢' });
    ui.btns = sq.choices.map((c, i) => {
      const bt = h('button', { class: 'choice', type: 'button', 'data-boss-choice': String(i), onClick: () => answer(i) },
        h('span', { class: 'mark', 'aria-hidden': 'true', text: CHOICE_LABELS[i] }), h('span', { class: 'ctext', text: c }));
      choices.appendChild(bt);
      return bt;
    });
    card.appendChild(choices);
    ui.qarea.appendChild(card);
    S.t0 = Date.now();
    startTimer();
    if (S.log.length) window.scrollTo(0, 0);
  }

  // chosen … 選んだ番号（時間切れは null）。timedOut … 時間切れで自動的に不正解にしたとき
  function answer(chosen, timedOut = false) {
    if (!S || S.phase !== 'question' || S.answered) return;
    S.answered = true;
    stopTick();
    const sq = S.item;
    const before = battle();
    const seconds = (Date.now() - S.t0) / 1000;
    const late = !!timedOut || isTimedOut(before.skill, seconds, sq.q, limit);
    const correct = !late && chosen !== null && chosen === sq.answer;
    S.streak = correct ? S.streak + 1 : 0;
    const r = app.recordAnswer(sq.q, { correct, seconds, sessionStreak: S.streak, limit, xpMul: BOSS_XP.trueMul }); // 今日の復習の枠（review）には数えない。真ボスは1問の XP が 2 倍
    S.xp += r.xp;
    const crit = isCritical(correct, seconds, app.rng);
    const res = answerTrueRun(S.run, { correct, damage: crit ? CRIT_DAMAGE : 1, timedOut: late }, app.rng);
    S.run = res.run;
    const ev = res.events;
    const b = battle();
    if (b.result === 'win' && !S.winBonus) { S.winBonus = BOSS_XP.trueWin; S.xp += S.winBonus; app.addXp(S.winBonus); } // 撃破のごほうび（勝った1回だけ。負けたときは無い）
    S.log.push({ q: sq.q, sq, correct, chosen, form: before.form, late, skill: before.skill ? before.skill.kind : null });
    paintHp({ ...b, player: b.player - (ev.playerHealed ? 1 : 0) }, -1); // 自分の回復は、あとのページで増やす（それまではハートを増やさない）
    const { btns, after } = ui;
    // 戦いの最中は、合っていたか・違っていたかだけ。正解の選択肢は教えない（解説は結果で）
    btns.forEach((bt, i) => {
      bt.disabled = true;
      const mine = i === chosen;
      bt.classList.toggle('ok', mine && correct);
      bt.classList.toggle('ng', mine && !correct);
      const mark = bt.querySelector('.mark');
      if (mine) mark.textContent = correct ? '✓' : '✗';
    });
    const note = correct
      ? (crit ? '会心の一撃！' : 'ボスに ダメージ')
      : b.result === 'lose' ? 'HP がなくなりました' : late ? '時間切れ。HP が ' + ev.lost + ' へりました' : 'HP が ' + ev.lost + ' へりました';
    after.appendChild(h('div', { class: 'verdict ' + (correct ? 'ok' : 'ng'), role: 'status', 'data-boss-verdict': correct ? 'ok' : 'ng' },
      h('strong', { text: correct ? '正解！' : late ? '時間切れ…' : '残念…' }),
      correct ? h('span', { class: 'xp', text: '+' + r.xp + ' XP' }) : null,
      h('span', { class: 'small', text: note }),
      r.leveledUp ? h('span', { class: 'levelup', text: 'レベルアップ！ Lv ' + r.levelAfter }) : null));
    after.appendChild(h('p', { class: 'small muted tb-noexp', text: '解説は、戦いのあとの結果で読めます。' }));
    vibrate(app.state.settings, correct ? (crit ? [30, 30, 60] : 30) : [60, 40, 60]);
    if (correct) beep(app.state.settings, 'ok');
    const finalState = b.result || ev.evolved;
    const pagesAfter = !finalState && !!(ev.playerHealed || ev.bossHealed); // 答えのあとに回復のページが続くか（撃破・進化の演出のときは、これまでどおり別の形）
    const next = h('button', { class: 'btn primary big next', type: 'button', 'data-boss-next': '1', onClick: () => {
      if (next.getAttribute('aria-disabled') === 'true') { onTap(); return; } // 回復のページが残っている間は、押しても先へ進まない。窓のタップと同じに、次のページへ進める（演出を飛ばさない）
      if (typing) typing.finish();
      if (b.result) endBattle(); else drawQuestion();
    } },
      b.result === 'win' ? 'つづき' : b.result ? '結果を見る' : '次の問題へ');
    const bar = h('div', { class: 'sticky-bar' }, next);
    after.appendChild(bar);
    if (b.result === 'win' || ev.evolved) bar.classList.add('hidden'); // 撃破・進化の演出が終わるまで、先へ進むボタンは出さない（タップでとばせる）
    else if (!pagesAfter) next.focus({ preventScroll: true });
    // 答えのあとに続くページ（自分の回復・ボスの回復）がある間は、ボタンを薄くして押せない形にする（aria-disabled。最後のページの演出が終わったら押せる）
    if (pagesAfter) { next.classList.add('wait'); next.setAttribute('aria-disabled', 'true'); }
    const releaseNext = () => {
      if (!S || S.item !== sq || !next.isConnected) return;
      next.classList.remove('wait');
      next.removeAttribute('aria-disabled');
      next.focus({ preventScroll: true });
    };

    const oldProfile = trueBossForm(data, before.form);
    const perform = () => {
      if (!S || S.item !== sq || !ui || !ui.stage.isConnected) return;
      if (correct) playBossSfx(app.state.settings, crit && !finalState ? 'crit' : 'hit');
      const lines = [];
      if (correct) {
        if (b.result !== 'win' && !ev.evolved) {
          figFlash('hit', 700);
          if (crit) { flash(ui.stage, 'crit', 450); flash(ui.mini, 'crit', 450); }
          lines.push(...(crit ? ['会心の一撃！', oldProfile.name + ' に ダメージ！'] : [oldProfile.name + ' に ダメージ！', quoted(pickTrueLine(oldProfile, 'hurt', app.rng))]));
          lines.push(BOSS_MOOD_TEXT[bossMood(b)]);
        }
      } else {
        playBossSfx(app.state.settings, 'hurt');
        if (ev.lost) paintHp(b, b.player);
        flash(ui.stage, 'hurt', 500);
        flash(ui.mini, 'hurt', 500);
        flash(ui.scene, 'quake', 450);
        lines.push(oldProfile.name + ' の こうげき！', quoted(pickTrueLine(oldProfile, 'attack', app.rng)));
        if (late) lines.push('じかんぎれ！');
        lines.push(b.result === 'lose' ? 'あなたは たおれてしまった…' : 'あなたは ' + ev.lost + ' ダメージを うけた！');
        if (b.result === 'lose') lines.push(quoted(pickTrueLine(oldProfile, 'gloat', app.rng)));
      }
      if (ev.skillEnded && !ev.evolved && b.result !== 'win') lines.push(skillInfo(ev.skillEnded).name + ' の ちからが きえた。');
      if (b.result === 'win' || ev.evolved) paintHp(b, -1); // 進化・撃破のときは、回復をページにせず、ハートをそのまま出す
      if (b.result === 'win') defeatSequence(bar, next, ev);
      else if (ev.evolved) evolveSequence(ev, bar, next);
      else if (ev.playerHealed || ev.bossHealed) {
        // 回復は、ダメージの文が出終わってから、窓を新しいページにして1つずつ出す（要件定義書 §3-9『ボスの回復の見せ方』『自分の回復の見せ方』）。
        // 同じ答えで両方起きたら、自分の回復 → ボスの回復の順。
        // ページの送り方: ダメージの文が出終わると ▼ が出て、窓をタップするか、約1.4秒たつと、前の文を消して次のページになる。
        const pages = [];
        if (ev.playerHealed) {
          pages.push(() => {
            playerHealEffect(b); // ハートを1つ増やして緑に光らせる（それまでは増やさない）+ 自分の回復の音
            say(['あなたの きずが すこし いえた。', quoted(pickTrueLine({ lines: { x: data.playerHeal } }, 'x', app.rng))], { onDone: arm });
          });
        }
        if (ev.bossHealed) {
          pages.push(() => {
            healEffect(); // 緑の光ときらきら + 回復の音（同時）
            say([oldProfile.name + ' は 傷を癒やした！', quoted(pickTrueLine(oldProfile, 'heal', app.rng))], { onDone: arm });
          });
        }
        const turnPage = () => {
          if (!S.healWait || S.item !== sq || !ui || !ui.stage.isConnected || !pages.length) return;
          S.healWait = null;
          pageAt = Date.now();
          pages.shift()();
        };
        let pageAt = 0;
        function arm() {
          if (S.item !== sq) return;
          if (!pages.length) { later(releaseNext, Math.max(0, HEAL_FX_MS - (Date.now() - pageAt))); return; } // 最後のページ: 文が出終わり、回復の演出（約1.5秒）も終わってから、ボタンを押せるようにする
          S.healWait = turnPage;
          later(turnPage, 1400);
        }
        say(lines, { onDone: arm });
      } else {
        say(lines);
        if (b.result === 'lose') stopBossTheme();
      }
    };
    atTop(perform);
  }

  const HEAL_FX_MS = 1500; // 回復の演出（光・ハートの光）の長さ

  // ---- 自分の回復の見せ方: 戻るハート1つを緑に光らせて増やす（上の帯のハートも同じ）+ 自分の回復の音（フック playerheal）。それまでハートは増やさない ----
  function playerHealEffect(b) {
    playBossSfx(app.state.settings, 'playerheal');
    paintHp(b, -1, b.player - 1); // b.player は回復後。増えたハート（左から b.player 番目）が緑に光る
    later(() => { [ui.hp, ui.miniHp].forEach((box) => { if (box) box.querySelectorAll('.gain').forEach((e) => e.classList.remove('gain')); }); }, 1500); // 光は約1.5秒で、ふつうの赤に戻る
  }

  // ---- ボスの回復の見せ方: 絵の形に沿った緑の光 + きらきらした粒（絵の箱に重ねる。四角い面は使わない）+ 回復の音（フック heal）。約1.4秒 ----
  function healEffect() {
    playBossSfx(app.state.settings, 'heal'); // 回復の音のフック（素材のファイル trueheal が無い間は、プログラムの音）
    figClass('add', 'healing'); // 絵のふちに沿って緑に光る（動きを減らす設定では、緑の色の変化だけ）
    const layer = reduced() ? null : buildSparkLayer(ui.fig);
    later(() => { figClass('remove', 'healing'); if (layer) layer.remove(); }, 1500);
  }

  // ---- 進化の演出（白く光る → 点滅 → 次の形態の姿に替わって現れる → せりふ。タップでとばせる） ----
  // 進化の効果音のフック（要件定義書 §3-9）。名前: heartbeat（鼓動）・rumble（地鳴り）・crack1/crack2（ひび）・shatter1/shatter2（割れる）・orb（光の玉が灯る。i 番目ほど高い）・charge（力をためる）・impact（大きな衝撃）。
  // 素材のファイルが無い間は、プログラムの音（無ければ無音）で鳴る（lib/sound.js の BOSS_SFX・lib/trueboss-music.js の TRUE_SFX）。
  function evoSfx(name, i = 0, boost = 1) {
    if (name === 'orb') playBossSfx(app.state.settings, 'orb', 1, orbRate(i, GEOM.orbs.length), 'orb' + orbStep(i, GEOM.orbs.length)); // ファイルは再生速度で高くする。無いときはプログラムの音
    else playBossSfx(app.state.settings, name, boost);
  }

  function evolveSequence(ev, bar, next) {
    S.phase = 'evolve';
    stopBossTheme();
    const R = reduced();
    const oldP = trueBossForm(data, ev.evolved.from);
    const from1 = ev.evolved.from === 1;
    const T = from1 ? EVO_1_TO_2 : EVO_2_TO_3; // 時刻の表（lib/trueboss-data.js）
    let done = false;
    let swapped = false;
    let musicStarted = false;
    const startMusic = () => { if (musicStarted) return; musicStarted = true; startBossTheme(battle().form); };
    const cleanupFx = () => {
      root.classList.remove('tb-dim');
      ui.float.classList.remove('still');
      root.classList.remove('tb-rays-on');
      root.querySelectorAll('.tb-gold-flash, .tb-rays, .tb-ring').forEach((e) => e.remove());
      if (followOff) followOff();
    };
    const swap = (immediate) => {
      if (swapped) return;
      swapped = true;
      if (markTrueBossSeenForm2(app.state)) app.commit(); // 第2形態を見た（これ以降、『形態』を画面に出してよい）
      ui.float.classList.remove('still');
      root.classList.remove('tb-dim');
      paintHp(battle(), -1);
      // 新しい絵の decode が済んでから、前の絵を消して（gone などを外して）新しい絵を出す。済む前に外すと、前の絵や記号の枠が一瞬出る
      paintForm().then(() => {
        figClass('remove', 'glow', 'blinkoff', 'gone', 'shake', 'slump', 'revive', 'swell');
        // 形態が替わったら曲も替える。第3形態は、決めぜりふのあとに曲を始める（第2形態は、すぐ）
        if (immediate || from1) startMusic(); else later(startMusic, T.music - T.swap);
        if (!R) flash(ui.fig, from1 ? 'emerge' : 'spread3', from1 ? 1000 : 1800); // 第3形態は、現れてから約1.8秒、明るく光ってから落ち着く
      });
    };
    const newP = () => prof();
    const lines = () => [oldP.name + ' は しんかした！', quoted(pickTrueLine(oldP, 'evolve', app.rng)), newP().name + ' が あらわれた！', quoted(pickTrueLine(newP(), 'appear', app.rng))];
    const finish = () => {
      if (done) return;
      done = true;
      clearTimers();
      ui.fx.textContent = '';
      ui.flash.classList.remove('on');
      cleanupFx();
      swap(true);
      startMusic(); // タップで飛ばしたとき、曲の予約も消えているので、ここで始める
      S.skipFx = null;
      S.phase = 'evolved';
      say(lines(), { instant: true });
      bar.classList.remove('hidden');
      next.focus({ preventScroll: true });
    };
    S.skipFx = finish;
    const crackLayer = from1 && !R ? buildCrackLayer(ui.fig) : null; // ひびは絵（fig）の上に重ねる。絵と同じ正方形の座標で決める
    const orbLayer = !from1 ? buildOrbLayer(ui.fig) : null; // 光の玉も同じ（絵の箱に重ねる）
    const at = (t, fn) => later(fn, t);
    const finishText = (t) => at(t, () => {
      if (done) return;
      say(lines(), { onDone: () => { if (S.phase === 'evolve') { done = true; S.skipFx = null; S.phase = 'evolved'; bar.classList.remove('hidden'); next.focus({ preventScroll: true }); } } });
    });
    if (R) {
      // 動きを減らす設定: 点滅・揺れ・光の動きなし。色（暗い灰色／金色の玉）と文と音だけ
      if (from1) {
        say([oldP.name + ' を たおした！', quoted(pickTrueLine(oldP, 'defeat', app.rng))], { instant: true });
        figClass('add', 'slump'); // 色（暗い灰色）だけ。動きは無い
        later(() => { figClass('remove', 'slump'); evoSfx('shatter1'); evoSfx('shatter2'); finish(); }, 1200);
        return;
      }
      orbLayer.orbs.forEach((o) => o.classList.add('on')); // 玉は最初から全部金色（動かない）
      say(['……'], { instant: true });
      // 光は点滅させず、ゆっくり明るくなって引く（回る光の筋・光の輪は出さない）。いちばん明るいときに、姿を替える
      later(() => { root.appendChild(h('div', { class: 'tb-gold-flash calm', 'aria-hidden': 'true' })); evoSfx('impact'); evoSfx('finalhit'); }, 1200);
      later(finish, 2100);
      return;
    }
    if (from1) {
      // 偽の撃破（章のボスの撃破と同じく、白く光って「たおした！」とせりふ。ただし粒に崩れて消えない。要件定義書 §3-9）:
      // 白く光る → 点滅 → 殻は残ったまま光を失って暗い灰色になり、少し沈んで動かなくなる（目の光も消える）
      figClass('add', 'glow');
      T.glowBlink.forEach((t) => {
        at(t, () => figClass('add', 'blinkoff'));
        at(t + 120, () => figClass('remove', 'blinkoff'));
      });
      at(T.slump, () => {
        figClass('remove', 'glow', 'blinkoff');
        figClass('add', 'slump');
        playBossSfx(app.state.settings, 'win');
        vibrate(app.state.settings, [40, 30, 40, 30, 80]);
      });
      at(T.defeatText, () => say([oldP.name + ' を たおした！', quoted(pickTrueLine(oldP, 'defeat', app.rng))]));
      // 心臓の鼓動のような低い音が、だんだん速く。地鳴りと揺れがだんだん強く
      T.heartbeats.forEach((t, k) => at(t, () => { evoSfx(k < T.heartbeatFastFrom ? 'heartbeat' : 'heartbeatfast'); flash(ui.fig, 'beat', 260); vibrate(app.state.settings, [30, 40, 30]); })); // 前半は遅い鼓動・後半は速い鼓動。鼓動に合わせて絵がわずかに明るくなる（低い音がスマホで聞こえにくくても分かるように）
      at(T.rumble, () => { say(['……ゴゴゴゴ……']); evoSfx('rumble'); });
      T.quakes.forEach((t, k) => at(t, () => { flash(ui.scene, k >= T.strongQuakeFrom ? 'quake2' : 'quake', 450); vibrate(app.state.settings, k >= T.strongQuakeFrom ? [90, 40, 90] : [60, 40, 60]); }));
      // 消えた一つ目が、何度かまたたいてから強く光る（灰色が戻りはじめる）
      T.eyeBlinks.forEach((t) => {
        at(t, () => crackLayer.eye.classList.add('blink'));
        at(t + 130, () => crackLayer.eye.classList.remove('blink'));
      });
      at(T.eyeStrong, () => { figClass('remove', 'slump'); figClass('add', 'revive'); crackLayer.eye.classList.add('on'); });
      // 殻が揺れて、胸の核からひびが体に1本ずつゆっくり広がり、割れて破片が飛び散り、中からすらりとした姿が光とともに現れる
      at(T.shake, () => figClass('add', 'shake'));
      T.cracks.forEach((t, k) => at(t, () => {
        crackLayer.lines[k].classList.add('on');
        vibrate(app.state.settings, 25);
        evoSfx(k % 2 ? 'crack2' : 'crack1', 0, [0.7, 0.85, 1, 1.1][k]); // ひびが入るたびの小さな音（だんだん大きく）
      }));
      at(T.shatter, () => {
        ui.fx.textContent = '';
        figClass('remove', 'shake', 'revive');
        crumble('#b08d3c'); // 殻が崩れるのは、ここ（割れる瞬間）だけ
        ui.fx.appendChild(h('span', { class: 'tb-glow on' })); // 割れた瞬間の光。ふちの無い丸い光（四角い白い面にしない）
        figClass('add', 'gone');
        evoSfx('shatter1'); // 砕ける瞬間の大きな音（2つ重ねる）
        evoSfx('shatter2');
      });
      at(T.swap, () => { swap(); ui.fx.appendChild(h('span', { class: 'tb-burst' })); });
      at(T.swap + 1000, () => { ui.fx.textContent = ''; });
      finishText(T.text);
    } else {
      // 第2→3: 曲が止まり、画面が暗くなる → 宙で静止 → 光の玉が1つずつ（だんだん速く）金色に灯る → 力をためる音と揺れがだんだん強く → 金色の光が弾ける → 第3形態と決めぜりふ → 第3形態の曲
      root.classList.add('tb-dim');
      ui.float.classList.add('still');
      at(200, () => say(['……']));
      orbTimes(T, GEOM.orbs.length).forEach((t, k) => at(t, () => { orbLayer.orbs[k].classList.add('on'); evoSfx('orb', k); }));
      at(T.charge, () => evoSfx('charge'));
      T.quakes.forEach((t, k) => at(t, () => { flash(ui.scene, k >= T.strongQuakeFrom ? 'quake2' : 'quake', 450); vibrate(app.state.settings, k >= T.strongQuakeFrom ? [90, 40, 90] : [50, 40, 50]); }));
      at(T.gold, () => {
        // 画面いっぱい（position: fixed。舞台の箱の中ではない）のまぶしい白金色の光。ほぼ見えなくなるほど光って、ゆっくり引く。縁は画面の端だけ
        // 体のうしろから、ゆっくり回る放射状の光の筋と、外へ広がる光の輪（衝撃波）を2本。玉も一斉に強く光る
        const place = followFig(); // スクロールしても絵に付いてくる
        if (window.scrollY > 1) window.scrollTo({ top: 0, behavior: 'smooth' }); // 進化の最中に下へ動かしていても、光が弾けるところ（絵が変わるところ）は見えるように、上へなめらかに戻す
        const mk = (cls, first) => {
          const e = h('div', { class: cls, 'aria-hidden': 'true' });
          if (first) root.insertBefore(e, root.firstChild); else root.appendChild(e); // 光の筋は、体（舞台）のうしろ
          place();
        };
        root.classList.add('tb-rays-on');
        mk('tb-rays', true);
        mk('tb-gold-flash');
        mk('tb-ring');
        at(T.gold + 150, () => mk('tb-ring r2'));
        orbLayer.svg.classList.add('blaze');
        ui.fx.appendChild(h('span', { class: 'tb-burst strong' }));
        vibrate(app.state.settings, [40, 30, 40, 30, 120]);
      });
      at(T.impact, () => { evoSfx('impact'); evoSfx('finalhit'); }); // 衝撃と決めの一撃は、光のピークに合わせる
      at(T.swap, () => swap()); // 光がいちばん強いあいだに、姿を替える（引いていく中から第3形態が現れる）
      at(T.gold + 2900, () => { ui.fx.textContent = ''; cleanupFx(); }); // 光の筋（2.8秒）が終わってから片づける
      finishText(T.text);
    }
  }

  // ---- 撃破の演出（章のボスと同じ：白く光る → 点滅 → 細かい粒に崩れて消える → 紙吹雪 → XP。タップでとばせる）。このあとエンディング ----
  function defeatSequence(bar, next, ev) {
    S.phase = 'defeat';
    stopBossTheme();
    const p = prof();
    const R = reduced();
    const xpEl = h('p', { class: 'boss-xp', 'data-boss-xp': '1', text: 'XP +0' });
    ui.extra.appendChild(xpEl);
    const bonusEl = h('p', { class: 'boss-xp-bonus hidden', 'data-boss-xp-bonus': '1', text: '撃破のごほうび +' + (S.winBonus || 0) });
    ui.extra.appendChild(bonusEl);
    const lines = [p.name + ' を たおした！', quoted(pickTrueLine(p, 'defeat', app.rng))];
    let done = false;
    let said = false;
    const showFinal = () => { xpEl.textContent = 'XP +' + S.xp; xpEl.classList.add('final'); bonusEl.classList.remove('hidden'); };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimers();
      ui.fx.textContent = '';
      figClass('remove', 'glow', 'blinkoff');
      figClass('add', R ? 'down' : 'gone');
      if (said && typing) typing.finish();
      else if (!said) say(lines, { instant: true });
      if (!R) ui.confetti.classList.add('on');
      showFinal();
      S.phase = 'won';
      S.skipFx = null;
      bar.classList.remove('hidden');
      next.focus({ preventScroll: true });
    };
    S.skipFx = finish;
    if (R) {
      figClass('add', 'down');
      playBossSfx(app.state.settings, 'win');
      say(lines, { instant: true });
      showFinal();
      S.phase = 'won';
      S.skipFx = null;
      done = true;
      bar.classList.remove('hidden');
      return;
    }
    figClass('add', 'glow');
    [350, 620, 890, 1160].forEach((t) => {
      later(() => figClass('add', 'blinkoff'), t);
      later(() => figClass('remove', 'blinkoff'), t + 120);
    });
    later(() => {
      crumble(p.color);
      figClass('add', 'gone');
      playBossSfx(app.state.settings, 'win');
      vibrate(app.state.settings, [40, 30, 40, 30, 80]);
    }, 1350);
    later(() => { said = true; say(lines); }, 1450);
    later(() => ui.confetti.classList.add('on'), 1500);
    later(() => countUp(xpEl, S.xp, 1300), 2800);
    later(() => bonusEl.classList.remove('hidden'), 4100); // 数え上がったあと、内訳（ごほうび）を出す
    later(finish, 4500);
  }

  function crumble(color) {
    const fig = ui.fig;
    const img = fig.querySelector('img');
    const st = ui.stage.getBoundingClientRect();
    let x; let y; let w; let hh; let url = null;
    if (img && img.naturalWidth) {
      const ir = img.getBoundingClientRect();
      const sc = Math.min(ir.width / img.naturalWidth, ir.height / img.naturalHeight);
      w = img.naturalWidth * sc;
      hh = img.naturalHeight * sc;
      x = ir.left - st.left + (ir.width - w) / 2;
      y = ir.top - st.top + (ir.height - hh) / 2;
      url = img.currentSrc || img.src;
    } else {
      const fr = fig.getBoundingClientRect();
      x = fr.left - st.left; y = fr.top - st.top; w = fr.width; hh = fr.height;
    }
    if (!(w > 0) || !(hh > 0)) return;
    const cols = 10;
    const rows = Math.max(6, Math.min(16, Math.round((cols * hh) / w)));
    const bw = w / cols;
    const bh = hh / rows;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bit = h('span', { class: 'boss-bit' });
        bit.style.left = x + c * bw + 'px';
        bit.style.top = y + r * bh + 'px';
        bit.style.width = bw + 1 + 'px';
        bit.style.height = bh + 1 + 'px';
        if (url) {
          bit.style.backgroundImage = 'url("' + url + '")';
          bit.style.backgroundSize = w + 'px ' + hh + 'px';
          bit.style.backgroundPosition = -c * bw + 'px ' + -r * bh + 'px';
        } else {
          bit.style.backgroundColor = color;
        }
        bit.style.setProperty('--dx', Math.round((c - cols / 2 + rand(-0.5, 0.5)) * 16) + 'px');
        bit.style.setProperty('--dy', Math.round(rand(60, 200)) + 'px');
        bit.style.setProperty('--rot', Math.round(rand(-200, 200)) + 'deg');
        bit.style.setProperty('--delay', ((r / rows) * 0.45 + rand(0, 0.25)).toFixed(2) + 's');
        frag.appendChild(bit);
      }
    }
    ui.fx.appendChild(frag);
  }

  function countUp(el, to, ms) {
    const t0 = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      el.textContent = 'XP +' + Math.round(to * k);
      if (k < 1) later(step, 40);
    };
    step();
  }

  // ---- エンディング（倒したときだけ。星空に、ひとことずつ現れる。タップ・ボタンでとばせる） ----
  function endingScreen(done) {
    S.phase = 'ending';
    S.endingShown = true;
    clearTimers();
    stopTick();
    typing = null;
    clear(root);
    root.classList.add('boss-rpg');
    document.body.classList.add('boss-on');
    const R = reduced();
    const sky = h('div', { class: 'tb-sky', 'aria-hidden': 'true' });
    for (let k = 0; k < 48; k++) {
      const s = h('span', { class: 'tb-star' });
      s.style.left = Math.round(Math.random() * 100) + '%';
      s.style.top = Math.round(Math.random() * 100) + '%';
      s.style.setProperty('--delay', (Math.random() * 2).toFixed(2) + 's');
      s.style.setProperty('--dur', (1.4 + Math.random() * 1.6).toFixed(2) + 's');
      sky.appendChild(s);
    }
    // 『。』の後ろに文が続く行は、『。』の後ろで改行して2行に分ける（データの文は変えず、表示だけ。textContent は元の文と同じ）
    const lines = data.ending.map((t) => {
      const parts = t.split(/(?<=。)(?=.)/u);
      const kids = [];
      parts.forEach((x, i) => { if (i) kids.push(h('br')); kids.push(document.createTextNode(x)); });
      return h('p', { class: 'tb-ending-line' }, ...kids);
    });
    const title = h('p', { class: 'tb-ending-title', text: trueBossWords(app.config).ending });
    const go = h('button', { class: 'btn big tb-ending-go', type: 'button', 'data-tb-ending-go': '1', onClick: finishEnding }, 'とばす');
    const box = h('div', { class: 'tb-ending', 'data-tb-ending': '1', onClick: revealAll }, sky, title, ...lines, h('div', { class: 'tb-ending-btn' }, go));
    root.appendChild(box);
    root.appendChild(h('p', { class: 'boss-sr', role: 'status', text: trueBossWords(app.config).ending + ' ' + data.ending.join(' ') }));
    const all = [title, ...lines];
    let finished = false;
    function revealAll() {
      clearTimers();
      all.forEach((el) => el.classList.add('shown'));
      go.textContent = '結果を見る';
    }
    function finishEnding(e) {
      if (e) e.stopPropagation();
      if (finished) return;
      finished = true;
      clearTimers();
      done();
    }
    startBossTheme(4); // エンディングの曲（約105秒。BGM がオフなら鳴らさない。取れなければ短いファンファーレ）
    vibrate(app.state.settings, [40, 30, 40, 30, 80]);
    window.scrollTo(0, 0);
    if (R) { revealAll(); return; }
    all.forEach((el, i) => later(() => el.classList.add('shown'), 600 + i * 2300));
    later(() => { go.textContent = '結果を見る'; }, 600 + all.length * 2300);
  }

  // ---- 勝ち・負けのあと ----
  function endBattle() {
    if (!S) return;
    clearTimers();
    stopTick();
    if (typing) typing.finish();
    const win = battle().result === 'win';
    if (win && !S.recorded) {
      S.recorded = true;
      S.wins = recordTrueBossWin(app.state);
      app.commit(); // ひみつのバッジの判定と保存
    }
    if (win && !S.endingShown) { endingScreen(showResult); return; }
    showResult();
  }

  function showResult() {
    clear(root);
    root.classList.add('boss-rpg');
    document.body.classList.add('boss-on');
    setBgmBoss(false);
    app.commit();
    S.phase = 'result';
    const win = battle().result === 'win';
    const ok = S.log.filter((x) => x.correct).length;
    const p = prof();
    const art = trueBossArt(battle().form, win ? 'down' : 'on');
    const card = h('div', { class: 'card result boss-result ' + (win ? 'win' : 'lose'), 'data-boss-result': win ? 'win' : 'lose', 'data-true-boss-result': win ? 'win' : 'lose' },
      h('div', { class: 'boss-result-art' }, art),
      h('h1', { text: win ? data.name + ' を たおした！' : '負けてしまった…' }),
      win
        ? h('p', { class: 'score' }, '真ボスを ', h('strong', { text: S.wins + ' 回' }), ' たおしました')
        : h('p', { text: (trueBossSeenForm2(app.state) ? '第' + battle().form + '形態で、' : '') + 'HP がなくなりました。解説を読んで、もう一度挑みましょう' + (trueBossSeenForm2(app.state) ? '（第1形態からです）' : '') + '。' }),
      h('p', { class: 'small muted', text: S.log.length + ' 回答えて、' + ok + ' 回正解しました' }),
      h('p', { class: 'xp-total', text: '獲得 ' + S.xp + ' XP' }),
      win && S.winBonus ? h('p', { class: 'small muted', 'data-boss-xp-bonus-result': '1', text: '（撃破のごほうび +' + S.winBonus + ' をふくむ）' }) : null);
    root.appendChild(card);
    if (win) {
      const m = mascotLine('shiba-banzai', 'やったね！ ' + trueBossWords(app.config).reached, 'win');
      if (m) card.appendChild(m);
      beep(app.state.settings, 'up');
    } else {
      const m = mascotLine('shiba-cheer', CHARACTER_TEXT.cheer, 'cheer');
      if (m) card.appendChild(m);
    }
    // 答えた問題の一覧（戦いの最中は解説を出さなかったので、ここで読む）。
    // 『不正解だった問題』を上、『正解だった問題』を下の2つのまとまりにして、最初はどちらも閉じる。
    // まとまりをタップすると問題の一覧（問題文の初めの部分）が開き、1問をタップするとその問題の解説・図・用語カードが開く（もう一度タップで閉じる）。0問のまとまりは出さない。
    const open = (id) => openCardSheet(app, id);
    const toggle = (btn, panel) => {
      const was = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', was ? 'false' : 'true');
      panel.hidden = was;
      return !was;
    };
    const questionRow = (x, i, kind) => {
      const panel = h('div', { class: 'tb-q-panel', id: 'tb-q-' + kind + '-' + i, hidden: true });
      const verdict = x.correct ? '正解。' : x.late ? '時間切れ。' : '不正解。';
      const btn = h('button', { class: 'tb-q-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': panel.id, 'data-tb-q': kind },
        h('span', { class: 'tb-mark', 'aria-hidden': 'true', text: x.correct ? '○' : '×' }),
        h('span', { class: 'boss-sr', text: verdict }),
        h('span', { class: 'tb-stem', text: x.q.stem }),
        h('span', { class: 'tb-chev', 'aria-hidden': 'true' }));
      let built = false;
      btn.addEventListener('click', () => {
        if (toggle(btn, panel) && !built) { // 開いたときに初めて解説を作る（まとめて作らない）
          built = true;
          const sb = stemPlainBlock(x.q);
          if (sb) panel.appendChild(sb);
          panel.appendChild(explanation(app, x.sq, x.chosen, open, { sensei: false }));
        }
      });
      return h('div', { class: 'tb-q ' + (x.correct ? 'right' : 'wrong') }, btn, panel);
    };
    const group = (kind, title, rows) => {
      if (!rows.length) return null;
      const body = h('div', { class: 'tb-group-body', id: 'tb-group-' + kind, hidden: true }, rows.map((x, i) => questionRow(x, i, kind)));
      const head = h('button', { class: 'tb-group-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': body.id, 'data-tb-group': kind },
        h('span', { class: 'tb-group-title' }, title, h('span', { class: 'tb-count', text: '（' + rows.length + '問）' })),
        h('span', { class: 'tb-chev', 'aria-hidden': 'true' }));
      head.addEventListener('click', () => toggle(head, body));
      return h('div', { class: 'tb-group ' + kind }, head, body);
    };
    const list = h('div', { class: 'card tb-review', 'data-tb-review': '1' }, h('h2', { text: '答えた問題（' + S.log.length + '）' }),
      h('p', { class: 'small muted', text: 'まとまりをタップすると問題が並びます。問題をタップすると、解説・図・用語カードが開きます。' }),
      group('wrong', '不正解だった問題', S.log.filter((x) => !x.correct)),
      group('right', '正解だった問題', S.log.filter((x) => x.correct)));
    root.appendChild(list);
    const row = h('div', { class: 'btn-row' });
    row.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-tb-again': '1', onClick: again }, win || !trueBossSeenForm2(app.state) ? 'もう一度挑む' : 'もう一度挑む（第1形態から）'));
    row.appendChild(h('button', { class: 'btn big', type: 'button', 'data-boss-back': '1', onClick: leave }, '戻る'));
    root.appendChild(row);
    window.scrollTo(0, 0);
    app.flushCelebrations();
  }

  function again() {
    if (begin()) { bindKeys(); buildScreen(); startIntro(); } else toast('いまは戦えません', 'warn');
  }

  function bindKeys() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = (e) => {
      if (document.querySelector('.sheet-back')) return;
      if (S && S.phase === 'question' && !S.answered && S.item && /^[1-8]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < S.item.choices.length) answer(i);
      }
    };
    document.addEventListener('keydown', keyHandler);
  }

  if (!begin()) {
    root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: leave }, '← 戻る'));
    root.appendChild(h('h1', { text: data.name }));
    root.appendChild(h('div', { class: 'card empty', 'data-true-boss-none': '1' }, h('p', { text: TRUE_BOSS_TEXT.none }), h('p', { class: 'small muted', text: '問題が足りません。' })));
    return root;
  }
  bindKeys();
  buildScreen();
  startIntro();
  return { el: root, cleanup };
}
