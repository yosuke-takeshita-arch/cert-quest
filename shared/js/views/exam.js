// 模擬試験。本番の問題数・制限時間に合わせる（問題が足りない間は有る分で縮小版）。
// 本番と同じく、途中では解説を出さない。終わってから大項目別の正答率と見直しを出す。
import { h, clear, burst, toast, mascotLine } from '../ui.js';
import { examMascot } from '../lib/characters.js';
import { shuffle, shuffleChoices, examPlan, byMajor, byQtype, QTYPE_LABEL, readBlueprint, pickExamByBlueprint, secondsPerQuestion } from '../lib/quiz.js';
import { recordAnswer, recordExam } from '../lib/progress.js';
import { statusChip, openCardSheet } from './cards.js';
import { explanation, stumbleBlock, stemPlainBlock, CHOICE_LABELS } from './explain.js';

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
  // 設計図（config.exam.blueprint）がある資格は、補足でない領域ごと・型ごとに本番の配分で選ぶ。無い資格は従来どおり全体からランダム。
  const blueprint = readBlueprint(cfg);
  const roots = blueprint ? app.data.tree.roots.filter((r) => !r.supplement).map((r) => r.name) : [];
  const pickAll = () => {
    if (!blueprint) return { items: shuffle(app.data.questions, app.rng), filled: 0 };
    return pickExamByBlueprint(app.data.questions, blueprint, roots, app.rng);
  };
  const preview = pickAll();
  const plan = examPlan(cfg, blueprint ? preview.items.length : app.data.questions.length);

  function intro() {
    cleanup();
    clear(root);
    root.appendChild(h('h1', { text: '模擬試験' }));
    if (!plan.count) {
      root.appendChild(h('div', { class: 'empty' }, h('p', { text: '問題を準備中です。' }), h('p', { class: 'small muted', text: '問題がそろうと、ここから模擬試験を受けられます。' })));
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
    const hist = app.state.exams.slice(-5).reverse();
    if (hist.length) {
      const l = h('div', { class: 'card' }, h('h2', { text: 'これまでの結果' }));
      hist.forEach((e) => l.appendChild(h('p', { class: 'row-line' }, e.date + '　', h('strong', { text: Math.round((e.correct / e.total) * 100) + '%' }), '（' + e.correct + '/' + e.total + (e.reduced ? '・縮小版' : '') + '）')));
      root.appendChild(l);
    }
  }

  function start() {
    const items = pickAll().items.slice(0, plan.count).map((q) => shuffleChoices(q, app.rng));
    const S = { items, answers: items.map(() => null), cur: 0, deadline: Date.now() + plan.minutes * 60000, t0: Date.now(), grid: false, done: false };

    function finish(auto) {
      if (S.done) return;
      const un = S.answers.filter((a) => a === null).length;
      if (!auto && un && !confirm('まだ答えていない問題が ' + un + '問あります。採点しますか？')) return;
      if (!auto && !un && !confirm('採点します。よろしいですか？')) return;
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
      const card = h('div', { class: 'card q-card' },
        h('div', { class: 'q-tags' }, statusChip(q.status), q.format === 'not' ? h('span', { class: 'chip warn', text: '適切でないものを選ぶ' }) : null),
        h('p', { class: 'stem', text: q.stem }));
      const choices = h('div', { class: 'choices', role: 'group', 'aria-label': '選択肢' });
      sq.choices.forEach((c, i) => {
        const sel = S.answers[S.cur] === i;
        choices.appendChild(h('button', { class: 'choice' + (sel ? ' picked' : ''), type: 'button', 'aria-pressed': sel ? 'true' : 'false', onClick: () => { S.answers[S.cur] = i; draw(); } },
          h('span', { class: 'mark', 'aria-hidden': 'true', text: sel ? '●' : CHOICE_LABELS[i] }), h('span', { class: 'ctext', text: c })));
      });
      card.appendChild(choices);
      root.appendChild(card);
      if (S.grid) {
        const g = h('div', { class: 'qgrid', role: 'group', 'aria-label': '問題一覧' });
        S.items.forEach((_, i) => g.appendChild(h('button', { class: 'qnum' + (S.answers[i] !== null ? ' done' : '') + (i === S.cur ? ' cur' : ''), type: 'button', 'aria-label': (i + 1) + '問目' + (S.answers[i] !== null ? '（回答済み）' : '（未回答）'), onClick: () => { S.cur = i; S.grid = false; draw(); } }, String(i + 1))));
        root.appendChild(h('div', { class: 'card' }, g));
      }
      const last = S.cur === S.items.length - 1;
      root.appendChild(h('div', { class: 'sticky-bar two' },
        h('button', { class: 'btn', type: 'button', disabled: S.cur === 0, onClick: () => { S.cur--; draw(); } }, '前へ'),
        h('button', { class: 'btn', type: 'button', onClick: () => { S.grid = !S.grid; draw(); } }, S.grid ? '一覧を閉じる' : '問題一覧'),
        last
          ? h('button', { class: 'btn primary', type: 'button', onClick: () => finish(false) }, '採点する')
          : h('button', { class: 'btn primary', type: 'button', onClick: () => { S.cur++; draw(); } }, '次へ')));
      if (!last) root.appendChild(h('p', { class: 'center' }, h('button', { class: 'btn ghost', type: 'button', onClick: () => finish(false) }, '途中で採点する')));
      window.scrollTo(0, 0);
    }

    function result(results, ok, majors, auto) {
      clear(root);
      const rate = Math.round((ok / Math.max(1, results.length)) * 100);
      const em = examMascot(rate);
      const card = h('div', { class: 'card result' },
        h('h1', { text: '模擬試験 結果' }),
        auto ? h('p', { class: 'note', text: '時間切れで自動採点しました。' }) : null,
        h('p', { class: 'score' }, h('strong', { class: 'big-num', text: rate + '%' }), '　' + ok + ' / ' + results.length + ' 正解'),
        plan.reduced ? h('p', { class: 'small muted', text: '縮小版（' + plan.count + '問）の結果です。' }) : null,
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
        const body = h('div', {}, r.chosen === null ? h('p', { class: 'small muted', text: '（未回答）' }) : null, stemPlainBlock(r.q), stumbleBlock(app, r.q, open), explanation(app, r.sq, r.chosen, open, { sensei: false }));
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
