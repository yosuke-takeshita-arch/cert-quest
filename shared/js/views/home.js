// ホーム・シラバスの地図・ステージ・復習。
import { h, icon, stars, externalLink, badgeBases, badgeImg, mascotLine } from '../ui.js';
import { levelFromXp, currentStreak, MASTERY_LABEL } from '../lib/scoring.js';
import { examStatus, formatExamDate } from '../lib/examdate.js';
import { dateKey, dayNumber, upcoming } from '../lib/srs.js';
import { nodeProgress, dueQuestions, suggestStage } from '../lib/progress.js';
import { pickQuestions, challengeName } from '../lib/quiz.js';
import { dailyProgress } from '../lib/daily.js';
import { nextGoals } from '../lib/goals.js';
import { homeMascot } from '../lib/characters.js';
import { analyze, homeWeak, homeWeakText } from '../lib/weakness.js';
import { badgeDefs, badgeImageUrl } from '../lib/badges.js';
import { startSession } from './play.js';
import { cardBody } from './cards.js';

export function masteryChip(level) {
  return h('span', { class: 'chip m-' + level, text: MASTERY_LABEL[level] });
}

function stageSpec(app, stage, small) {
  const pool = small ? small.questions : stage.questions;
  return {
    mode: 'stage',
    title: small ? small.name : stage.name,
    stageKey: stage.key,
    small: !!small,
    backHash: '#/stage/' + encodeURIComponent(stage.key),
    pick: (a) => pickQuestions(pool, a.state.qstats, a.config.stage && a.config.stage.size ? a.config.stage.size : 10, a.rng),
  };
}

/** 苦手の分析の「ここを解く」。分析の単位（小項目、または章）の問題で、未回答→前回まちがえた→前回正解の順に出す。 */
export function weakSpec(app, unit, backHash) {
  const size = app.config.stage && app.config.stage.size ? app.config.stage.size : 10;
  return {
    mode: 'stage',
    title: unit.name,
    stageKey: unit.stage.key,
    small: unit.partial, // 章の一部だけのときは、章の星を付けない
    backHash: backHash || '#/home',
    pick: (a) => pickQuestions(unit.questions, a.state.qstats, size, a.rng),
  };
}

function reviewSpec(app) {
  return {
    mode: 'review',
    title: '今日の復習',
    backHash: '#/review',
    pick: (a) => dueQuestions(a.state, a.data.questionById, new Date()).slice(0, 20),
  };
}

function challengeSpec(app) {
  return {
    mode: 'challenge',
    title: challengeName(app.config),
    backHash: '#/home',
    pick: (a) => pickQuestions(a.data.questions, a.state.qstats, (a.config.challenge && a.config.challenge.questions) || 10, a.rng),
  };
}

/** 次の目標を始める。始められない目標のときは、ホームに戻るだけ。 */
export function startGoal(app, goal) {
  const a = (goal && goal.action) || {};
  if (a.kind === 'stage') {
    const st = app.data.tree.byKey.get(a.key);
    if (st && st.questions.length) return startSession(app, stageSpec(app, st));
  } else if (a.kind === 'challenge') {
    return startSession(app, challengeSpec(app));
  } else if (a.kind === 'exam') {
    return app.go('#/exam');
  } else if (a.kind === 'study') {
    const st = suggestStage(app.data.tree.stages, app.state.qstats);
    if (st) return startSession(app, stageSpec(app, st));
  }
  return app.go('#/home');
}

function dailyCard(state, todayKey) {
  const dp = dailyProgress(state, todayKey);
  return h('div', { class: 'card daily' + (dp.done ? ' done' : '') },
    h('div', { class: 'row-line daily-head' }, h('strong', { text: '今日の目標' }), h('span', { class: 'small muted', text: dp.answered + ' / ' + dp.goal + ' 問' })),
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': '今日の目標', 'aria-valuemin': '0', 'aria-valuemax': String(dp.goal), 'aria-valuenow': String(Math.min(dp.answered, dp.goal)) }, h('div', { class: 'progress-fill', style: { width: Math.round(dp.ratio * 100) + '%' } })),
    h('p', { class: 'small muted daily-note', text: dp.done ? '今日の目標を達成しました！' : 'あと ' + dp.remaining + ' 問' }));
}

// 「次の目標」がバッジのとき、その絵を小さく出す。絵が無い・読み込めないときは何も出さない。
function goalArt(g) {
  const url = badgeImageUrl(g.art, badgeBases());
  return url ? badgeImg(url, 'goal-badge-img', null) : null;
}

