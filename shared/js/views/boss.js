// 章のボス戦（要件定義書 §3-7）。その章で最後に間違えた問題を最大10問、ボスの体力＝問題の数、自分の体力＝3で戦う。
// 計算は lib/boss.js（体力・出す問題・撃破の記録）と lib/bossrun.js（1回の戦いの進み方）。ここは画面だけ。
// 答えはふつうの出題と同じに問題の記録（qstats・復習の予定・XP）に入る（復習そのものなので）。
import { h, clear, icon, burst, vibrate, beep, toast, mascotLine } from '../ui.js';
import { shouldCheer, CHARACTER_TEXT } from '../lib/characters.js';
import { shuffleChoices, secondsPerQuestion } from '../lib/quiz.js';
import { bossInfo, bossQuestions, recordBossWin, isFlawlessWin, bossWins, BOSS_MIN } from '../lib/boss.js';
import { newRun, currentQuestion, answerRun } from '../lib/bossrun.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, laterButton, stumbleBlock, stemPlainBlock, CHOICE_LABELS } from './explain.js';

// ボスの見た目。絵がまだ無いので、記号と名前で出す。
// 絵を足すとき: <アプリ>/images/bosses/boss-<番号>.webp を置く（番号＝地図の章の番号。1から。bossImageUrl を見る）。置くだけで記号と入れ替わる。
export const BOSS_SYMBOL = '魔';

/** ボスの名前。 */
export function bossName(stage) {
  return stage.name + 'の章のボス';
}

/** ボスの絵の URL。番号は地図の章の並び（data.tree.stages の順）。 */
export function bossImageUrl(app, stage) {
  const n = app.data.tree.stages.indexOf(stage) + 1;
  return n > 0 ? new URL('./images/bosses/boss-' + n + '.webp', location.href).href : null;
}

