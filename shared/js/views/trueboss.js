// 真ボス戦（要件定義書 §3-9）。章のボス戦（views/boss.js）と同じ昔の RPG 風の戦闘に、真ボスだけの違いを足す。
//   すべての章のボスを倒すと現れる／全分野から出題（苦手6:それ以外4）／3つの形態（進化するほど難しい）／ボスの技（時間制限・呪い）／
//   ときどきボスが回復／こちらの HP は 3 続けて正解で回復／戦いの最中は解説なし（結果で一覧）／負けたら第1形態から／専用の曲／エンディングとひみつのバッジ。
// 計算は lib/trueboss.js、名前・せりふは lib/trueboss-data.js（data/trueboss.json。無ければ仮）、曲は lib/trueboss-music.js。ここは画面と演出の順番だけ。
// 絵は <アプリ>/images/bosses/true-1.webp 〜 true-3.webp（形態ごとに全身を1枚。置くだけで記号と入れ替わる）。
// 動きを減らす設定（prefers-reduced-motion）では、点滅・揺れ・崩れる動きをやめ、色の変化と文だけにする（CSS と reduced() の両方で）。
import { h, clear, icon, vibrate, beep, toast, mascotLine, appImagesBase, confirmQuit } from '../ui.js';
import { CHARACTER_TEXT } from '../lib/characters.js';
import { shuffleChoices, secondsPerQuestion } from '../lib/quiz.js';
import { isCritical, bossMood, BOSS_MOOD_TEXT, CRIT_DAMAGE } from '../lib/boss.js';
import { quoted, faceCrop } from '../lib/bossdata.js';
import {
  trueBossEnabled, trueBossUnlocked, trueBossWins, recordTrueBossWin, buildTrueBossPlan, newTrueRun, currentTrueQuestion,
  rollRunSkill, answerTrueRun, isTimedOut, timeLimitFor, SKILL_SECONDS, SKILL_CURSE_DAMAGE, TRUE_FORMS,
} from '../lib/trueboss.js';
import { normalizeTrueBossData, trueBossForm, pickTrueLine, trueBossImageName, TRUE_FACE } from '../lib/trueboss-data.js';
import { setBgmBoss, startBossTheme, stopBossTheme, playSynth, playBossSfx } from '../audio.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, stemPlainBlock, CHOICE_LABELS } from './explain.js';

export const TRUE_BOSS_SYMBOL = '真';

/** 真ボスの文。現れる条件（章のボスをすべて倒す）は画面に出さない（章のボスと同じ考え）。 */
export const TRUE_BOSS_TEXT = {
  unknownName: '？？？',
  locked: '塔の いちばん うえに、なにかが ひそんでいる……',
  awake: '塔の いちばん うえで、おおきな なにかが めざめた……',
  none: 'まだ 戦えません。',
  rule: 'すべての分野から出ます。正解でボスにダメージ。ボスは進化して、だんだん 手ごわくなります。3問続けて正解すると、HP が 1 回復します。戦いの最中は解説が出ません。くわしい解説は、戦いのあとの結果で読めます。',
};

/** 真ボスのデータ（名前・せりふ）。app.data.trueBoss が無ければ仮。 */
function dataOf(app) {
  return app.data && app.data.trueBoss ? app.data.trueBoss : normalizeTrueBossData(null);
}

/** 形態ごとの絵の URL。 */
export function trueBossImageUrl(form) {
  return new URL('bosses/' + trueBossImageName(form), appImagesBase()).href;
}

/** 絵を読み込んで、読めたときだけ wrap の中身を絵に入れ替える。wrap.dataset.form が変わっていたら（進化した後に遅れて届いたら）捨てる。 */
function loadFormImage(form, wrap, onLoad) {
  const img = new Image();
  img.className = 'boss-img';
  img.alt = '';
  img.decoding = 'async';
  img.addEventListener('load', () => {
    if (wrap.dataset.form !== String(form)) return;
    clear(wrap);
    wrap.appendChild(img);
    if (onLoad) onLoad(img);
  });
  img.src = trueBossImageUrl(form);
}

/** 小さな丸（顔の切り抜き）。unknown なら絵を読まず「？」。 */
function fillArt(wrap, form, unknown) {
  clear(wrap);
  wrap.dataset.form = String(form);
  wrap.appendChild(h('span', { class: 'boss-sym', text: unknown ? '？' : TRUE_BOSS_SYMBOL }));
  if (unknown) return;
  loadFormImage(form, wrap, (img) => {
    const c = faceCrop(img.naturalWidth, img.naturalHeight, TRUE_FACE[form]);
    img.style.setProperty('--zoom', String(c.zoom));
    img.style.setProperty('--tx', String(c.tx));
    img.style.setProperty('--ty', String(c.ty));
  });
}