export function renderHome(app) {
  const { config, state, data } = app;
  const now = new Date();
  const root = h('section', { class: 'view home' });
  // ブラウザがインストールできると知らせてきたときだけ出す（app.js の beforeinstallprompt）
  if (app.installPrompt) {
    const btn = h('button', { class: 'btn primary', type: 'button', text: 'アプリとしてインストール' });
    btn.addEventListener('click', async () => {
      const p = app.installPrompt;
      if (!p) return;
      btn.disabled = true;
      try {
        await p.prompt();
        await p.userChoice;
      } catch (e) { /* 断られた・失敗したときはボタンを戻す */ }
      app.installPrompt = null;
      app.go('#/home');
    });
    root.appendChild(h('div', { class: 'card' }, h('p', { text: 'ホーム画面から開けるアプリとして入れられます。' }), btn));
  }
  const exam = examStatus(state.settings, now);
  const left = exam.days;
  const lv = levelFromXp(state.xp);
  const streak = currentStreak(state.streak, dateKey(now));
  const due = dueQuestions(state, data.questionById, now).length;
  const mascot = homeMascot(state, dateKey(now));

  root.appendChild(h('header', { class: 'hero' },
    h('p', { class: 'hero-name', text: config.name }),
    left === null ? null
      : left > 0 ? h('p', { class: 'countdown' }, '受験まで あと ', h('strong', { class: 'days', text: String(left) }), ' 日')
      : left === 0 ? h('p', { class: 'countdown' }, h('strong', { text: '今日が受験日です。' }))
      : h('p', { class: 'countdown' }, '受験日（' + formatExamDate(exam.date) + '）は過ぎました'),
    exam.date ? h('p', { class: 'small', text: '受験日 ' + formatExamDate(exam.date) }) : null,
    mascotLine(mascot.art, mascot.text, 'home-mascot')));
  if (exam.kind === 'past') {
    root.appendChild(h('div', { class: 'card exam-past', 'data-exam-past': '1' },
      h('p', {}, h('strong', { text: '受験日を過ぎました。' }), '次の受験日を設定しますか？'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => app.go('#/settings') }, '受験日を設定する')));
  }

  const prog = h('div', { class: 'card status' },
    h('div', { class: 'lv-row' },
      h('div', {}, h('span', { class: 'small muted', text: 'レベル' }), h('strong', { class: 'lv', text: 'Lv ' + lv.level })),
      h('div', { class: 'streak', title: '連続日数' }, icon('flame', streak ? 'on' : 'off'), h('strong', { text: streak + ' 日連続' }))),
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': '次のレベルまで', 'aria-valuemin': '0', 'aria-valuemax': String(lv.need), 'aria-valuenow': String(lv.into) }, h('div', { class: 'progress-fill', style: { width: Math.round(lv.progress * 100) + '%' } })),
    h('p', { class: 'small muted', text: 'XP ' + state.xp + '（次のレベルまで あと ' + (lv.need - lv.into) + '）' }));
  root.appendChild(prog);

  if (!data.questions.length) {
    root.appendChild(h('div', { class: 'card empty' },
      h('h2', { text: '問題を準備中です' }),
      h('p', { text: 'いま用意している最中です。できあがると、ここから学習を始められます。' }),
      data.concepts.length ? h('button', { class: 'btn primary', type: 'button', onClick: () => app.go('#/cards') }, '用語カードを見る') : null));
  } else {
    root.appendChild(dailyCard(state, dateKey(now)));
    const next = suggestStage(data.tree.stages, state.qstats);
    if (due > 0) {
      root.appendChild(h('button', { class: 'btn primary big cta', type: 'button', onClick: () => startSession(app, reviewSpec(app)) }, '今日の復習 ', h('span', { class: 'badge-count', text: due + '問' })));
    } else {
      root.appendChild(h('div', { class: 'card done-today' }, h('p', {}, '今日の復習は ', h('strong', { text: '0件' }), ' です。')));
    }
    if (next) {
      const p = nodeProgress(next, state.qstats);
      root.appendChild(h('button', { class: 'btn ' + (due > 0 ? '' : 'primary') + ' big cta', type: 'button', onClick: () => app.go('#/stage/' + encodeURIComponent(next.key)) },
        h('span', { class: 'cta-sub small', text: p.answered ? 'つづきから' : '次のステージ' }), h('span', { text: next.name })));
    }
    root.appendChild(h('div', { class: 'grid2' },
      h('button', { class: 'btn big tile', type: 'button', onClick: () => startSession(app, challengeSpec(app)) }, h('strong', { text: challengeName(app.config) }), h('span', { class: 'small muted', text: '本番のペースで' })),
      h('button', { class: 'btn big tile', type: 'button', onClick: () => app.go('#/exam') }, h('strong', { text: '模擬試験' }), h('span', { class: 'small muted', text: (app.config.exam ? app.config.exam.questions + '問・' + app.config.exam.minutes + '分' : '') }))));

    const goals = nextGoals(data.tree, badgeDefs(data.tree, config), state, dateKey(now), 3);
    if (goals.length) {
      const gbox = h('div', { class: 'card next-goals' }, h('h2', { text: '次の目標' }));
      goals.forEach((g) => gbox.appendChild(h('button', { class: 'goal-row', type: 'button', onClick: () => startGoal(app, g) },
        h('span', { class: 'goal-head' },
          goalArt(g),
          h('span', { class: 'goal-text' }, h('strong', { text: g.title }), h('span', { class: 'small muted', text: g.remainText + '（' + g.label + '）' }))),
        h('div', { class: 'progress', role: 'progressbar', 'aria-label': g.title + ' までの進み具合', 'aria-valuemin': '0', 'aria-valuemax': String(g.max), 'aria-valuenow': String(g.cur) }, h('div', { class: 'progress-fill', style: { width: Math.round(g.ratio * 100) + '%' } })))));
      root.appendChild(gbox);
    }

    // 苦手がはっきりしている（正答率が低い）ときだけ、一行で入口を出す。ふだんは出さない
    const hw = homeWeak(analyze(data.tree, state.qstats));
    if (hw) {
      root.appendChild(h('div', { class: 'card weak-line', 'data-home-weak': hw.unit.key },
        h('button', { class: 'weak-line-btn', type: 'button', onClick: () => startSession(app, weakSpec(app, hw.unit, '#/home')) }, homeWeakText(hw)),
        h('button', { class: 'link-btn', type: 'button', onClick: () => app.go('#/weak') }, '苦手の分析を見る')));
    }

    const untouched = data.tree.stages.filter((s) => s.questions.length && nodeProgress(s, state.qstats).level === 'none');
    const unready = data.tree.stages.filter((s) => !s.questions.length).length;
    const box = h('div', { class: 'card' }, h('h2', { text: '未着手の範囲' }));
    if (untouched.length) {
      const ul = h('ul', { class: 'plain link-list' });
      untouched.slice(0, 5).forEach((s) => ul.appendChild(h('li', {}, h('button', { class: 'link-btn', type: 'button', onClick: () => app.go('#/stage/' + encodeURIComponent(s.key)) }, s.path[0] + ' › ' + s.name))));
      box.appendChild(ul);
      if (untouched.length > 5) box.appendChild(h('p', { class: 'small muted', text: 'ほか ' + (untouched.length - 5) + ' ステージ（「地図」で全部見られます）' }));
    } else {
      box.appendChild(h('p', { text: '問題のあるステージは、すべて手をつけました。' }));
    }
    if (unready) box.appendChild(h('p', { class: 'small muted', text: '問題を準備中のステージ: ' + unready + ' 件' }));
    root.appendChild(box);
  }

  const foot = h('p', { class: 'small muted foot' });
  if (config.officialUrl) foot.appendChild(externalLink(config.officialUrl, '公式の例題・試験情報（外部サイト）'));
  root.appendChild(foot);
  if (!app.storage.persistent) root.appendChild(h('p', { class: 'note', text: 'この端末では学習記録を保存できません。アプリを閉じると記録が消えます。' }));
  return root;
}