/** ボスの姿（円の中の記号）。絵のファイルがあれば、読み込めたときだけ絵に入れ替える。飾りなので読み上げない。 */
export function bossArt(app, stage, cls) {
  const wrap = h('span', { class: 'boss-art ' + (cls || ''), 'aria-hidden': 'true' }, h('span', { class: 'boss-sym', text: BOSS_SYMBOL }));
  const url = bossImageUrl(app, stage);
  if (url) {
    const img = new Image();
    img.className = 'boss-img';
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('load', () => {
      clear(wrap);
      wrap.appendChild(img);
    });
    img.src = url;
  }
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
  const name = bossName(stage);
  if (!info.available) {
    return h('div', { class: 'card boss-place off', 'data-boss-place': 'off' },
      h('div', { class: 'boss-place-head' }, bossArt(app, stage, 'off'),
        h('div', { class: 'boss-place-text' }, h('strong', { text: name }),
          h('span', { class: 'small muted', text: '間違えた問題が' + BOSS_MIN + '問たまると現れます（あと ' + info.need + ' 問）' }),
          wins ? h('span', { class: 'small muted', text: 'たおした回数 ' + wins + ' 回' }) : null)));
  }
  const n = Math.min(info.missed, 10);
  return h('div', { class: 'card boss-place on', 'data-boss-place': 'on' },
    h('div', { class: 'boss-place-head' }, bossArt(app, stage, 'on'),
      h('div', { class: 'boss-place-text' }, h('strong', { text: name + 'が現れた！' }),
        h('span', { class: 'small', text: '間違えた問題 ' + info.missed + ' 問に挑めます（1回に最大10問）' }),
        wins ? h('span', { class: 'small muted', text: 'たおした回数 ' + wins + ' 回' }) : null)),
    h('button', { class: 'btn primary big', type: 'button', 'data-boss-go': stage.key, onClick: () => openBoss(app, stage, back) }, 'ボスに挑む（' + n + '問）'));
}

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
  const name = bossName(stage);
  let S = null;
  let keyHandler = null;

  const cleanup = () => {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  };

  // 戦いを始める。まだ現れていない（間違えた問題が足りない）ときは false
  function begin() {
    const qs = bossQuestions(stage.questions, app.state.qstats);
    if (!qs.length) return false;
    S = { run: newRun(qs), items: [], idx: 0, streak: 0, xp: 0, log: [], answered: false, t0: 0, recorded: false, wins: 0, ui: null };
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

  // ---- 体力の表示 ----
  function hearts(b) {
    const w = h('span', { class: 'boss-hearts', role: 'img', 'aria-label': 'あなたの体力 ' + b.player + '／' + b.playerMax });
    for (let i = 0; i < b.playerMax; i++) w.appendChild(icon('heart', 'heart ' + (i < b.player ? 'on' : 'off')));
    return w;
  }

  function battlePanel(b) {
    const fill = h('div', { class: 'boss-hp-fill' });
    fill.style.width = (b.bossMax ? (b.boss / b.bossMax) * 100 : 0) + '%';
    const hpText = h('strong', { class: 'boss-hp-text', text: 'ボスの体力 ' + b.boss + ' / ' + b.bossMax });
    const bar = h('div', { class: 'boss-hp', role: 'progressbar', 'aria-label': 'ボスの体力', 'aria-valuemin': '0', 'aria-valuemax': String(b.bossMax), 'aria-valuenow': String(b.boss) }, fill);
    const heartBox = h('div', { class: 'boss-me-hearts' }, hearts(b));
    const panel = h('div', { class: 'card boss-battle', 'data-boss-battle': '1' },
      h('div', { class: 'boss-foe' }, bossArt(app, stage, 'on'), h('div', { class: 'boss-foe-info' }, h('span', { class: 'small muted', text: name }), hpText, bar)),
      h('div', { class: 'boss-me' }, h('span', { class: 'small muted', text: 'あなたの体力' }), heartBox));
    return { panel, fill, hpText, bar, heartBox };
  }

  function paintBattle(b) {
    const u = S.ui;
    u.fill.style.width = (b.bossMax ? (b.boss / b.bossMax) * 100 : 0) + '%';
    u.hpText.textContent = 'ボスの体力 ' + b.boss + ' / ' + b.bossMax;
    u.bar.setAttribute('aria-valuenow', String(b.boss));
    clear(u.heartBox);
    u.heartBox.appendChild(hearts(b));
  }

  // ---- 1問 ----
  function draw() {
    clear(root);
    const q0 = currentQuestion(S.run);
    if (!q0) return drawResult();
    const sq = shuffleChoices(q0, app.rng);
    S.item = sq;
    S.answered = false;
    const q = sq.q;
    const b = S.run.battle;
    root.appendChild(h('div', { class: 'play-head' },
      h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': '終了する', onClick: onExit }, icon('close')),
      h('div', { class: 'play-title' }, h('strong', { text: name }), h('span', { class: 'small muted', text: S.run.round > 1 ? 'もう一度出す問題（' + S.run.round + '回目）' : '章の復習' })),
      laterButton(app, q, { compact: true })));
    const bp = battlePanel(b);
    S.ui = { fill: bp.fill, hpText: bp.hpText, bar: bp.bar, heartBox: bp.heartBox };
    root.appendChild(bp.panel);
    if (!S.log.length) root.appendChild(h('p', { class: 'small muted boss-rule', text: '正解でボスの体力が1減ります。間違えるとハートが1つ減り、その問題は最後にもう一度出ます。' }));
    const card = h('div', { class: 'card q-card' });
    const tags = h('div', { class: 'q-tags' }, h('span', { class: 'chip', text: q.syllabus.slice(1, 3).join(' › ') || q.syllabus[0] }), statusChip(q.status));
    if (q.format === 'not') tags.appendChild(h('span', { class: 'chip warn', text: '適切でないものを選ぶ' }));
    if (q.format === 'scenario') tags.appendChild(h('span', { class: 'chip', text: '場面問題' }));
    card.appendChild(tags);
    card.appendChild(h('p', { class: 'stem', text: q.stem }));
    const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '選択肢' });
    const btns = sq.choices.map((c, i) => {
      const bt = h('button', { class: 'choice', type: 'button', 'data-boss-choice': String(i), onClick: () => answer(i) },
        h('span', { class: 'mark', 'aria-hidden': 'true', text: CHOICE_LABELS[i] }), h('span', { class: 'ctext', text: c }));
      choices.appendChild(bt);
      return bt;
    });
    card.appendChild(choices);
    root.appendChild(card);
    const after = h('div', { class: 'after' });
    root.appendChild(after);
    S.ui.btns = btns;
    S.ui.after = after;
    S.t0 = Date.now();
    window.scrollTo(0, 0);
  }

  function answer(chosen) {
    if (!S || S.answered) return;
    S.answered = true;
    const sq = S.item;
    const correct = chosen !== null && chosen === sq.answer;
    const seconds = (Date.now() - S.t0) / 1000;
    S.streak = correct ? S.streak + 1 : 0;
    const r = app.recordAnswer(sq.q, { correct, seconds, sessionStreak: S.streak, limit });
    S.xp += r.xp;
    S.log.push({ q: sq.q, sq, correct, chosen });
    S.run = answerRun(S.run, correct);
    const b = S.run.battle;
    paintBattle(b);
    const { btns, after } = S.ui;
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
      ? 'ボスの体力 -1'
      : b.result === 'lose' ? 'ハートがなくなりました' : 'ハートが1つ減りました。この問題は最後にもう一度出ます';
    after.appendChild(h('div', { class: 'verdict ' + (correct ? 'ok' : 'ng'), role: 'status', 'data-boss-verdict': correct ? 'ok' : 'ng' },
      h('strong', { text: correct ? '正解！' : '残念…' }),
      correct ? h('span', { class: 'xp', text: '+' + r.xp + ' XP' }) : null,
      h('span', { class: 'small', text: note }),
      r.leveledUp ? h('span', { class: 'levelup', text: 'レベルアップ！ Lv ' + r.levelAfter }) : null));
    const meaning = stemPlainBlock(sq.q);
    if (correct) {
      if (meaning) after.appendChild(meaning);
      burst(btns[sq.answer]);
      vibrate(app.state.settings, 30);
      beep(app.state.settings, 'ok');
    } else {
      vibrate(app.state.settings, [60, 40, 60]);
      beep(app.state.settings, 'ng');
      cheer = shouldCheer(S.log.map((x) => x.correct));
      if (cheer) after.appendChild(mascotLine('shiba-cheer', CHARACTER_TEXT.cheer, 'cheer'));
      if (meaning) after.appendChild(meaning);
      const sb = stumbleBlock(app, sq.q, open);
      if (sb) after.appendChild(sb);
    }
    after.appendChild(explanation(app, sq, chosen, open, { sensei: !cheer }));
    const next = h('button', { class: 'btn primary big next', type: 'button', 'data-boss-next': '1', onClick: draw }, b.result ? '結果を見る' : '次の問題へ');
    after.appendChild(h('div', { class: 'sticky-bar' }, next));
    after.scrollIntoView({ behavior: 'smooth', block: 'start' });
    next.focus({ preventScroll: true });
  }

  // ---- 勝ち・負け ----
  function drawResult() {
    clear(root);
    cleanup();
    const win = S.run.battle.result === 'win';
    if (win && !S.recorded) {
      S.recorded = true;
      S.wins = recordBossWin(app.state, stage.key, isFlawlessWin(S.run.battle));
    }
    app.commit();
    const ok = S.log.filter((x) => x.correct).length;
    const card = h('div', { class: 'card result boss-result ' + (win ? 'win' : 'lose'), 'data-boss-result': win ? 'win' : 'lose' },
      h('div', { class: 'boss-result-art' }, bossArt(app, stage, win ? 'down' : 'on')),
      h('h1', { text: win ? name + 'をたおした！' : '負けてしまった…' }),
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
      row.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-boss-again': '1', onClick: () => { if (begin()) { bindKeys(); draw(); } else toast('いまはボスが現れていません', 'warn'); } }, 'もう一度挑む'));
    }
    row.appendChild(h('button', { class: 'btn big', type: 'button', 'data-boss-back': '1', onClick: leave }, '戻る'));
    if (!info.available) row.classList.add('one');
    root.appendChild(row);
    window.scrollTo(0, 0);
    app.flushCelebrations();
  }

  function bindKeys() {
    cleanup();
    keyHandler = (e) => {
      if (document.querySelector('.sheet-back')) return;
      if (S && !S.answered && S.item && /^[1-8]$/.test(e.key)) {
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
  draw();
  return { el: root, cleanup };
}
