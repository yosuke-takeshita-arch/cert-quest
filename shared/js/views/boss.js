// 章のボス戦（要件定義書 §3-7 作り直し）。昔の家庭用ゲーム機の RPG 風の戦闘（黒い背景・白い縁の窓・1文字ずつ出る文・ボスの全身の絵）。
// 特定のゲームの名前・音楽・画面をまねない。計算は lib/boss.js（出す問題・隠れた体力・会心の一撃・様子の文）と lib/bossrun.js（1回の戦いの進み方）、
// ボスの名前・せりふは lib/bossdata.js（data/bosses.json。無ければ汎用）、曲は lib/bossmusic.js（プログラムで鳴らす）。ここは画面と演出の順番だけ。
// 答えはふつうの出題と同じに問題の記録（qstats・復習の予定・XP）に入る（復習そのものなので）。
// 動きを減らす設定（prefers-reduced-motion）では、点滅・揺れ・崩れる動きをやめ、色の変化と文だけにする（CSS と reduced() の両方で）。
import { h, clear, icon, vibrate, beep, toast, mascotLine } from '../ui.js';
import { shouldCheer, CHARACTER_TEXT } from '../lib/characters.js';
import { shuffleChoices, secondsPerQuestion } from '../lib/quiz.js';
import { bossInfo, bossQuestions, recordBossWin, isFlawlessWin, bossWins, rollBossHp, isCritical, bossMood, BOSS_MOOD_TEXT, BOSS_MIN, CRIT_DAMAGE } from '../lib/boss.js';
import { newRun, currentQuestion, answerRun } from '../lib/bossrun.js';
import { bossProfile, pickLine, quoted, faceCrop } from '../lib/bossdata.js';
import { setBgmBoss, startBossTheme, stopBossTheme, playSynth, playBossSfx } from '../audio.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, laterButton, stumbleBlock, stemPlainBlock, CHOICE_LABELS } from './explain.js';

// ボスの見た目。絵が無い（読み込めない）あいだは記号で出す。
// 絵を足すとき: <アプリ>/images/bosses/boss-<番号>.webp を置く（番号＝bosses.json の no。無い章は地図の章の並び＝1から）。置くだけで記号と入れ替わる。
// 全身の絵（縦長でもよい）。戦いの画面は object-fit: contain で全体を出し、章の画面・地図の小さな丸は faceCrop（lib/bossdata.js）で顔を切り抜く。
export const BOSS_SYMBOL = '魔';

/** その章のボスの姿（名前・せりふ・色）。bosses.json に無ければ汎用。 */
export function bossProfileOf(app, stage) {
  return bossProfile(app.data && app.data.bosses, stage);
}

/** ボスの名前。 */
export function bossName(app, stage) {
  return bossProfileOf(app, stage).name;
}

/** ボスの絵の URL。番号は bosses.json の no、無ければ地図の章の並び（data.tree.stages の順）。 */
export function bossImageUrl(app, stage) {
  const p = bossProfileOf(app, stage);
  const n = p.no || app.data.tree.stages.indexOf(stage) + 1;
  return n > 0 ? new URL('./images/bosses/boss-' + n + '.webp', location.href).href : null;
}

/** 絵を読み込んで、読めたときだけ wrap の中身を絵に入れ替える。onLoad(img) は入れ替えたあと。 */
function loadBossImage(url, wrap, onLoad) {
  if (!url) return;
  const img = new Image();
  img.className = 'boss-img';
  img.alt = '';
  img.decoding = 'async';
  img.addEventListener('load', () => {
    clear(wrap);
    wrap.appendChild(img);
    if (onLoad) onLoad(img);
  });
  img.src = url;
}

/** 小さな丸のボス（章の画面・地図・復習の一覧）。絵の上のほう（顔）を切り抜く。飾りなので読み上げない。 */
export function bossArt(app, stage, cls) {
  const wrap = h('span', { class: 'boss-art ' + (cls || ''), 'aria-hidden': 'true' }, h('span', { class: 'boss-sym', text: BOSS_SYMBOL }));
  loadBossImage(bossImageUrl(app, stage), wrap, (img) => {
    const c = faceCrop(img.naturalWidth, img.naturalHeight, bossProfileOf(app, stage).face);
    img.style.setProperty('--zoom', String(c.zoom));
    img.style.setProperty('--tx', String(c.tx));
    img.style.setProperty('--ty', String(c.ty));
  });
  return wrap;
}