// ---- 地図（シラバスの木） ----
export function renderMap(app) {
  const { data, state } = app;
  const root = h('section', { class: 'view map' }, h('h1', { text: 'シラバスの地図' }));
  if (!data.tree.roots.length) {
    root.appendChild(h('div', { class: 'empty' }, h('p', { text: 'シラバスを準備中です。' })));
    return root;
  }
  root.appendChild(h('p', { class: 'small muted', text: '色は「最後に解いたとき正解だった問題の割合」。ステージを選ぶと出題されます。' }));
  for (const major of data.tree.roots) {
    const mp = nodeProgress(major, state.qstats);
    const det = h('details', { class: 'major', open: major === data.tree.roots[0] ? true : null },
      h('summary', {}, h('span', { class: 'sum-name', text: major.name }), masteryChip(mp.level), h('span', { class: 'small muted', text: mp.answered + '/' + mp.total + '問' })));
    for (const st of major.children) det.appendChild(stageRow(app, st));
    root.appendChild(det);
  }
  return root;
}

function stageRow(app, st) {
  const p = nodeProgress(st, app.state.qstats);
  const rec = app.state.stages[st.key];
  return h('button', { class: 'stage-row m-border-' + p.level, type: 'button', onClick: () => app.go('#/stage/' + encodeURIComponent(st.key)) },
    h('span', { class: 'row-main' }, h('strong', { text: st.name }), h('span', { class: 'small muted', text: p.total ? p.answered + '/' + p.total + '問' + (st.concepts.length ? '・カード' + st.concepts.length : '') : '問題は準備中' + (st.concepts.length ? '・カード' + st.concepts.length : '') })),
    stars(rec ? rec.stars : 0), masteryChip(p.level));
}

