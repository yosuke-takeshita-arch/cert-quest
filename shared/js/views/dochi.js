// 「どっち？」早押し（要件定義書 §3-5）。一行目（題名は〇〇に伏せる）を読んで、2つの題名のどちらかを選ぶ。秒数は説明の長さで決める（dochiSeconds）。
// 出題・伏せ方・記録の直し方は lib/dochi.js。ここは画面だけ。問題の記録（qstats）・XP には入れない。
import { h, clear, icon, burst, vibrate, beep, mascotLine, confirmQuit } from '../ui.js';
import { buildPairs, pickRound, isCorrect, nextCombo, recordDochi, normalizeDochi, dochiRank, DOCHI_ROUNDS, DOCHI_POINT_MS, dochiSeconds } from '../lib/dochi.js';
import { CHOICE_LABELS } from './explain.js';
import { dochiMascot } from '../lib/characters.js';
import { openCardSheet } from './cards.js';
import { setBgmRush } from '../audio.js';

const OK_PAUSE_MS = 600; // 正解のとき、次へ進むまでの間
// 結果発表の演出の長さ（要件定義書 §3-5）
const REVEAL_COUNT_DELAY_MS = 450; // 「結果発表！」が出てから、数え上げを始めるまで
const REVEAL_COUNT_MS = 1500; // 数え上げの長さ
const REVEAL_AFTER_STAMP_MS = 450; // はんこが押されてから、一言と記録更新の文が出るまで
const REVEAL_FLUSH_MS = 1000; // はんこが押されてから、お祝いの画面を出すまで
const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// 出せる組は、起動の間は変わらないので一度だけ作る（ホームの入口を出すかの判定にも使う）
const cache = new WeakMap();
export function dochiPairs(app) {
  if (!cache.has(app.data)) cache.set(app.data, buildPairs(app.data.concepts, app.data.conceptIndex).pairs);
  return cache.get(app.data);
}

