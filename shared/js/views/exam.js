// 模擬試験。本番の問題数・制限時間に合わせる（問題が足りない間は有る分で縮小版）。
// 本番と同じく、途中では解説を出さない。終わってから大項目別の正答率と見直しを出す。
import { h, clear, burst, toast, mascotLine, confirmDialog, confirmQuit } from '../ui.js';
import { examMascot, CHARACTER_TEXT } from '../lib/characters.js';
import { normalizePassGuide, passGuideLabel, passGuideStatus } from '../lib/forecast.js';
import { shuffleChoices, orderExamUnseenFirst, examPlan, byMajor, byQtype, QTYPE_LABEL, readBlueprint, pickExamByBlueprint, secondsPerQuestion, examFlagStep, examMissRecord, examMissItem, byMiddle } from '../lib/quiz.js';
import { playSfx, playDrumRoll } from '../audio.js';
import { recordAnswer, recordExam, recordExamSeen } from '../lib/progress.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, stumbleBlock, stemPlainBlock, stemFigureBlock, pastExamLine, choiceLabelsOf } from './explain.js';

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

// 結果発表の演出の長さ（要件定義書の模擬試験「結果発表の演出」）
const EXAM_REVEAL_DELAY_MS = 600; // 「結果発表！」が出てから、ドラムロールと数え上げを始めるまで
const EXAM_REVEAL_COUNT_MS = 2500; // ドラムロールと数え上げの長さ
const EXAM_REVEAL_FLUSH_MS = 1500; // ジャジャーンから、お祝いの画面（バッジなど）を出すまで
const HISTORY_SHOWN = 5; // 「これまでの結果」で最初に出す回数（それより前は「もっと見る」）