export function trueBossArt(form, cls) {
  const unknown = String(cls || '').split(' ').includes('unknown');
  const wrap = h('span', { class: 'boss-art ' + (cls || ''), 'aria-hidden': 'true' });
  fillArt(wrap, form, unknown);
  return wrap;
}

/** 全身の絵（戦いの画面）。 */
function fillFigure(wrap, form) {
  clear(wrap);
  wrap.classList.remove('has-img');
  wrap.dataset.form = String(form);
  wrap.appendChild(h('span', { class: 'boss-fig-sym', text: TRUE_BOSS_SYMBOL }));
  loadFormImage(form, wrap, () => wrap.classList.add('has-img'));
}

/** 真ボスに挑む。back は終わったあとに戻る先（無ければ地図）。 */
export function openTrueBoss(app, back) {
  app.trueBossBack = back || null;
  app.go('#/trueboss');
}

/** 真ボスの入口（地図・復習の画面）。真ボスを出さないアプリでは null。現れていなければ影だけ（条件は出さない）。 */
export function trueBossPlace(app, back) {
  if (!trueBossEnabled(app.config)) return null;
  const data = dataOf(app);
  if (!trueBossUnlocked(app.state, app.data.tree.stages)) {
    return h('div', { class: 'card boss-place off', 'data-true-boss-place': 'locked' },
      h('div', { class: 'boss-place-head' }, trueBossArt(1, 'off unknown'),
        h('div', { class: 'boss-place-text' }, h('strong', { text: TRUE_BOSS_TEXT.unknownName }), h('span', { class: 'small muted', text: TRUE_BOSS_TEXT.locked }))));
  }
  const wins = trueBossWins(app.state);
  return h('div', { class: 'card boss-place on', 'data-true-boss-place': 'on' },
    h('div', { class: 'boss-place-head' }, trueBossArt(1, 'on'),
      h('div', { class: 'boss-place-text' }, h('strong', { text: data.name + ' が あらわれた！' }),
        h('span', { class: 'small', text: '塔の いちばん うえの 真ボス。すべての分野から出ます' }),
        wins ? h('span', { class: 'small muted', text: 'たおした回数 ' + wins + ' 回' }) : null)),
    h('button', { class: 'btn primary big', type: 'button', 'data-true-boss-go': '1', onClick: () => openTrueBoss(app, back) }, '真ボスに挑む'));
}

const rand = (a, b) => a + Math.random() * (b - a);