/** 戦いの画面の大きなボス（全身。縦長のまま全体を出す）。 */
function bossFigure(app, stage, profile) {
  const wrap = h('div', { class: 'boss-fig', 'aria-hidden': 'true', 'data-boss-fig': '1' }, h('span', { class: 'boss-fig-sym', text: BOSS_SYMBOL }));
  wrap.style.setProperty('--boss-color', profile.color);
  loadBossImage(bossImageUrl(app, stage), wrap, () => wrap.classList.add('has-img'));
  return wrap;
}

/** ボス戦の画面へ。back は終わったあとに戻る先（無ければその章の画面）。 */
export function openBoss(app, stage, back) {
  app.bossBack = back || null;
  app.go('#/boss/' + encodeURIComponent(stage.key));
}

/** その章のボスの様子。{ info, wins }。 */
export function bossState(app, stage) {
  return { info: bossInfo(stage.questions, app.state.qstats), wins: bossWins(app.state, stage.key) };
}

/** いま挑める（現れている）ボスの章。 */
export function availableBosses(app) {
  return app.data.tree.stages.map((st) => ({ stage: st, ...bossState(app, st) })).filter((b) => b.info.available);
}

/** 章の画面に置くボスの場所。現れていれば目立たせて挑めるように、まだなら条件を出す。 */
export function bossPlace(app, stage, back) {
  const { info, wins } = bossState(app, stage);
  const name = bossName(app, stage);
  if (!info.available) {
    return h('div', { class: 'card boss-place off', 'data-boss-place': 'off' },
      h('div', { class: 'boss-place-head' }, bossArt(app, stage, 'off'),
        h('div', { class: 'boss-place-text' }, h('strong', { text: name }),
          h('span', { class: 'small muted', text: '間違えた問題が' + BOSS_MIN + '問たまると現れます（あと ' + info.need + ' 問）' }),
          wins ? h('span', { class: 'small muted', text: 'たおした回数 ' + wins + ' 回' }) : null)));
  }
  return h('div', { class: 'card boss-place on', 'data-boss-place': 'on' },
    h('div', { class: 'boss-place-head' }, bossArt(app, stage, 'on'),
      h('div', { class: 'boss-place-text' }, h('strong', { text: name + ' が あらわれた！' }),
        h('span', { class: 'small', text: '間違えた問題 ' + info.missed + ' 問が、ボスになりました' }),
        wins ? h('span', { class: 'small muted', text: 'たおした回数 ' + wins + ' 回' }) : null)),
    h('button', { class: 'btn primary big', type: 'button', 'data-boss-go': stage.key, onClick: () => openBoss(app, stage, back) }, 'ボスに挑む'));
}

const rand = (a, b) => a + Math.random() * (b - a);

