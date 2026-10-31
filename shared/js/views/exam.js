// 模擬試験。本番の問題数・制限時間に合わせる（問題が足りない間は有る分で縮小版）。
// 本番と同じく、途中では解説を出さない。終わってから大項目別の正答率と見直しを出す。
import { h, clear, burst, toast, mascotLine, confirmDialog, confirmQuit } from '../ui.js';
import { examMascot, CHARACTER_TEXT } from '../lib/characters.js';
import { normalizePassGuide, passGuideLabel, passGuideStatus } from '../lib/forecast.js';
import { shuffleChoices, orderExamUnseenFirst, examPlan, byMajor, byQtype, QTYPE_LABEL, readBlueprint, pickExamByBlueprint, secondsPerQuestion, examFlagStep } from '../lib/quiz.js';
import { recordAnswer, recordExam, recordExamSeen } from '../lib/progress.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, stumbleBlock, stemPlainBlock, stemFigureBlock, pastExamLine, choiceLabelsOf } from './explain.js';

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

export function renderExam(app) {
  const root = h('section', { class: 'view exam' });
  let timer = null;
  const cleanup = () => {
    if (timer) clearInterval(timer);
    timer = null;
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
    const hist = app.state.exams.slice(-5).reverse();
    if (hist.length) {
      const l = h('div', { class: 'card' }, h('h2', { text: 'これまでの結果' }));
      hist.forEach((e) => l.appendChild(h('p', { class: 'row-line' }, e.date + '　', h('strong', { text: Math.round((e.correct / e.total) * 100) + '%' }), '（' + e.correct + '/' + e.total + (e.reduced ? '・縮小版' : '') + '）')));
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
        return { sq, q: sq.q, chosen, correct, major: sq.q.syllabus[0], qtype: sq.q.qtype };
      });
      const ok = results.filter((r) => r.correct).length;
      const majors = byMajor(results);
      recordExamSeen(app.state, S.items.map((sq) => sq.q.id));
      recordExam(app.state, { total: results.length, correct: ok, reduced: plan.reduced, minutes: Math.round((Date.now() - S.t0) / 60000), byMajor: majors.map((m) => ({ major: m.major, total: m.total, correct: m.correct })) });
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
      const card = h('div', { class: 'card result' },
        h('h1', { text: '模擬試験 結果' }),
        auto ? h('p', { class: 'note', text: '時間切れで自動採点しました。' }) : null,
        h('p', { class: 'score' }, h('strong', { class: 'big-num', text: rate + '%' }), '　' + ok + ' / ' + results.length + ' 正解'),
        plan.reduced ? h('p', { class: 'small muted', text: '縮小版（' + plan.count + '問）の結果です。' }) : null,
        guide ? h('p', { class: 'small exam-guide', 'data-pass-guide': '1', text: passGuideStatus(guide, rate) + '（' + passGuideLabel(guide) + '）' }) : null,
        mascotLine(em.art, em.text, 'exam-mascot'));
      root.appendChild(card);
      const mc = h('div', { class: 'card' }, h('h2', { text: blueprint ? '領域別の正答率' : '大項目別の正答率' }));
      majors.sort((a, b) => a.rate - b.rate).forEach((m) => {
        const pct = Math.round(m.rate * 100);
        mc.appendChild(h('div', { class: 'bar-row' },
          h('div', { class: 'bar-label' }, h('span', { text: m.major }), h('strong', { text: pct + '%（' + m.correct + '/' + m.total + '）' })),
          h('div', { class: 'bar', role: 'img', 'aria-label': m.major + ' 正答率' + pct + '%' }, h('div', { class: 'bar-fill ' + (pct >= 80 ? 'strong' : pct >= 40 ? 'mid' : 'weak'), style: { width: pct + '%' } }))));
      });
      mc.appendChild(h('p', { class: 'small muted', text: blueprint ? '一番低い領域から見直すのがおすすめです。' : '一番低い大項目から見直すのがおすすめです。' }));
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
      const open = (id) => openCardSheet(app, id);
      const rv = h('div', { class: 'card' }, h('h2', { text: wrong.length ? 'まちがえた問題（' + wrong.length + '）' : '全問正解！' }));
      wrong.forEach((r) => {
        const body = h('div', {}, r.chosen === null ? h('p', { class: 'small muted', text: '（未回答）' }) : null, stemFigureBlock(app, r.q), stemPlainBlock(r.q), stumbleBlock(app, r.q, open), explanation(app, r.sq, r.chosen, open, { sensei: false }));
        rv.appendChild(h('details', { class: 'miss' }, h('summary', { text: r.q.stem }), body));
      });
      if (wrong.length) rv.appendChild(h('p', { class: 'small muted', text: 'まちがえた問題は「復習」に入りました。' }));
      root.appendChild(rv);
      root.appendChild(h('div', { class: 'btn-row' }, h('button', { class: 'btn primary big', type: 'button', onClick: intro }, 'もう一度'), h('button', { class: 'btn big', type: 'button', onClick: () => app.go('#/home') }, 'ホームへ')));
      if (rate >= 70) burst(card);
      app.flushCelebrations();
      window.scrollTo(0, 0);
    }
    draw();
  }

  intro();
  return { el: root, cleanup };
}
