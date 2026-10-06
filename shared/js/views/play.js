// 出題画面。ステージ・復習・秒数つきチャレンジで共通（mode で挙動が少し変わる）。
import { h, clear, icon, stars, burst, vibrate, beep, toast, mascotLine } from '../ui.js';
import { shouldCheer, CHARACTER_TEXT } from '../lib/characters.js';
import { shuffleChoices, challengeName, secondsPerQuestion } from '../lib/quiz.js';
import { recordStageResult, recordChallenge } from '../lib/progress.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, stumbleBlock, CHOICE_LABELS } from './explain.js';

/**
 * spec: { mode:'stage'|'review'|'challenge', title, pick(app)->質問の配列, stageKey?, backHash }
 * 次の画面（#/play）に渡すため app.session に置く。
 */
export function startSession(app, spec) {
  const questions = spec.pick(app);
  if (!questions.length) {
    toast('出題できる問題がありません', 'warn');
    return;
  }
  app.session = { ...spec, questions };
  app.go('#/play');
}

export function renderPlay(app) {
  const spec = app.session;
  if (!spec) {
    app.go('#/home');
    return h('div');
  }
  const limit = secondsPerQuestion(app.config);
  const timed = spec.mode === 'challenge';
  const S = {
    idx: 0,
    items: spec.questions.map((q) => shuffleChoices(q, app.rng)),
    results: [],
    streak: 0,
    xp: 0,
    answered: false,
    t0: 0,
    timer: null,
  };
  const root = h('section', { class: 'view play' });
  let keyHandler = null;

  const stop = () => {
    if (S.timer) clearInterval(S.timer);
    S.timer = null;
  };
  const cleanup = () => {
    stop();
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
  };

  function header() {
    const n = S.items.length;
    return h('div', { class: 'play-head' },
      h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': '終了する', onClick: onExit }, icon('close')),
      h('div', { class: 'play-title' }, h('strong', { text: spec.title }), h('span', { class: 'small muted', text: Math.min(S.idx + 1, n) + ' / ' + n })),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': String(S.idx) }, h('div', { class: 'progress-fill', style: { width: (S.idx / n) * 100 + '%' } })));
  }

  function onExit() {
    if (S.results.length && S.results.length < S.items.length && !confirm('途中で終了します。ここまでの回答の記録は残ります。')) return;
    cleanup();
    app.session = null;
    app.go(spec.backHash || '#/home');
  }

  function draw() {
    stop();
    clear(root);
    if (S.idx >= S.items.length) return drawResult();
    const sq = S.items[S.idx];
    const q = sq.q;
    S.answered = false;
    root.appendChild(header());
    const card = h('div', { class: 'card q-card' });
    const tags = h('div', { class: 'q-tags' }, h('span', { class: 'chip', text: q.syllabus.slice(1, 3).join(' › ') || q.syllabus[0] }), statusChip(q.status));
    if (q.format === 'not') tags.appendChild(h('span', { class: 'chip warn', text: '適切でないものを選ぶ' }));
    if (q.format === 'scenario') tags.appendChild(h('span', { class: 'chip', text: '場面問題' }));
    card.appendChild(tags);
    if (timed) {
      var fill = h('div', { class: 'timer-fill' });
      var left = h('span', { class: 'timer-left', text: 'あと ' + limit + ' 秒' });
      card.appendChild(h('div', { class: 'timer', 'aria-hidden': 'true' }, fill));
      card.appendChild(left);
    }
    card.appendChild(h('p', { class: 'stem', text: q.stem }));
    const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '選択肢' });
    const btns = sq.choices.map((c, i) => {
      const b = h('button', { class: 'choice', type: 'button', onClick: () => answer(i) },
        h('span', { class: 'mark', 'aria-hidden': 'true', text: CHOICE_LABELS[i] }), h('span', { class: 'ctext', text: c }));
      choices.appendChild(b);
      return b;
    });
    card.appendChild(choices);
    root.appendChild(card);
    const after = h('div', { class: 'after' });
    root.appendChild(after);
    S.ui = { btns, after, card };
    S.t0 = Date.now();
    if (timed) {
      S.timer = setInterval(() => {
        const sec = (Date.now() - S.t0) / 1000;
        const rest = Math.max(0, limit - sec);
        fill.style.width = (rest / limit) * 100 + '%';
        left.textContent = 'あと ' + Math.ceil(rest) + ' 秒';
        if (rest <= 0) answer(null);
      }, 200);
    }
    window.scrollTo(0, 0);
  }

  function answer(chosen) {
    if (S.answered) return;
    S.answered = true;
    stop();
    const sq = S.items[S.idx];
    const correct = chosen !== null && chosen === sq.answer;
    const seconds = (Date.now() - S.t0) / 1000;
    S.streak = correct ? S.streak + 1 : 0;
    const r = app.recordAnswer(sq.q, { correct, seconds, sessionStreak: S.streak, limit });
    S.xp += r.xp;
    S.results.push({ q: sq.q, sq, correct, chosen });
    const { btns, after } = S.ui;
    btns.forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle('ok', i === sq.answer);
      b.classList.toggle('ng', i === chosen && !correct);
      const mark = b.querySelector('.mark');
      if (i === sq.answer) mark.textContent = '✓';
      else if (i === chosen) mark.textContent = '✗';
    });
    const open = (id) => openCardSheet(app, id);
    let cheer = false;
    const verdict = h('div', { class: 'verdict ' + (correct ? 'ok' : 'ng'), role: 'status' },
      h('strong', { text: correct ? '正解！' : chosen === null ? '時間切れ' : '残念…' }),
      correct ? h('span', { class: 'xp', text: '+' + r.xp + ' XP' }) : null,
      correct && (r.parts.first || r.parts.streak || r.parts.time)
        ? h('span', { class: 'small', text: [r.parts.first ? '初見 +' + r.parts.first : '', r.parts.streak ? S.streak + '連続 +' + r.parts.streak : '', r.parts.time ? '時間内 +' + r.parts.time : ''].filter(Boolean).join('  ') })
        : null,
      r.leveledUp ? h('span', { class: 'levelup', text: 'レベルアップ！ Lv ' + r.levelAfter }) : null);
    after.appendChild(verdict);
    if (correct) {
      burst(btns[sq.answer]);
      vibrate(app.state.settings, 30);
      beep(app.state.settings, 'ok'); // レベルアップのファンファーレは、お祝いの画面で鳴らす（二重に鳴らさない）
    } else {
      vibrate(app.state.settings, [60, 40, 60]);
      beep(app.state.settings, 'ng');
      // 3問続けて不正解のときは、柴犬が応援する（このとき先生の絵は出さない。1画面に1人まで）
      cheer = shouldCheer(S.results.map((r) => r.correct));
      if (cheer) after.appendChild(mascotLine('shiba-cheer', CHARACTER_TEXT.cheer, 'cheer'));
      const sb = stumbleBlock(app, sq.q, open);
      if (sb) after.appendChild(sb);
    }
    after.appendChild(explanation(app, sq, chosen, open, { sensei: !cheer }));
    const last = S.idx === S.items.length - 1;
    const next = h('button', { class: 'btn primary big next', type: 'button', onClick: () => { S.idx++; draw(); } }, last ? '結果を見る' : '次の問題へ');
    after.appendChild(h('div', { class: 'sticky-bar' }, next));
    after.scrollIntoView({ behavior: 'smooth', block: 'start' });
    next.focus({ preventScroll: true });
  }

  function drawResult() {
    clear(root);
    cleanup();
    const total = S.results.length;
    const ok = S.results.filter((r) => r.correct).length;
    let starInfo = null;
    if (spec.mode === 'stage' && !spec.small) {
      starInfo = recordStageResult(app.state, spec.stageKey, ok, total, app.starThresholds);
    }
    if (spec.mode === 'challenge') recordChallenge(app.state, ok);
    app.commit();
    const wrong = S.results.filter((r) => !r.correct);
    const card = h('div', { class: 'card result' },
      h('h1', { text: spec.mode === 'review' ? '復習おわり' : spec.mode === 'challenge' ? challengeName(app.config) + ' 結果' : 'ステージ結果' }),
      h('p', { class: 'score' }, h('strong', { text: ok + ' / ' + total }), ' 正解（' + Math.round((ok / Math.max(1, total)) * 100) + '%）'),
      h('p', { class: 'xp-total', text: '獲得 ' + S.xp + ' XP' }));
    if (starInfo) {
      card.appendChild(h('div', { class: 'star-result' }, stars(starInfo.stars)));
      card.appendChild(h('p', { text: starInfo.stars === 0 ? 'あと少し！ 解説を読んでもう一度。' : starInfo.improved ? 'ステージクリア！ 星が増えました。' : 'ステージクリア！' }));
      if (starInfo.improved && starInfo.stars > 0) app.queueStars(spec.title, starInfo.stars);
    }
    if (spec.mode === 'review') card.appendChild(h('p', { class: 'small muted', text: 'まちがえた問題は、あすもう一度出ます。' }));
    root.appendChild(card);
    if (wrong.length) {
      const l = h('div', { class: 'card' }, h('h2', { text: 'まちがえた問題（' + wrong.length + '）' }));
      wrong.forEach((r) => {
        l.appendChild(h('details', { class: 'miss' }, h('summary', { text: r.q.stem }), explanation(app, r.sq, r.chosen, (id) => openCardSheet(app, id), { sensei: false })));
      });
      root.appendChild(l);
    }
    const retry = h('button', { class: 'btn primary big', type: 'button', onClick: () => { app.session = null; startSession(app, spec); } }, 'もう一度');
    const back = h('button', { class: 'btn big', type: 'button', onClick: () => { app.session = null; app.go(spec.backHash || '#/home'); } }, '戻る');
    root.appendChild(h('div', { class: 'btn-row' }, retry, back));
    window.scrollTo(0, 0);
    // 解いている間にたまったお祝い（レベルアップ・バッジ・星・1日の目標）をここで出す
    app.flushCelebrations();
  }

  keyHandler = (e) => {
    if (document.querySelector('.sheet-back')) return;
    if (!S.answered && /^[1-8]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (S.items[S.idx] && i < S.items[S.idx].choices.length) answer(i);
    }
  };
  document.addEventListener('keydown', keyHandler);
  draw();
  return { el: root, cleanup };
}