export function renderBoss(app, key) {
  const root = h('section', { class: 'view boss' });
  const stage = app.data.tree.byKey.get(key);
  const back = app.bossBack || (stage ? '#/stage/' + encodeURIComponent(stage.key) : '#/review');
  app.bossBack = null;
  if (!stage || stage.depth !== 1) {
    root.appendChild(h('div', { class: 'card empty' }, h('p', { text: 'このボスは見つかりません。' }), h('button', { class: 'btn', type: 'button', onClick: () => app.go('#/review') }, '戻る')));
    return root;
  }
  const limit = secondsPerQuestion(app.config);
  const profile = bossProfileOf(app, stage);
  const name = profile.name;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let S = null; // 戦いの状態
  let ui = null; // 画面の部品
  let keyHandler = null;
  let timers = [];
  let typing = null; // いま出している文（{ finish }）
  let miniWatch = null; // 全身の絵の見え方を見るもの（IntersectionObserver）
  let textWatch = null; // 窓の文が変わったら、上の帯の一言も変える（MutationObserver）

  const later = (fn, ms) => {
    const id = setTimeout(() => { timers = timers.filter((x) => x !== id); fn(); }, ms);
    timers.push(id);
    return id;
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const cleanup = () => {
    clearTimers();
    typing = null;
    if (miniWatch) miniWatch.disconnect();
    miniWatch = null;
    if (textWatch) textWatch.disconnect();
    textWatch = null;
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    document.body.classList.remove('boss-on');
    setBgmBoss(false); // ほかの BGM に戻す
  };

  // 戦いを始める。まだ現れていない（間違えた問題が足りない）ときは false。ボスの体力は 5〜10 のどれか（出す問題の数まで）を隠したまま決める
  function begin() {
    const qs = bossQuestions(stage.questions, app.state.qstats);
    if (!qs.length) return false;
    S = { run: newRun(qs, rollBossHp(app.rng, qs.length)), streak: 0, xp: 0, log: [], answered: false, t0: 0, recorded: false, wins: 0, phase: 'intro', appeared: false, item: null, skipFx: null };
    return true;
  }

  function leave() {
    cleanup();
    app.go(back);
  }

  function onExit() {
    if (S && !S.run.battle.result && S.log.length && !confirm('途中で終了します。ここまでの回答の記録は残ります。')) return;
    leave();
  }

  // ---- 1文字ずつ出る文（窓の中）。lines を順に出す。skip（finish）で残りを一度に出す ----
  function say(lines, opts = {}) {
    if (typing) typing.finish();
    if (!opts.keep) clear(ui.text);
    const list = lines.filter(Boolean).map((l) => Array.from(l));
    ui.live.textContent = lines.filter(Boolean).join(' '); // 読み上げは全文を1度に（1文字ずつ読まれないよう、窓の文字は読み上げから外してある）
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

  // ---- 体力の表示（自分の体力だけ。ボスの体力は出さない） ----
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

  // 同じ動きをもう一度最初から（クラスを付け直す）
  function flash(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    later(() => el.classList.remove(cls), ms);
  }

  // ボスの絵（全身）と、上の帯の中の顔の丸に、同じ動き・同じ光り方をさせる
  function figFlash(cls, ms) {
    flash(ui.fig, cls, ms);
    flash(ui.miniArt, cls, ms);
  }
  function figClass(op, ...names) {
    [ui.fig, ui.miniArt].forEach((el) => { if (el) el.classList[op](...names); });
  }

  // 一番上へ戻って、戻りきってから fn を始める（演出が画面の外で終わらないように）。動きを減らす設定では一瞬で戻る。戻りきらなくても 1.5 秒で始める
  function atTop(fn) {
    if (reduced()) { window.scrollTo(0, 0); fn(); return; }
    if (window.scrollY <= 1) { fn(); return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const t0 = Date.now();
    const poll = () => { if (window.scrollY <= 1 || Date.now() - t0 > 1500) fn(); else later(poll, 30); };
    later(poll, 30);
  }

  // ---- 上の帯（全身の絵が画面から外れそうになったら、画面の上に貼り付く。顔の丸・名前・ハート・最新の一言。押せない） ----
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

  // ---- 画面の骨組み（戦いの間は、問題の入れ替えでも作り直さない） ----
  function buildScreen() {
    clear(root);
    root.classList.add('boss-rpg');
    document.body.classList.add('boss-on');
    const fig = bossFigure(app, stage, profile);
    const fx = h('div', { class: 'boss-fx', 'aria-hidden': 'true' });
    const confetti = h('div', { class: 'boss-confetti', 'aria-hidden': 'true' });
    const flashEl = h('div', { class: 'boss-flash', 'aria-hidden': 'true' });
    const stageEl = h('div', { class: 'boss-stage', 'data-boss-stage': '1', onClick: onTap }, fig, fx, confetti, flashEl);
    stageEl.style.setProperty('--boss-color', profile.color);
    const text = h('div', { class: 'boss-win-text', 'aria-hidden': 'true' });
    const live = h('p', { class: 'boss-sr', role: 'status' });
    const hp = h('span', { class: 'boss-win-hp' });
    const extra = h('div', { class: 'boss-win-extra' });
    const win = h('div', { class: 'boss-window', 'data-boss-window': '1', onClick: onTap },
      h('div', { class: 'boss-win-head' }, h('strong', { class: 'boss-win-name', text: name }), hp), text, extra, live);
    const top = h('div', { class: 'boss-top' },
      h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': '終了する', 'data-boss-exit': '1', onClick: onExit }, icon('close')),
      h('span', { class: 'small boss-chapter', text: stage.name }));
    const qarea = h('div', { class: 'boss-qarea' });
    const after = h('div', { class: 'after' });
    const scene = h('div', { class: 'boss-scene' }, stageEl, win);
    const miniArt = bossArt(app, stage, 'mini');
    const miniHp = h('span', { class: 'boss-mini-hp' });
    const miniTextEl = h('span', { class: 'boss-mini-text' });
    const mini = h('div', { class: 'boss-mini', 'data-boss-mini': '1', 'aria-hidden': 'true' }, miniArt,
      h('div', { class: 'boss-mini-body' }, h('div', { class: 'boss-mini-row' }, h('strong', { class: 'boss-mini-name', text: name }), miniHp), miniTextEl),
      h('span', { class: 'boss-mini-flash' }));
    mini.style.setProperty('--boss-color', profile.color);
    [top, scene, qarea, after, mini].forEach((n) => root.appendChild(n));
    for (let k = 0; k < 56; k++) {
      const s = h('span', { class: 'confetti c' + (k % 5) });
      s.style.left = Math.round(Math.random() * 100) + '%';
      s.style.setProperty('--delay', (Math.random() * 0.9).toFixed(2) + 's');
      s.style.setProperty('--dur', (1.6 + Math.random() * 1.4).toFixed(2) + 's');
      s.style.setProperty('--sway', Math.round(Math.random() * 120 - 60) + 'px');
      confetti.appendChild(s);
    }
    ui = { scene, stage: stageEl, fig, fx, confetti, flash: flashEl, text, live, hp, extra, win, qarea, after, btns: [], mini, miniArt, miniHp, miniText: miniTextEl };
    paintHp(S.run.battle);
    if (miniWatch) miniWatch.disconnect();
    if (textWatch) textWatch.disconnect();
    watchStage();
    if (typeof MutationObserver === 'function') {
      textWatch = new MutationObserver(miniSync);
      textWatch.observe(text, { childList: true, characterData: true, subtree: true });
    }
  }

  // 画面や窓をタップしたとき: 登場・撃破の演出はとばす。文が出ている途中なら、残りを一度に出す
  function onTap() {
    if (!S) return;
    if (S.phase === 'intro') finishIntro();
    else if (S.phase === 'defeat' && S.skipFx) S.skipFx();
    else if (typing) typing.finish();
  }

  // ---- 登場の演出（暗転 → 数回点滅 → ボスが現れて揺れる → 「あらわれた！」と登場のせりふ。2〜3秒。タップでとばせる） ----
  function startIntro() {
    S.phase = 'intro';
    S.appeared = false;
    ui.stage.classList.add('dark');
    ui.fig.classList.add('unseen');
    clear(ui.qarea);
    ui.qarea.appendChild(h('button', { class: 'btn small-btn boss-skip', type: 'button', 'data-boss-skip': '1', onClick: finishIntro }, 'とばす（タップでもとばせます）'));
    setBgmBoss(true); // ここから、ほかの BGM は小さくなって止まる（BGM がオンの人だけ）
    if (reduced()) {
      later(appear, 250);
      return;
    }
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
    startBossTheme();
    say([name + ' が あらわれた！', quoted(pickLine(profile, 'appear', app.rng))], { instant, onDone: () => { if (S.phase === 'intro') later(finishIntro, 300); } });
  }

  function finishIntro() {
    if (!S || S.phase !== 'intro') return;
    S.phase = 'question';
    clearTimers();
    appear(true); // まだ現れていなければ、いま現れる
    if (typing) typing.finish();
    ui.fig.classList.remove('appear');
    drawQuestion();
  }

  // ---- 1問 ----
  function drawQuestion() {
    clear(ui.qarea);
    clear(ui.after);
    const q0 = currentQuestion(S.run);
    if (!q0) { endBattle(); return; }
    const sq = shuffleChoices(q0, app.rng);
    S.item = sq;
    S.answered = false;
    S.phase = 'question';
    const q = sq.q;
    ui.qarea.appendChild(h('div', { class: 'play-head boss-qhead' },
      h('span', { class: 'small muted boss-round', text: S.run.round > 1 ? 'もう一度出す問題（' + S.run.round + '回目）' : '章の復習' }),
      laterButton(app, q, { compact: true })));
    if (!S.log.length) ui.qarea.appendChild(h('p', { class: 'small muted boss-rule', text: '正解でボスにダメージ。何問で倒せるかは分かりません。間違えるとハートが1つ減り（3つなくなると負け）、その問題は最後にもう一度出ます。10秒以内に正解すると、会心の一撃が出ることがあります。' }));
    const card = h('div', { class: 'card q-card' });
    const tags = h('div', { class: 'q-tags' }, h('span', { class: 'chip', text: q.syllabus.slice(1, 3).join(' › ') || q.syllabus[0] }), statusChip(q.status));
    if (q.format === 'not') tags.appendChild(h('span', { class: 'chip warn', text: '適切でないものを選ぶ' }));
    if (q.format === 'scenario') tags.appendChild(h('span', { class: 'chip', text: '場面問題' }));
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
    if (S.log.length) window.scrollTo(0, 0);
  }

  function answer(chosen) {
    if (!S || S.phase !== 'question' || S.answered) return;
    S.answered = true;
    const sq = S.item;
    const correct = chosen !== null && chosen === sq.answer;
    const seconds = (Date.now() - S.t0) / 1000;
    S.streak = correct ? S.streak + 1 : 0;
    const r = app.recordAnswer(sq.q, { correct, seconds, sessionStreak: S.streak, limit });
    S.xp += r.xp;
    S.log.push({ q: sq.q, sq, correct, chosen });
    const crit = isCritical(correct, seconds, app.rng); // 10秒以内の正解で、4回に1回
    const heartsBefore = S.run.battle.player;
    S.run = answerRun(S.run, correct, crit ? CRIT_DAMAGE : 1);
    const b = S.run.battle;
    const lost = b.player < heartsBefore;
    paintHp(b, -1); // 割れる動きは、いちばん上へ戻ってから（下の perform）
    const { btns, after } = ui;
    btns.forEach((bt, i) => {
      bt.disabled = true;
      bt.classList.toggle('ok', i === sq.answer);
      bt.classList.toggle('ng', i === chosen && !correct);
      const mark = bt.querySelector('.mark');
      if (i === sq.answer) mark.textContent = '✓';
      else if (i === chosen) mark.textContent = '✗';
    });
    const open = (id) => openCardSheet(app, id);
    let cheer = false;
    const note = correct
      ? (crit ? '会心の一撃！' : 'ボスに ダメージ')
      : b.result === 'lose' ? 'ハートがなくなりました' : 'ハートが1つ減りました。この問題は最後にもう一度出ます';
    after.appendChild(h('div', { class: 'verdict ' + (correct ? 'ok' : 'ng'), role: 'status', 'data-boss-verdict': correct ? 'ok' : 'ng' },
      h('strong', { text: correct ? '正解！' : '残念…' }),
      correct ? h('span', { class: 'xp', text: '+' + r.xp + ' XP' }) : null,
      h('span', { class: 'small', text: note }),
      r.leveledUp ? h('span', { class: 'levelup', text: 'レベルアップ！ Lv ' + r.levelAfter }) : null));
    const meaning = stemPlainBlock(sq.q);
    if (correct) {
      if (meaning) after.appendChild(meaning);
      vibrate(app.state.settings, crit ? [30, 30, 60] : 30);
      beep(app.state.settings, 'ok');
    } else {
      vibrate(app.state.settings, [60, 40, 60]); // 不正解の音（ng）は、ここでは鳴らさない。戻りきってから、ハートが割れるのと同時に『ドン』（bosshurt）を鳴らす。ファイルが読めないときだけ ng に戻る
      cheer = shouldCheer(S.log.map((x) => x.correct));
      if (cheer) after.appendChild(mascotLine('shiba-cheer', CHARACTER_TEXT.cheer, 'cheer'));
      if (meaning) after.appendChild(meaning);
      const sb = stumbleBlock(app, sq.q, open);
      if (sb) after.appendChild(sb);
    }
    after.appendChild(explanation(app, sq, chosen, open, { sensei: !cheer }));
    const next = h('button', { class: 'btn primary big next', type: 'button', 'data-boss-next': '1', onClick: () => { if (typing) typing.finish(); if (b.result) endBattle(); else drawQuestion(); } }, b.result ? '結果を見る' : '次の問題へ');
    const bar = h('div', { class: 'sticky-bar' }, next);
    after.appendChild(bar);

    // 戦いの演出（ボスの反応と窓の文）。いちばん上へ戻りきってから始める（全身の絵が見えているところで演出を見せる）
    const winNow = correct && b.result === 'win';
    if (winNow) bar.classList.add('hidden'); // 撃破の演出が終わるまで、先へ進むボタンは出さない（タップでとばせる）
    else next.focus({ preventScroll: true });
    const perform = () => {
      if (!S || S.item !== sq || !ui || !ui.stage.isConnected) return; // 戻っている間に次の問題へ進んだ・画面が替わったときは何もしない
      if (correct) playBossSfx(app.state.settings, 'hit'); // ボスに当たった音（とどめの一撃でも鳴らす）
      if (winNow) {
        defeatSequence(bar, next);
      } else if (correct) {
        figFlash('hit', 700);
        if (crit) { flash(ui.stage, 'crit', 450); flash(ui.mini, 'crit', 450); playSynth(app.state.settings, 'crit'); }
        const mood = bossMood(b);
        say(crit
          ? ['会心の一撃！', name + ' に ダメージ！', BOSS_MOOD_TEXT[mood]]
          : [name + ' に ダメージ！', quoted(pickLine(profile, 'hurt', app.rng)), BOSS_MOOD_TEXT[mood]]);
      } else {
        playBossSfx(app.state.settings, 'hurt'); // ボスからダメージをもらった音（ふつうの不正解の音の代わり。ハートが割れる動きと同時）
        if (lost) paintHp(b, b.player); // ハートが割れる動きも、戻りきってから
        flash(ui.stage, 'hurt', 500);
        flash(ui.mini, 'hurt', 500);
        flash(ui.scene, 'quake', 450);
        say([name + ' の こうげき！', quoted(pickLine(profile, 'attack', app.rng)), b.result === 'lose' ? 'あなたは たおれてしまった…' : 'あなたは ダメージを うけた！']);
        if (b.result === 'lose') stopBossTheme();
      }
    };
    atTop(perform);
  }

  // ---- 撃破の演出（白く光る → 点滅 → 細かい粒に崩れて消える → 「たおした！」とせりふ・ファンファーレ・紙吹雪 → XP が数え上がる。4〜5秒。タップで最後まで飛ばせる） ----
  function defeatSequence(bar, next) {
    S.phase = 'defeat';
    stopBossTheme();
    const R = reduced();
    const xpEl = h('p', { class: 'boss-xp', 'data-boss-xp': '1', text: 'XP +0' });
    ui.extra.appendChild(xpEl);
    const lines = [name + ' を たおした！', quoted(pickLine(profile, 'defeat', app.rng))];
    let done = false;
    let said = false; // 「たおした！」の文を出したか
    const showFinal = () => {
      xpEl.textContent = 'XP +' + S.xp;
      xpEl.classList.add('final');
    };
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
      crumble();
      figClass('add', 'gone');
      playBossSfx(app.state.settings, 'win');
      vibrate(app.state.settings, [40, 30, 40, 30, 80]);
    }, 1350);
    later(() => { said = true; say(lines); }, 1450);
    later(() => ui.confetti.classList.add('on'), 1500);
    later(() => countUp(xpEl, S.xp, 1300), 2800);
    later(finish, 4500);
  }

  // 絵を細かい粒（小さな四角）に分けて、散らして落とす。絵が無ければ、ボスの色の粒
  function crumble() {
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
          bit.style.backgroundColor = profile.color;
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

  // 数を 0 から to まで数え上げる
  function countUp(el, to, ms) {
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      el.textContent = 'XP +' + Math.round(to * k);
      if (k < 1) later(tick, 40);
    };
    tick();
  }

  // ---- 勝ち・負け ----
  function endBattle() {
    if (!S) return;
    clearTimers();
    if (typing) typing.finish();
    clear(root);
    document.body.classList.add('boss-on');
    setBgmBoss(false); // ここでふつうの BGM に戻る
    const win = S.run.battle.result === 'win';
    if (win && !S.recorded) {
      S.recorded = true;
      S.wins = recordBossWin(app.state, stage.key, isFlawlessWin(S.run.battle));
    }
    app.commit();
    S.phase = 'result';
    const ok = S.log.filter((x) => x.correct).length;
    const card = h('div', { class: 'card result boss-result ' + (win ? 'win' : 'lose'), 'data-boss-result': win ? 'win' : 'lose' },
      h('div', { class: 'boss-result-art' }, bossArt(app, stage, win ? 'down' : 'on')),
      h('h1', { text: win ? name + ' を たおした！' : '負けてしまった…' }),
      win
        ? h('p', { class: 'score' }, 'この章のボスを ', h('strong', { text: S.wins + ' 回' }), ' たおしました')
        : h('p', { text: 'ハートがなくなりました。解説を読んで、もう一度挑みましょう。' }),
      h('p', { class: 'small muted', text: S.log.length + ' 回答えて、' + ok + ' 回正解しました' }),
      h('p', { class: 'xp-total', text: '獲得 ' + S.xp + ' XP' }));
    const info = bossInfo(stage.questions, app.state.qstats);
    card.appendChild(h('p', { class: 'small muted', text: info.available
      ? 'この章にはまだ、最後に間違えた問題が ' + info.missed + ' 問あります。ボスはまた挑めます。'
      : 'この章の、最後に間違えた問題は ' + info.missed + ' 問になり、ボスは姿を消しました（' + BOSS_MIN + '問たまるとまた現れます）。' }));
    root.appendChild(card);
    if (win) {
      const m = mascotLine('shiba-banzai', 'やったね！ 間違えた問題をひとつずつ越えました。', 'win');
      if (m) card.appendChild(m);
      beep(app.state.settings, 'up');
      vibrate(app.state.settings, [40, 30, 40, 30, 80]);
    } else {
      const m = mascotLine('shiba-cheer', CHARACTER_TEXT.cheer, 'cheer');
      if (m) card.appendChild(m);
    }
    const wrong = S.log.filter((x) => !x.correct);
    if (wrong.length) {
      const l = h('div', { class: 'card' }, h('h2', { text: 'まちがえた問題（' + wrong.length + '）' }));
      wrong.forEach((x) => {
        l.appendChild(h('details', { class: 'miss' }, h('summary', { text: x.q.stem }), stemPlainBlock(x.q), explanation(app, x.sq, x.chosen, (id) => openCardSheet(app, id), { sensei: false })));
      });
      root.appendChild(l);
    }
    const row = h('div', { class: 'btn-row' });
    if (info.available) {
      row.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-boss-again': '1', onClick: again }, 'もう一度挑む'));
    }
    row.appendChild(h('button', { class: 'btn big', type: 'button', 'data-boss-back': '1', onClick: leave }, '戻る'));
    if (!info.available) row.classList.add('one');
    root.appendChild(row);
    window.scrollTo(0, 0);
    app.flushCelebrations();
  }

  function again() {
    if (begin()) { bindKeys(); buildScreen(); startIntro(); } else toast('いまはボスが現れていません', 'warn');
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
    const info = bossInfo(stage.questions, app.state.qstats);
    root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: leave }, '← 戻る'));
    root.appendChild(h('h1', { text: name }));
    root.appendChild(h('div', { class: 'card empty', 'data-boss-none': '1' },
      h('p', { text: 'この章のボスはまだ現れていません。' }),
      h('p', { class: 'small muted', text: '間違えた問題が' + BOSS_MIN + '問たまると現れます（あと ' + info.need + ' 問）。' })));
    return root;
  }
  bindKeys();
  buildScreen();
  startIntro();
  return { el: root, cleanup };
}
