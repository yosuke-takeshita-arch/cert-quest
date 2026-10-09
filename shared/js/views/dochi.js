// 「どっち？」早押し（要件定義書 §3-5）。一行目（題名は〇〇に伏せる）を読んで、2つの題名のどちらかを5秒で選ぶ。
// 出題・伏せ方・記録の直し方は lib/dochi.js。ここは画面だけ。問題の記録（qstats）・XP には入れない。
import { h, clear, icon, burst, vibrate, beep } from '../ui.js';
import { buildPairs, pickRound, isCorrect, nextCombo, recordDochi, normalizeDochi, DOCHI_ROUNDS, DOCHI_SECONDS, DOCHI_POINT_MS } from '../lib/dochi.js';
import { CHOICE_LABELS } from './explain.js';
import { openCardSheet } from './cards.js';

const OK_PAUSE_MS = 600; // 正解のとき、次へ進むまでの間

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

  const stopTimers = () => {
    if (!S) return;
    if (S.timer) clearInterval(S.timer);
    if (S.next) clearTimeout(S.next);
    S.timer = null;
    S.next = null;
  };
  const cleanup = () => {
    stopTimers();
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  };

  // ---- はじめの画面 ----
  function drawIntro() {
    cleanup();
    S = null;
    clear(root);
    root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/home') }, '← ホーム'));
    root.appendChild(h('h1', { text: 'どっち？早押し' }));
    const d = normalizeDochi(app.state.dochi);
    const card = h('div', { class: 'card' },
      h('p', { text: '用語の説明を読んで、どの用語の説明か、2つのうちから' + DOCHI_SECONDS + '秒で選びます。似ていて間違えやすい組を、遊びながら見分けましょう。' }),
      h('ul', { class: 'plain' },
        h('li', { text: DOCHI_ROUNDS + '問・1問' + DOCHI_SECONDS + '秒（時間切れは不正解）' }),
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
    drawQuestion();
  }

  function onKey(e) {
    if (document.querySelector('.sheet-back')) return;
    if (!S || S.answered || !S.items[S.idx]) return;
    if (e.key === '1' || e.key === '2') answer(Number(e.key) - 1);
  }

  function onExit() {
    if (S && S.results.length < S.items.length && S.results.length && !confirm('途中で終了します。この回の記録は残りません。')) return;
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
    const fill = h('div', { class: 'timer-fill' });
    const left = h('span', { class: 'timer-left', text: 'あと ' + DOCHI_SECONDS + ' 秒' });
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
    S.ui = { btns, after, combo };
    S.t0 = Date.now();
    S.timer = setInterval(() => {
      const rest = Math.max(0, DOCHI_SECONDS - (Date.now() - S.t0) / 1000);
      fill.style.width = (rest / DOCHI_SECONDS) * 100 + '%';
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
    const total = S.results.length;
    const ok = S.results.filter((r) => r.correct).length;
    const rec = recordDochi(app.state, ok, S.bestCombo);
    app.commit();
    const wrong = S.results.filter((r) => !r.correct);
    const card = h('div', { class: 'card result', 'data-dochi-result': '1' },
      h('h1', { text: 'どっち？ 結果' }),
      h('p', { class: 'score' }, h('strong', { text: ok + ' / ' + total }), ' 正解（' + Math.round((ok / Math.max(1, total)) * 100) + '%）'),
      h('p', {}, '最高コンボ ', h('strong', { text: String(S.bestCombo) })));
    if (rec.newBest || rec.newBestCombo) {
      card.appendChild(h('p', { class: 'dochi-newrec', role: 'status', text: [rec.newBest ? '正解数の記録を更新！' : '', rec.newBestCombo ? 'コンボの記録を更新！' : ''].filter(Boolean).join(' ') }));
    }
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
    app.flushCelebrations();
  }

  drawIntro();
  return { el: root, cleanup };
}