export function renderExam(app) {
  const root = h('section', { class: 'view exam' });
  let timer = null;
  let revealTimers = []; // 結果発表の演出のタイマー（画面を離れる・もう一度のとき止める）
  let stopDrum = null; // 鳴っているドラムロールを止める関数
  const cleanup = () => {
    if (timer) clearInterval(timer);
    timer = null;
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
    if (stopDrum) stopDrum();
    stopDrum = null;
  };
  const cfg = app.config.exam || { questions: 100, minutes: 60 };
  // 設計図（config.exam.blueprint）がある資格は、補足でない領域ごと・型ごとに本番の配分で選ぶ。無い資格は全体から、模試でまだ出ていない問題・出たのが古い問題を先に選ぶ（2026-10-18）。
  const blueprint = readBlueprint(cfg);
  const roots = blueprint ? app.data.tree.roots.filter((r) => !r.supplement).map((r) => r.name) : [];
  const pickAll = () => {
    if (!blueprint) return { items: orderExamUnseenFirst(app.data.questions, app.rng, app.state.examSeen), filled: 0 };
    return pickExamByBlueprint(app.data.questions, blueprint, roots, app.rng, app.state.examSeen);
  };
  const preview = pickAll();
  const plan = examPlan(cfg, blueprint ? preview.items.length : app.data.questions.length);
  let running = null; // 解いている試験（start の S）。採点したら done
  // スマホの「戻る」を押されたら、解いている途中なら確かめる（app.guardBack。2026-10-15 先生の決定 A）
  app.guardBack(() => !running || running.done || confirmQuit('ここまでの答えは採点されず、記録にも残りません。'));

  // 始める前の画面の「戻る」。この画面は下のメニューを隠すので、これが無いとブラウザの戻るしか出口が無かった（2026-10-15 先生の指摘）
  const backBtn = () => h('button', { class: 'btn big exam-back', type: 'button', onClick: () => app.go('#/home') }, '戻る');

  // まちがえた問題の一覧（結果の画面と、これまでの結果から開く画面で同じ形）。items は { q, sq, chosen }
  function missCard(items) {
    const open = (id) => openCardSheet(app, id);
    const rv = h('div', { class: 'card' }, h('h2', { text: items.length ? 'まちがえた問題（' + items.length + '）' : '全問正解！' }));
    items.forEach((r) => {
      const body = h('div', {}, r.chosen === null ? h('p', { class: 'small muted', text: '（未回答）' }) : null, stemFigureBlock(app, r.q), stemPlainBlock(r.q), stumbleBlock(app, r.q, open), explanation(app, r.sq, r.chosen, open, { sensei: false }));
      rv.appendChild(h('details', { class: 'miss' }, h('summary', { text: r.q.stem }), body));
    });
    return rv;
  }

  // これまでの結果の1回ぶんの、まちがえた問題（要件定義書の模擬試験「まちがえた問題をあとから見る」）
  function pastMiss(e) {
    cleanup();
    clear(root);
    const byId = new Map(app.data.questions.map((q) => [q.id, q]));
    const items = e.miss.map((m) => examMissItem(byId.get(m.id), m)).filter(Boolean).map((it) => ({ q: it.sq.q, sq: it.sq, chosen: it.chosen }));
    root.appendChild(h('h1', { text: '模擬試験の見直し' }));
    root.appendChild(h('p', { class: 'muted' }, e.date + '　', h('strong', { text: Math.round((e.correct / e.total) * 100) + '%' }), '（' + e.correct + '/' + e.total + (e.reduced ? '・縮小版' : '') + '）'));
    const skipped = e.miss.length - items.length;
    const card = items.length ? missCard(items) : h('div', { class: 'card' }, h('h2', { text: 'まちがえた問題（0）' }));
    if (skipped > 0) card.appendChild(h('p', { class: 'small muted', text: '問題の入れ替えで、いまは無い問題が ' + skipped + '問あります（表示していません）。' }));
    root.appendChild(card);
    root.appendChild(h('button', { class: 'btn big exam-back', type: 'button', 'data-exam-past-back': '1', onClick: intro }, '模擬試験の入口に戻る'));
    window.scrollTo(0, 0);
  }

  function intro() {
    cleanup();
    clear(root);
    root.appendChild(h('h1', { text: '模擬試験' }));
    if (!plan.count) {
      root.appendChild(h('div', { class: 'empty' }, h('p', { text: '問題を準備中です。' }), h('p', { class: 'small muted', text: '問題がそろうと、ここから模擬試験を受けられます。' })));
      root.appendChild(backBtn());
      return;
    }
    const card = h('div', { class: 'card' },
      h('p', {}, h('strong', { class: 'big-num', text: plan.count + '問' }), '　', h('strong', { class: 'big-num', text: plan.minutes + '分' })),
      h('p', { class: 'small muted', text: '本番は ' + plan.fullCount + '問・' + plan.fullMinutes + '分です。' }));
    if (blueprint && plan.count && roots.length) card.appendChild(h('p', { class: 'small muted', text: '本番と同じ配分で出します：' + roots.length + '領域から各' + blueprint.perRoot + '問、問題の型の割合も本番に合わせます。' }));
    if (blueprint && preview.filled) card.appendChild(h('p', { class: 'small muted exam-fill-note', text: '構造型の問題がまだ少ないため、一部を用語・関係など別の型の問題で補っています（' + preview.filled + '問）。' }));
    if (plan.reduced) card.appendChild(h('p', { class: 'note', text: '問題数が本番に足りないため、いまある ' + plan.count + '問の縮小版です（時間も ' + plan.minutes + '分に縮めています）。' }));
    card.appendChild(h('ul', { class: 'plain' }, h('li', { text: '途中では正解も解説も出ません。終わってからまとめて見られます。' }), h('li', { text: '時間になると自動で終了します。' }), h('li', { text: '答えていない問題は不正解になります。' })));
    card.appendChild(h('button', { class: 'btn primary big', type: 'button', onClick: start }, '試験を始める'));
    root.appendChild(card);
    root.appendChild(backBtn());
    const hist = app.state.exams.slice().reverse();
    if (hist.length) {
      const l = h('div', { class: 'card exam-history' }, h('h2', { text: 'これまでの結果' }));
      const row = (e) => {
        const n = Array.isArray(e.miss) ? e.miss.length : 0;
        return h('div', { class: 'exam-hist-row' },
          h('p', { class: 'row-line' }, e.date + '　', h('strong', { text: Math.round((e.correct / e.total) * 100) + '%' }), '（' + e.correct + '/' + e.total + (e.reduced ? '・縮小版' : '') + '）'),
          n ? h('button', { class: 'btn exam-past-miss', type: 'button', 'data-exam-past-miss': '1', onClick: () => pastMiss(e) }, 'まちがえた問題を見る（' + n + '問）') : null);
      };
      hist.slice(0, HISTORY_SHOWN).forEach((e) => l.appendChild(row(e)));
      if (hist.length > HISTORY_SHOWN) {
        const more = h('button', { class: 'btn exam-hist-more', type: 'button', 'data-exam-hist-more': '1', onClick: () => {
          more.remove();
          hist.slice(HISTORY_SHOWN).forEach((e) => l.appendChild(row(e)));
        } }, 'もっと見る（あと' + (hist.length - HISTORY_SHOWN) + '回）');
        l.appendChild(more);
      }
      root.appendChild(l);
    }
  }

  function start() {
    const items = pickAll().items.slice(0, plan.count).map((q) => shuffleChoices(q, app.rng));
    const S = { items, answers: items.map(() => null), cur: 0, deadline: Date.now() + plan.minutes * 60000, t0: Date.now(), grid: false, done: false, flags: items.map(() => false), flagMode: false }; // flags … 見直しの印（その回だけ。保存しない）。flagMode … 印の問題だけを回っている
    running = S;

    const GRADE_MASCOT = { art: 'sensei-think', text: CHARACTER_TEXT.confirmGrade }; // 採点の小窓はあい先生（要件定義書 §6「確かめの小窓」）
    async function finish(auto) {
      if (S.done) return;
      const un = S.answers.filter((a) => a === null).length;
      const fl = S.flags.filter(Boolean).length;
      const flagNote = fl ? '見直しの印が ' + fl + '問 残っています。' : '';
      if (!auto && !(await confirmDialog(un
        ? { title: '採点しますか？', message: 'まだ答えていない問題が ' + un + '問あります。' + flagNote + '答えていない問題は不正解になります。', ok: '採点する', cancel: '問題に戻る', mascot: GRADE_MASCOT }
        : { title: '採点しますか？', message: flagNote + '採点すると、答えは変えられません。', ok: '採点する', cancel: '問題に戻る', mascot: GRADE_MASCOT }))) return;
      if (S.done) return; // 小窓を出している間に時間切れで採点された
      S.done = true;
      cleanup();
      const results = S.items.map((sq, i) => {
        const chosen = S.answers[i];
        const correct = chosen !== null && chosen === sq.answer;
        recordAnswer(app.state, sq.q, { correct, seconds: null, sessionStreak: 0, exam: true, now: new Date(), limit: secondsPerQuestion(app.config) });
        return { sq, q: sq.q, chosen, correct, major: sq.q.syllabus[0], middle: sq.q.syllabus[1], qtype: sq.q.qtype };
      });
      const ok = results.filter((r) => r.correct).length;
      const majors = byMajor(results);
      recordExamSeen(app.state, S.items.map((sq) => sq.q.id));
      recordExam(app.state, { total: results.length, correct: ok, reduced: plan.reduced, minutes: Math.round((Date.now() - S.t0) / 60000), byMajor: majors.map((m) => ({ major: m.major, total: m.total, correct: m.correct })), miss: examMissRecord(results) });
      app.commit();
      result(results, ok, majors, auto);
    }

    function draw() {
      clear(root);
      const sq = S.items[S.cur];
      const q = sq.q;
      const answered = S.answers.filter((a) => a !== null).length;
      const clock = h('strong', { class: 'clock', text: mmss(S.deadline - Date.now()) });
      root.appendChild(h('div', { class: 'play-head' },
        h('div', { class: 'play-title' }, h('strong', { text: '模擬試験 ' + (S.cur + 1) + ' / ' + S.items.length }), h('span', { class: 'small muted', text: '回答 ' + answered + ' / ' + S.items.length })),
        h('div', { class: 'clock-box', role: 'timer', 'aria-label': '残り時間' }, '残り ', clock)));
      timer = timer || setInterval(() => {
        const left = S.deadline - Date.now();
        const c = root.querySelector('.clock');
        if (c) c.textContent = mmss(left);
        if (left <= 0) finish(true);
      }, 500);
      if (S.flagMode && !S.flags.some(Boolean)) S.flagMode = false; // 回っている最中に印を全部外した
      const flagged = S.flags.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
      if (S.flagMode) {
        const pos = flagged.indexOf(S.cur);
        root.appendChild(h('div', { class: 'note exam-flag-mode', 'data-exam-flag-mode': '1' },
          h('span', { text: '見直しの印の問題を回っています（' + flagged.length + '問' + (pos >= 0 ? '中' + (pos + 1) + '問目' : '') + '）' }),
          h('button', { class: 'btn ghost', type: 'button', 'data-exam-flag-exit': '1', onClick: () => { S.flagMode = false; draw(); } }, '全部の問題に戻る')));
      }
      const on = S.flags[S.cur];
      root.appendChild(h('div', { class: 'exam-flag-row' },
        h('button', { class: 'btn exam-flag' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', 'data-exam-flag': '1', onClick: () => { S.flags[S.cur] = !S.flags[S.cur]; draw(); } }, on ? '見直す ✓' : '見直す')));
      const card = h('div', { class: 'card q-card' },
        h('div', { class: 'q-tags' }, statusChip(q.status), q.negative ? h('span', { class: 'chip warn', text: '適切でないものを選ぶ' }) : null),
        h('p', { class: 'stem', text: q.stem }),
        stemFigureBlock(app, q),
        pastExamLine(q));
      const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '選択肢' });
      sq.choices.forEach((c, i) => {
        const sel = S.answers[S.cur] === i;
        choices.appendChild(h('button', { class: 'choice' + (sel ? ' picked' : ''), type: 'button', 'aria-pressed': sel ? 'true' : 'false', onClick: () => { S.answers[S.cur] = i; draw(); } },
          h('span', { class: 'mark', 'aria-hidden': 'true', text: sel ? '●' : choiceLabelsOf(q)[i] }), h('span', { class: 'ctext', text: c })));
      });
      card.appendChild(choices);
      root.appendChild(card);
      if (S.grid) {
        const g = h('div', { class: 'qgrid', role: 'group', 'aria-label': '問題一覧' });
        S.items.forEach((_, i) => g.appendChild(h('button', { class: 'qnum' + (S.answers[i] !== null ? ' done' : '') + (S.flags[i] ? ' flag' : '') + (i === S.cur ? ' cur' : ''), type: 'button', 'aria-label': (i + 1) + '問目' + (S.answers[i] !== null ? '（回答済み）' : '（未回答）') + (S.flags[i] ? '（見直しの印）' : ''), onClick: () => { S.cur = i; S.grid = false; draw(); } }, String(i + 1))));
        // 印の問題を回るボタンは番号の上に置く（本番は100問を超え、番号の下だと探しにくい）
        root.appendChild(h('div', { class: 'card' },
          flagged.length ? h('button', { class: 'btn primary', type: 'button', 'data-exam-flag-start': '1', onClick: () => { S.flagMode = true; S.grid = false; S.cur = flagged[0]; draw(); } }, '印の問題だけ順に見る（' + flagged.length + '問）') : null,
          h('p', { class: 'small muted qgrid-legend', text: '色の付いた番号＝答えた問題、右上の三角＝見直しの印' }),
          g));
      }
      const last = S.cur === S.items.length - 1;
      const go = (i) => { S.cur = i; draw(); };
      let prevBtn;
      let nextBtn;
      if (S.flagMode) {
        const p = examFlagStep(S.flags, S.cur, -1);
        const n = examFlagStep(S.flags, S.cur, 1);
        prevBtn = h('button', { class: 'btn', type: 'button', disabled: p < 0, 'data-exam-flag-prev': '1', onClick: () => go(p) }, '前の印');
        nextBtn = n >= 0
          ? h('button', { class: 'btn primary', type: 'button', 'data-exam-flag-next': '1', onClick: () => go(n) }, '次の印')
          : h('button', { class: 'btn primary', type: 'button', 'data-exam-flag-exit': '1', onClick: () => { S.flagMode = false; draw(); } }, '全部の問題に戻る');
      } else {
        prevBtn = h('button', { class: 'btn', type: 'button', disabled: S.cur === 0, onClick: () => go(S.cur - 1) }, '前へ');
        nextBtn = last
          ? h('button', { class: 'btn primary', type: 'button', onClick: () => finish(false) }, '採点する')
          : h('button', { class: 'btn primary', type: 'button', onClick: () => go(S.cur + 1) }, '次へ');
      }
      root.appendChild(h('div', { class: 'sticky-bar two' },
        prevBtn,
        h('button', { class: 'btn', type: 'button', onClick: () => { S.grid = !S.grid; draw(); } }, S.grid ? '一覧を閉じる' : '問題一覧'),
        nextBtn));
      if (!last) root.appendChild(h('p', { class: 'center' }, h('button', { class: 'btn ghost', type: 'button', onClick: () => finish(false) }, '途中で採点する')));
      window.scrollTo(0, 0);
    }

    function result(results, ok, majors, auto) {
      clear(root);
      const rate = Math.round((ok / Math.max(1, results.length)) * 100);
      const em = examMascot(rate);
      const guide = normalizePassGuide(app.config.passGuide);
      // 結果発表の演出（要件定義書の模擬試験「結果発表の演出」）。数え上げの間は、見えている数字を読み上げから外し、最終の点数を別に持つ
      const pctEl = h('strong', { class: 'big-num exam-count', text: '0%' });
      const okEl = h('span', { text: '0' });
      const scoreEl = h('p', { class: 'score exam-score' },
        h('span', { class: 'dochi-sr', text: rate + '%、' + ok + ' / ' + results.length + ' 正解' }),
        h('span', { 'aria-hidden': 'true' }, pctEl, '　', okEl, ' / ' + results.length + ' 正解'));
      const afterSlot = h('div', { class: 'exam-after' });
      const card = h('div', { class: 'card result exam-result-card', 'data-exam-result': '1' },
        h('p', { class: 'small muted dochi-kind', text: '模擬試験' }),
        h('h1', { class: 'dochi-announce', text: '結果発表！' }),
        auto ? h('p', { class: 'note', text: '時間切れで自動採点しました。' }) : null,
        scoreEl,
        plan.reduced ? h('p', { class: 'small muted', text: '縮小版（' + plan.count + '問）の結果です。' }) : null,
        afterSlot);
      root.appendChild(card);
      const later = (fn, ms) => revealTimers.push(setTimeout(fn, ms));
      // 止まったあと: ジャジャーン・点数の弾み・紙吹雪（70%以上）・一言と合格の目安・お祝いの画面
      const settle = (animate) => {
        if (stopDrum) stopDrum();
        stopDrum = null;
        pctEl.textContent = rate + '%';
        okEl.textContent = String(ok);
        playSfx(app.state.settings, 'bosswin');
        if (animate) scoreEl.classList.add('exam-score-pop');
        if (guide) afterSlot.appendChild(h('p', { class: 'small exam-guide', 'data-pass-guide': '1', text: passGuideStatus(guide, rate) + '（' + passGuideLabel(guide) + '）' }));
        const m = mascotLine(em.art, em.text, 'exam-mascot');
        if (m) afterSlot.appendChild(m);
        if (rate >= 70 && animate) {
          burst(scoreEl);
          later(() => burst(scoreEl), 300);
        }
        if (!animate) return app.flushCelebrations();
        later(() => app.flushCelebrations(), EXAM_REVEAL_FLUSH_MS);
      };
      const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const startReveal = () => {
        if (reduced) return settle(false);
        if (ok <= 0) return later(() => settle(true), EXAM_REVEAL_DELAY_MS);
        later(() => {
          stopDrum = playDrumRoll(app.state.settings, EXAM_REVEAL_COUNT_MS);
          const t0 = Date.now();
          const tick = () => {
            const p = Math.min(1, (Date.now() - t0) / EXAM_REVEAL_COUNT_MS);
            const shown = Math.round(ok * (1 - Math.pow(1 - p, 2))); // だんだん遅くなって止まる
            okEl.textContent = String(shown);
            pctEl.textContent = Math.round((shown / Math.max(1, results.length)) * 100) + '%';
            if (p < 1) later(tick, 40);
            else settle(true);
          };
          tick();
        }, EXAM_REVEAL_DELAY_MS);
      };
      const mc = h('div', { class: 'card' }, h('h2', { text: blueprint ? '領域別の正答率' : '大項目別の正答率' }));
      const bar = (name, pct, c, t) => h('div', { class: 'bar-row' },
        h('div', { class: 'bar-label' }, h('span', { text: name }), h('strong', { text: pct + '%（' + c + '/' + t + '）' })),
        h('div', { class: 'bar', role: 'img', 'aria-label': name + ' 正答率' + pct + '%' }, h('div', { class: 'bar-fill ' + (pct >= 80 ? 'strong' : pct >= 40 ? 'mid' : 'weak'), style: { width: pct + '%' } })));
      // 大項目を押すと、その中の中分類別の正答率が開く（要件定義書の模擬試験「中分類別の正答率」）
      const middles = byMiddle(results);
      majors.sort((a, b) => a.rate - b.rate).forEach((m) => {
        const mids = middles.get(m.major) || [];
        const box = h('div', { class: 'exam-middles' });
        mids.forEach((x) => box.appendChild(bar(x.middle, Math.round(x.rate * 100), x.correct, x.total)));
        mc.appendChild(h('details', { class: 'exam-major', 'data-exam-major': m.major },
          h('summary', {}, bar(m.major, Math.round(m.rate * 100), m.correct, m.total), h('span', { class: 'small exam-major-hint', text: '中分類別を見る（' + mids.length + '）' })),
          box));
      });
      mc.appendChild(h('p', { class: 'small muted', text: (blueprint ? '一番低い領域から見直すのがおすすめです。' : '一番低い大項目から見直すのがおすすめです。') + '押すと、中分類別の正答率が開きます。' }));
      root.appendChild(mc);
      const types = blueprint ? byQtype(results).filter((t) => t.qtype) : [];
      if (types.length) {
        const tc = h('div', { class: 'card exam-qtypes' }, h('h2', { text: '問題の型別の正答率' }));
        types.forEach((t) => {
          const pct = Math.round(t.rate * 100);
          const name = QTYPE_LABEL[t.qtype];
          tc.appendChild(h('div', { class: 'bar-row' },
            h('div', { class: 'bar-label' }, h('span', { text: name }), h('strong', { text: pct + '%（' + t.correct + '/' + t.total + '）' })),
            h('div', { class: 'bar', role: 'img', 'aria-label': name + ' 正答率' + pct + '%' }, h('div', { class: 'bar-fill ' + (pct >= 80 ? 'strong' : pct >= 40 ? 'mid' : 'weak'), style: { width: pct + '%' } }))));
        });
        tc.appendChild(h('p', { class: 'small muted', text: '低い型の問題は、ステージや復習で重点的に解くのがおすすめです。' }));
        root.appendChild(tc);
      }
      const wrong = results.filter((r) => !r.correct);
      const rv = missCard(wrong);
      if (wrong.length) rv.appendChild(h('p', { class: 'small muted', text: 'まちがえた問題は「復習」に入りました。模擬試験の入口の「これまでの結果」からも、あとで見直せます。' }));
      root.appendChild(rv);
      root.appendChild(h('div', { class: 'btn-row' }, h('button', { class: 'btn primary big', type: 'button', onClick: intro }, 'もう一度'), h('button', { class: 'btn big', type: 'button', onClick: () => app.go('#/home') }, 'ホームへ')));
      window.scrollTo(0, 0);
      startReveal();
    }
    draw();
  }

  intro();
  return { el: root, cleanup };
}