// ---- ステージ ----
export function renderStage(app, key) {
  const st = app.data.tree.byKey.get(key);
  const root = h('section', { class: 'view stage' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/map') }, '← 地図へ'));
  if (!st || st.depth !== 1) {
    root.appendChild(h('div', { class: 'empty' }, h('p', { text: 'このステージは見つかりません。' })));
    return root;
  }
  const p = nodeProgress(st, app.state.qstats);
  const rec = app.state.stages[st.key];
  root.appendChild(h('p', { class: 'crumb small muted', text: st.path[0] }));
  root.appendChild(h('h1', { text: st.name }));
  root.appendChild(h('div', { class: 'row-line' }, stars(rec ? rec.stars : 0), masteryChip(p.level), h('span', { class: 'small muted', text: p.total + '問・カード' + st.concepts.length + '枚' })));
  if (p.total) {
    const size = Math.min(p.total, (app.config.stage && app.config.stage.size) || 10);
    root.appendChild(h('button', { class: 'btn primary big', type: 'button', onClick: () => startSession(app, stageSpec(app, st)) }, 'このステージに挑戦（' + size + '問）'));
    root.appendChild(h('p', { class: 'small muted', text: '未回答の問題→前回まちがえた問題の順に出ます。6割正解で星1、8割で星2、9割以上で星3。' }));
  } else {
    root.appendChild(h('div', { class: 'empty' }, h('p', { text: 'このステージの問題は準備中です。' })));
  }
  if (st.children.length) {
    const box = h('div', { class: 'card' }, h('h2', { text: '小項目' }));
    for (const sm of st.children) {
      const sp = nodeProgress(sm, app.state.qstats);
      box.appendChild(h('div', { class: 'small-row' },
        h('span', { class: 'row-main' }, h('strong', { text: sm.name }), h('span', { class: 'small muted', text: sp.total ? sp.answered + '/' + sp.total + '問' : '問題は準備中' })),
        masteryChip(sp.level),
        sp.total ? h('button', { class: 'btn small-btn', type: 'button', 'aria-label': sm.name + ' だけ出題', onClick: () => startSession(app, stageSpec(app, st, sm)) }, 'この項目だけ') : null));
    }
    root.appendChild(box);
  }
  if (st.concepts.length) {
    const box = h('div', { class: 'card' }, h('h2', { text: '用語カード' }));
    const row = h('div', { class: 'chips' });
    st.concepts.forEach((c) => row.appendChild(h('button', { class: 'chip link', type: 'button', onClick: () => app.go('#/card/' + encodeURIComponent(c.id)) }, c.title)));
    box.appendChild(row);
    root.appendChild(box);
  }
  return root;
}

// ---- 復習 ----
export function renderReview(app) {
  const root = h('section', { class: 'view review' }, h('h1', { text: '復習' }));
  const today = dayNumber(new Date());
  const due = dueQuestions(app.state, app.data.questionById, new Date());
  const up = upcoming(app.state.qstats, today);
  root.appendChild(h('p', { class: 'small muted', text: 'まちがえた問題は、翌日・3日後・7日後・14日後に出ます。正解で次の間隔へ、まちがえると最初に戻ります。' }));
  if (due.length) {
    root.appendChild(h('div', { class: 'card' }, h('p', {}, h('strong', { class: 'big-num', text: due.length + '問' }), ' が復習の日です'), h('button', { class: 'btn primary big', type: 'button', onClick: () => startSession(app, reviewSpec(app)) }, '復習を始める' + (due.length > 20 ? '（まず20問）' : ''))));
  } else {
    root.appendChild(h('div', { class: 'card empty' }, h('p', { text: '今日の復習はありません。' }), h('p', { class: 'small muted', text: up.tomorrow || up.later ? 'つぎの復習が来たら、ここに出ます。' : 'ステージで問題を解くと、まちがえた問題がここに入ります。' })));
  }
  root.appendChild(h('div', { class: 'card' }, h('h2', { text: '復習の予定' }),
    h('p', { class: 'row-line' }, '今日以前: ', h('strong', { text: up.now + '問' })),
    h('p', { class: 'row-line' }, '明日: ', h('strong', { text: up.tomorrow + '問' })),
    h('p', { class: 'row-line' }, 'あさって以降: ', h('strong', { text: up.later + '問' }))));
  return root;
}