export function renderDochi(app) {
  const root = h('section', { class: 'view dochi' });
  const pairs = dochiPairs(app);
  let S = null; // 遊んでいる間の状態
  let keyHandler = null;

  let revealTimers = []; // 結果発表の演出のタイマー（画面を離れるとき止める）
  const clearReveal = () => {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
  };
  const stopTimers = () => {
    if (!S) return;
    if (S.timer) clearInterval(S.timer);
    if (S.next) clearTimeout(S.next);
    S.timer = null;
    S.next = null;
  };
  const cleanup = () => {
    stopTimers();
    clearReveal();
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  };

  // ---- はじめの画面 ----
  function drawIntro() {
    cleanup();
    setBgmRush(false);
    S = null;
    clear(root);
    root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/home') }, '← ホーム'));
    root.appendChild(h('h1', { text: 'どっち？早押し' }));
    const d = normalizeDochi(app.state.dochi);
    const card = h('div', { class: 'card' },
      h('p', { text: '用語の説明を読んで、どの用語の説明か、2つのうちから選びます。似ていて間違えやすい組を、遊びながら見分けましょう。' }),
      h('ul', { class: 'plain' },
        h('li', { text: DOCHI_ROUNDS + '問。1問の秒数は説明の長さで決まります（長い説明ほど長い。時間切れは不正解）' }),
        h('li', { text: '正解が続くとコンボが伸びます' }),
        h('li', { text: '間違えたら、2つの違いを少しの間だけ出します' }),
        h('li', { text: '問題の記録・経験値（XP）には入りません' })));
    root.appendChild(card);
    if (!pairs.length) {
      root.appendChild(h('div', { class: 'card empty', 'data-dochi-empty': '1' }, h('p', { text: '出せる組がまだありません。' })));
      return;
    }
    root.appendChild(h('div', { class: 'card dochi-record', 'data-dochi-record': '1' },
      h('h2', { text: 'きろく' }),
      d.runs
        ? h('p', {}, '最高の正解数 ', h('strong', { text: d.best + ' / ' + DOCHI_ROUNDS }), '　最高コンボ ', h('strong', { text: String(d.bestCombo) }), h('span', { class: 'small muted', text: '（' + d.runs + '回あそびました）' }))
        : h('p', { class: 'muted', text: 'まだあそんでいません。' })));
    root.appendChild(h('button', { class: 'btn primary big', type: 'button', 'data-dochi-start': '1', onClick: start }, 'はじめる'));
  }

  function start() {
    cleanup();
    S = { items: pickRound(pairs, DOCHI_ROUNDS, app.rng), idx: 0, combo: 0, bestCombo: 0, results: [], answered: false, t0: 0, timer: null, next: null };
    document.addEventListener('keydown', (keyHandler = onKey));
    setBgmRush(true); // 問題中は、遊び専用の曲（BGM がオンのときだけ）
    drawQuestion();
  }

  function onKey(e) {
    if (document.querySelector('.sheet-back')) return;
    if (!S || S.answered || !S.items[S.idx]) return;
    if (e.key === '1' || e.key === '2') answer(Number(e.key) - 1);
  }

  const askExit = () => !(S && S.results.length < S.items.length && S.results.length) || confirmQuit('途中で終了します。この回の記録は残りません。');
  // スマホの「戻る」を押されたら、解いている途中なら確かめる（app.guardBack。2026-10-15 先生の決定 A）
  app.guardBack(askExit);

  async function onExit() {
    if (!(await askExit())) return;
    cleanup();
    app.go('#/home');
  }

  // ---- 1問 ----
  function comboText(n) {
    return n >= 2 ? n + ' コンボ！' : '';
  }

  function drawQuestion() {
    stopTimers();
    clear(root);
    if (S.idx >= S.items.length) return drawResult();
    const item = S.items[S.idx];
    S.answered = false;
    const n = S.items.length;
    const combo = h('span', { class: 'dochi-combo', 'data-dochi-combo': '1', 'aria-live': 'polite', text: comboText(S.combo) });
    root.appendChild(h('div', { class: 'play-head' },
      h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': '終了する', onClick: onExit }, icon('close')),
      h('div', { class: 'play-title' }, h('strong', { text: 'どっち？' }), h('span', { class: 'small muted', text: (S.idx + 1) + ' / ' + n })),
      combo,
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': String(S.idx) }, h('div', { class: 'progress-fill', style: { width: (S.idx / n) * 100 + '%' } }))));
    const secs = dochiSeconds(item.pair.text);
    const fill = h('div', { class: 'timer-fill' });
    const left = h('span', { class: 'timer-left', text: 'あと ' + secs + ' 秒' });
    const card = h('div', { class: 'card q-card' },
      h('div', { class: 'timer', 'aria-hidden': 'true' }, fill),
      left,
      h('p', { class: 'dochi-line', 'data-dochi-line': '1', text: item.pair.text }),
      h('p', { class: 'small muted', text: 'これは、どちらの説明？' }));
    const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '選択肢' });
    const btns = item.choices.map((c, i) => {
      const b = h('button', { class: 'choice dochi-choice', type: 'button', 'data-dochi-choice': String(i), onClick: () => answer(i) },
        h('span', { class: 'mark', 'aria-hidden': 'true', text: CHOICE_LABELS[i] }), h('span', { class: 'ctext', text: c }));
      choices.appendChild(b);
      return b;
    });
    card.appendChild(choices);
    root.appendChild(card);
    const after = h('div', { class: 'after' });
    root.appendChild(after);
    S.ui = { btns, after, combo, left };
    S.t0 = Date.now();
    S.timer = setInterval(() => {
      const rest = Math.max(0, secs - (Date.now() - S.t0) / 1000);
      fill.style.width = (rest / secs) * 100 + '%';
      left.textContent = 'あと ' + Math.ceil(rest) + ' 秒';
      if (rest <= 0) answer(null);
    }, 100);
    window.scrollTo(0, 0);
  }

  function answer(chosen) {
    if (!S || S.answered) return;
    S.answered = true;
    stopTimers();
    const item = S.items[S.idx];
    const correct = isCorrect(item, chosen);
    S.combo = nextCombo(S.combo, correct);
    if (S.combo > S.bestCombo) S.bestCombo = S.combo;
    S.results.push({ item, correct, chosen });
    const { btns, after, combo } = S.ui;
    combo.textContent = comboText(S.combo);
    btns.forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle('ok', i === item.answer);
      b.classList.toggle('ng', i === chosen && !correct);
      const mark = b.querySelector('.mark');
      if (i === item.answer) mark.textContent = '✓';
      else if (i === chosen) mark.textContent = '✗';
    });
    S.ui.left.textContent = '';
    const goNext = () => {
      S.idx++;
      drawQuestion();
    };
    if (correct) {
      after.appendChild(h('div', { class: 'verdict ok', role: 'status' }, h('strong', { text: '正解！' }), S.combo >= 2 ? h('span', { class: 'small', text: S.combo + ' コンボ' }) : null));
      burst(btns[item.answer]);
      vibrate(app.state.settings, 30);
      beep(app.state.settings, 'ok');
      S.next = setTimeout(goNext, OK_PAUSE_MS);
      return;
    }
    after.appendChild(h('div', { class: 'verdict ng', role: 'status' }, h('strong', { text: chosen === null ? '時間切れ' : '残念…' }), h('span', { class: 'small', text: '正解は「' + item.pair.title + '」' })));
    vibrate(app.state.settings, [60, 40, 60]);
    beep(app.state.settings, 'ng');
    after.appendChild(pointCard(item.pair));
    const next = h('button', { class: 'btn primary big next', type: 'button', 'data-dochi-next': '1', onClick: () => { stopTimers(); goNext(); } }, S.idx === S.items.length - 1 ? '結果を見る' : '次へ');
    after.appendChild(next);
    next.focus({ preventScroll: true });
    after.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    S.next = setTimeout(goNext, DOCHI_POINT_MS);
  }

  // 2つの違い。題名の2つと、違いの1行
  function pointCard(p) {
    return h('div', { class: 'card dochi-point', 'data-dochi-point': '1' },
      h('p', { class: 'small muted', text: '2つの違い' }),
      h('p', { class: 'dochi-pair' }, h('strong', { text: p.title }), ' と ', h('strong', { text: p.oppTitle })),
      p.point ? h('p', { text: p.point }) : null);
  }

  // ---- 結果 ----
  function drawResult() {
    clear(root);
    cleanup();
    setBgmRush(false); // 結果の画面は、ふつうの問題中の曲に戻る
    const total = S.results.length;
    const ok = S.results.filter((r) => r.correct).length;
    const rec = recordDochi(app.state, ok, S.bestCombo);
    app.commit();
    const wrong = S.results.filter((r) => !r.correct);
    const pct = Math.round((ok / Math.max(1, total)) * 100);
    const rank = dochiRank(ok, total);
    const newRec = rec.newBest || rec.newBestCombo;
    // 数え上げの間は、見えている数字を読み上げの対象から外し、最終の点数とランクの文を別に持つ（dochi-sr）
    const count = h('span', { class: 'dochi-count', text: '0' });
    const pctEl = h('span', { class: 'dochi-pct', text: '0%' });
    const stamp = h('div', { class: 'dochi-stamp rank-' + rank + ' pending', 'data-dochi-rank': rank, 'aria-hidden': 'true' }, h('span', { class: 'dochi-stamp-letter', text: rank }));
    const mascotSlot = h('div', { class: 'dochi-mascot-slot' });
    const recSlot = h('div', { class: 'dochi-rec-slot' + (newRec ? ' has-rec' : '') });
    const card = h('div', { class: 'card result dochi-result-card', 'data-dochi-result': '1' },
      h('p', { class: 'small muted dochi-kind', text: 'どっち？早押し' }),
      h('h1', { class: 'dochi-announce', text: '結果発表！' }),
      h('p', { class: 'score dochi-score' },
        h('span', { class: 'dochi-sr', text: ok + ' / ' + total + ' 正解（' + pct + '%）。ランク ' + rank }),
        h('span', { 'aria-hidden': 'true' }, h('strong', {}, count, ' / ' + total), ' 正解（', pctEl, '）')),
      stamp,
      mascotSlot,
      h('p', {}, '最高コンボ ', h('strong', { text: String(S.bestCombo) })),
      recSlot);
    // 止まったあと: はんこ・一言・記録更新（紙吹雪とジングル）・お祝いの画面。animate=false（動きを減らす設定）なら動かさず、すぐ最終の表示
    const settle = (animate) => {
      count.textContent = String(ok);
      pctEl.textContent = pct + '%';
      stamp.classList.remove('pending');
      if (animate) stamp.classList.add('landed');
      const later = (fn, ms) => revealTimers.push(setTimeout(fn, ms));
      const showSay = () => {
        const say = dochiMascot(rank);
        const m = mascotLine(say.art, say.text, 'dochi-mascot', { tap: false });
        if (m) mascotSlot.appendChild(m);
        if (newRec) {
          const p = h('p', { class: 'dochi-newrec', role: 'status', text: [rec.newBest ? '正解数の記録を更新！' : '', rec.newBestCombo ? 'コンボの記録を更新！' : ''].filter(Boolean).join(' ') });
          recSlot.appendChild(p);
          beep(app.state.settings, 'badge'); // いまのお祝いの画面（バッジ）と同じジングル。設定がオフなら鳴らない
          vibrate(app.state.settings, [80, 40, 80, 40, 160]);
          if (animate) {
            burst(p);
            later(() => burst(stamp), 250);
            later(() => burst(p), 500);
          }
        }
      };
      if (!animate) {
        showSay();
        app.flushCelebrations();
        return;
      }
      later(showSay, REVEAL_AFTER_STAMP_MS);
      later(() => app.flushCelebrations(), REVEAL_AFTER_STAMP_MS + REVEAL_FLUSH_MS);
    };
    const startReveal = () => {
      if (reducedMotion()) return settle(false);
      const later = (fn, ms) => revealTimers.push(setTimeout(fn, ms));
      if (ok <= 0) return later(() => settle(true), REVEAL_COUNT_DELAY_MS);
      later(() => {
        const t0 = Date.now();
        const tick = () => {
          const p = Math.min(1, (Date.now() - t0) / REVEAL_COUNT_MS);
          const eased = 1 - Math.pow(1 - p, 2); // だんだん遅くなって止まる
          const shown = Math.round(ok * eased);
          count.textContent = String(shown);
          pctEl.textContent = Math.round((shown / Math.max(1, total)) * 100) + '%'; // 数え上げ中の数と食い違わないよう、見えている数から出す
          if (p < 1) later(tick, 40);
          else settle(true);
        };
        tick();
      }, REVEAL_COUNT_DELAY_MS);
    };
    root.appendChild(card);
    if (wrong.length) {
      const l = h('div', { class: 'card' }, h('h2', { text: 'まちがえた組（' + wrong.length + '）' }), h('p', { class: 'small muted', text: '押すと用語カードが開きます。' }));
      wrong.forEach((r) => {
        const p = r.item.pair;
        l.appendChild(h('button', { class: 'later-item dochi-miss', type: 'button', 'data-dochi-miss': p.id, onClick: () => openCardSheet(app, p.id) },
          h('span', { class: 'dochi-pair' }, h('strong', { text: p.title }), ' と ', h('strong', { text: p.oppTitle })),
          p.point ? h('span', { class: 'small muted', text: p.point }) : null));
      });
      root.appendChild(l);
    } else {
      root.appendChild(h('div', { class: 'card empty' }, h('p', { text: '全問正解！ すばらしい見分けです。' })));
    }
    root.appendChild(h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary big', type: 'button', 'data-dochi-again': '1', onClick: start }, 'もう一度'),
      h('button', { class: 'btn big', type: 'button', onClick: () => app.go('#/home') }, '戻る')));
    window.scrollTo(0, 0);
    startReveal();
  }

  drawIntro();
  return { el: root, cleanup: () => { cleanup(); setBgmRush(false); } };
}