export function renderTrueBoss(app) {
  const root = h('section', { class: 'view boss true-boss' });
  const back = app.trueBossBack || '#/map';
  app.trueBossBack = null;
  const data = dataOf(app);
  if (!trueBossEnabled(app.config) || !trueBossUnlocked(app.state, app.data.tree.stages)) {
    root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go(back) }, '← 戻る'));
    root.appendChild(h('h1', { text: TRUE_BOSS_TEXT.unknownName }));
    root.appendChild(h('div', { class: 'card empty', 'data-true-boss-none': '1' }, h('p', { text: TRUE_BOSS_TEXT.locked })));
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

  const askExit = () => !(S && !battle().result && S.log.length) || confirmQuit('途中で終了します。ここまでの回答の記録は残ります。やり直すときは第1形態からです。');
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
  function paintHp(b, crackAt) {
    [ui.hp, ui.miniHp].forEach((box) => {
      if (!box) return;
      clear(box);
      const hearts = h('span', { class: 'boss-hearts', role: 'img', 'aria-label': 'あなたの体力 ' + b.player + '／' + b.playerMax });
      for (let i = 0; i < b.playerMax; i++) hearts.appendChild(icon('heart', 'heart ' + (i < b.player ? 'on' : 'off') + (i === crackAt ? ' crack' : '')));
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
    fillFigure(ui.fig, battle().form);
    fillArt(ui.miniArt, battle().form, false);
    ui.fig.style.setProperty('--boss-color', p.color);
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
  function skillBanner(skill) {
    const info = skillInfo(skill.kind);
    const rule = skill.kind === 'timed' ? '1問 ' + SKILL_SECONDS + ' 秒以内（時間切れは不正解）' : 'まちがえると HP が ' + SKILL_CURSE_DAMAGE + ' へる';
    const box = h('div', { class: 'tb-skill', role: 'status', 'data-tb-skill': skill.kind },
      h('strong', { class: 'tb-skill-name', text: info.name }),
      h('span', { class: 'tb-skill-turns', 'data-tb-skill-turns': String(skill.turns), text: '残り ' + skill.turns + ' ターン' }),
      h('span', { class: 'small tb-skill-rule', text: rule }));
    if (skill.kind === 'timed') {
      const left = h('span', { class: 'tb-timer-text', 'data-tb-timer': '1', text: '残り ' + SKILL_SECONDS + ' 秒' });
      const fill = h('span', { class: 'tb-timer-fill' });
      box.appendChild(h('div', { class: 'tb-timer', 'aria-hidden': 'true' }, fill));
      box.appendChild(left);
      ui.timer = { left, fill };
    } else ui.timer = null;
    return box;
  }

  function startTimer() {
    stopTick();
    const lim = timeLimitFor(battle().skill);
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
    if (skill) ui.qarea.appendChild(skillBanner(skill)); else ui.timer = null;
    if (!S.log.length) ui.qarea.appendChild(h('p', { class: 'small muted boss-rule', text: TRUE_BOSS_TEXT.rule }));
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
    const late = !!timedOut || isTimedOut(before.skill, seconds);
    const correct = !late && chosen !== null && chosen === sq.answer;
    S.streak = correct ? S.streak + 1 : 0;
    const r = app.recordAnswer(sq.q, { correct, seconds, sessionStreak: S.streak, limit }); // 今日の復習の枠（review）には数えない
    S.xp += r.xp;
    const crit = isCritical(correct, seconds, app.rng);
    const res = answerTrueRun(S.run, { correct, damage: crit ? CRIT_DAMAGE : 1, timedOut: late }, app.rng);
    S.run = res.run;
    const ev = res.events;
    const b = battle();
    S.log.push({ q: sq.q, sq, correct, chosen, form: before.form, late, skill: before.skill ? before.skill.kind : null });
    paintHp(b, -1);
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
    const next = h('button', { class: 'btn primary big next', type: 'button', 'data-boss-next': '1', onClick: () => { if (typing) typing.finish(); if (b.result) endBattle(); else drawQuestion(); } },
      b.result === 'win' ? 'つづき' : b.result ? '結果を見る' : '次の問題へ');
    const bar = h('div', { class: 'sticky-bar' }, next);
    after.appendChild(bar);
    if (b.result === 'win' || ev.evolved) bar.classList.add('hidden'); // 撃破・進化の演出が終わるまで、先へ進むボタンは出さない（タップでとばせる）
    else next.focus({ preventScroll: true });

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
          if (ev.bossHealed) {
            playSynth(app.state.settings, 'heal');
            lines.push(oldProfile.name + ' は 傷を癒やした！', quoted(pickTrueLine(oldProfile, 'heal', app.rng)));
          }
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
      if (ev.playerHealed) lines.push('あなたの きずが すこし いえた。', quoted(pickTrueLine({ lines: { x: data.playerHeal } }, 'x', app.rng)));
      if (ev.skillEnded && !ev.evolved && b.result !== 'win') lines.push(skillInfo(ev.skillEnded).name + ' の ちからが きえた。');
      if (b.result === 'win') defeatSequence(bar, next, ev);
      else if (ev.evolved) evolveSequence(ev, bar, next);
      else {
        say(lines);
        if (b.result === 'lose') stopBossTheme();
      }
    };
    atTop(perform);
  }

  // ---- 進化の演出（白く光る → 点滅 → 次の形態の姿に替わって現れる → せりふ。タップでとばせる） ----
  function evolveSequence(ev, bar, next) {
    S.phase = 'evolve';
    stopBossTheme();
    const R = reduced();
    const oldP = trueBossForm(data, ev.evolved.from);
    let done = false;
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      swapped = true;
      figClass('remove', 'glow', 'blinkoff', 'gone', 'shake');
      paintForm();
      paintHp(battle(), -1);
      startBossTheme(battle().form); // 形態が替わったら曲も替える（第2・第3形態は別の曲）
      if (!R) flash(ui.fig, ev.evolved.from === 1 ? 'emerge' : 'spread', 1000);
    };
    const newP = () => prof();
    const lines = () => [oldP.name + ' は しんかした！', quoted(pickTrueLine(oldP, 'evolve', app.rng)), newP().name + ' が あらわれた！', quoted(pickTrueLine(newP(), 'appear', app.rng))];
    const finish = () => {
      if (done) return;
      done = true;
      clearTimers();
      ui.fx.textContent = '';
      ui.flash.classList.remove('on');
      swap();
      S.skipFx = null;
      S.phase = 'evolved';
      say(lines(), { instant: true });
      bar.classList.remove('hidden');
      next.focus({ preventScroll: true });
    };
    S.skipFx = finish;
    const from1 = ev.evolved.from === 1;
    const P = from1 ? 4900 : 0; // 第1→2 は、先に偽の撃破と地鳴りがある
    if (R) {
      if (from1) {
        // 動きを減らす設定: 点滅・揺れなしで、撃破の文 → 少しして進化の文
        say([oldP.name + ' を たおした！', quoted(pickTrueLine(oldP, 'defeat', app.rng))], { instant: true });
        figClass('add', 'down');
        later(() => { figClass('remove', 'down'); playBossSfx(app.state.settings, 'shatter1'); playBossSfx(app.state.settings, 'shatter2'); finish(); }, 1200);
        return;
      }
      playSynth(app.state.settings, 'evolve');
      finish();
      return;
    }
    if (from1) {
      // 偽の撃破（章のボスの撃破と同じ演出で、勝ったと思わせる）: 白く光る → 点滅 → 崩れて消える → 「たおした！」とせりふ
      figClass('add', 'glow');
      [350, 620, 890, 1160].forEach((t) => {
        later(() => figClass('add', 'blinkoff'), t);
        later(() => figClass('remove', 'blinkoff'), t + 120);
      });
      later(() => {
        crumble(oldP.color);
        figClass('remove', 'glow', 'blinkoff');
        figClass('add', 'gone');
        playBossSfx(app.state.settings, 'win');
        vibrate(app.state.settings, [40, 30, 40, 30, 80]);
      }, 1350);
      later(() => say([oldP.name + ' を たおした！', quoted(pickTrueLine(oldP, 'defeat', app.rng))]), 1450);
      // 地鳴り → 崩れたはずの殻がもどってくる
      later(() => { ui.fx.textContent = ''; say(['……ゴゴゴゴ……']); playBossSfx(app.state.settings, 'rumble'); }, 3300); // 地鳴り（約3.6秒。後ろをフェードアウト）
      [3400, 3800, 4200].forEach((t) => later(() => { flash(ui.scene, 'quake', 450); vibrate(app.state.settings, [60, 40, 60]); }, t));
      later(() => { figClass('remove', 'gone'); flash(ui.fig, 'appear', 700); }, 4500);
    } else {
      playSynth(app.state.settings, 'evolve');
    }
    if (from1) {
      // 第1形態→第2形態: ずんぐりした真鍮の殻が揺れてひびが入り、割れて破片が飛び散り、中からすらりとした姿が光とともに現れる
      later(() => figClass('add', 'shake'), P);
      [150, 420, 690, 900].forEach((t, k) => later(() => {
        const c = h('span', { class: 'tb-crack' });
        c.style.setProperty('--x', [50, 38, 62, 50][k] + '%');
        c.style.setProperty('--y', [30, 52, 48, 70][k] + '%');
        c.style.setProperty('--rot', [8, -35, 40, -12][k] + 'deg');
        c.style.setProperty('--len', [38, 30, 30, 40][k] + '%');
        ui.fx.appendChild(c);
        vibrate(app.state.settings, 25);
        playBossSfx(app.state.settings, k % 2 ? 'crack2' : 'crack1', [0.7, 0.85, 1, 1.1][k]); // ひびが入るたびの小さな音（だんだん大きく）
      }, P + t));
      later(() => {
        ui.fx.textContent = '';
        figClass('remove', 'shake');
        ui.flash.classList.add('on'); // 割れた瞬間の白い光
        crumble('#b08d3c');
        figClass('add', 'gone');
        playBossSfx(app.state.settings, 'shatter1'); // 砕ける瞬間の大きな音（2つ重ねる）
        playBossSfx(app.state.settings, 'shatter2');
      }, P + 1150);
      later(() => { ui.flash.classList.remove('on'); swap(); ui.fx.appendChild(h('span', { class: 'tb-burst' })); }, P + 1400);
      later(() => { ui.fx.textContent = ''; }, P + 2400);
    } else {
      // 第2形態→第3形態: 光がどんどん強まり、強い光の中で翼が広がるように、横にぐっと開いた姿が現れる
      figClass('add', 'glow', 'swell');
      [600, 1000, 1300].forEach((t) => {
        later(() => ui.flash.classList.add('on'), t);
        later(() => ui.flash.classList.remove('on'), t + 140);
      });
      later(() => ui.fx.appendChild(h('span', { class: 'tb-burst strong' })), 1000);
      later(() => { ui.flash.classList.add('on'); }, 1700);
      later(() => { ui.flash.classList.remove('on'); figClass('remove', 'swell'); swap(); }, 1900);
      later(() => { ui.fx.textContent = ''; }, 3000);
    }
    later(() => {
      if (done) return;
      say(lines(), { onDone: () => { if (S.phase === 'evolve') { done = true; S.skipFx = null; S.phase = 'evolved'; bar.classList.remove('hidden'); next.focus({ preventScroll: true }); } } });
    }, from1 ? P + 1700 : 2100);
  }

  // ---- 撃破の演出（章のボスと同じ：白く光る → 点滅 → 細かい粒に崩れて消える → 紙吹雪 → XP。タップでとばせる）。このあとエンディング ----
  function defeatSequence(bar, next, ev) {
    S.phase = 'defeat';
    stopBossTheme();
    const p = prof();
    const R = reduced();
    const xpEl = h('p', { class: 'boss-xp', 'data-boss-xp': '1', text: 'XP +0' });
    ui.extra.appendChild(xpEl);
    const lines = [p.name + ' を たおした！', quoted(pickTrueLine(p, 'defeat', app.rng))];
    let done = false;
    let said = false;
    const showFinal = () => { xpEl.textContent = 'XP +' + S.xp; xpEl.classList.add('final'); };
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
    const lines = data.ending.map((t) => h('p', { class: 'tb-ending-line', text: t }));
    const title = h('p', { class: 'tb-ending-title', text: '塔を きわめた！' });
    const go = h('button', { class: 'btn big tb-ending-go', type: 'button', 'data-tb-ending-go': '1', onClick: finishEnding }, 'とばす');
    const box = h('div', { class: 'tb-ending', 'data-tb-ending': '1', onClick: revealAll }, sky, title, ...lines, h('div', { class: 'tb-ending-btn' }, go));
    root.appendChild(box);
    root.appendChild(h('p', { class: 'boss-sr', role: 'status', text: '塔を きわめた！ ' + data.ending.join(' ') }));
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
        : h('p', { text: '第' + battle().form + '形態で、HP がなくなりました。解説を読んで、もう一度挑みましょう（第1形態からです）。' }),
      h('p', { class: 'small muted', text: S.log.length + ' 回答えて、' + ok + ' 回正解しました' }),
      h('p', { class: 'xp-total', text: '獲得 ' + S.xp + ' XP' }));
    root.appendChild(card);
    if (win) {
      const m = mascotLine('shiba-banzai', 'やったね！ 塔のてっぺんまで たどりついたよ！', 'win');
      if (m) card.appendChild(m);
      beep(app.state.settings, 'up');
    } else {
      const m = mascotLine('shiba-cheer', CHARACTER_TEXT.cheer, 'cheer');
      if (m) card.appendChild(m);
    }
    // 答えた問題の一覧（戦いの最中は解説を出さなかったので、ここで読む。間違えた問題は先頭を開いておく）
    const list = h('div', { class: 'card tb-review', 'data-tb-review': '1' }, h('h2', { text: '答えた問題（' + S.log.length + '）' }),
      h('p', { class: 'small muted', text: '問題をタップすると、解説・図・用語カードが開きます。' }));
    const open = (id) => openCardSheet(app, id);
    for (let f = 1; f <= TRUE_FORMS; f++) {
      const rows = S.log.filter((x) => x.form === f);
      if (!rows.length) continue;
      list.appendChild(h('h3', { class: 'tb-review-form', text: '第' + f + '形態' }));
      rows.forEach((x) => {
        const d = h('details', { class: 'miss tb-row ' + (x.correct ? 'right' : 'wrong'), 'data-tb-row': x.correct ? 'ok' : 'ng' },
          h('summary', {}, h('span', { class: 'tb-mark', 'aria-hidden': 'true', text: x.correct ? '○' : '×' }),
            h('span', { class: 'boss-sr', text: x.correct ? '正解。' : x.late ? '時間切れ。' : '不正解。' }),
            h('span', { class: 'tb-stem', text: x.q.stem })),
          stemPlainBlock(x.q), explanation(app, x.sq, x.chosen, open, { sensei: false }));
        list.appendChild(d);
      });
    }
    root.appendChild(list);
    const row = h('div', { class: 'btn-row' });
    row.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-tb-again': '1', onClick: again }, win ? 'もう一度挑む' : 'もう一度挑む（第1形態から）'));
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
