// 出題まわりの純粋な関数。rng（0以上1未満の乱数を返す関数）を差し替えられるのでテストできる。

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 選択肢をシャッフルする。answer と whyWrong は選択肢と一緒に動かし、対応を崩さない。
 * perm[新しい位置] = 元の位置。
 */
export function shuffleChoices(q, rng = Math.random) {
  const perm = shuffle(q.choices.map((_, i) => i), rng);
  return {
    q,
    perm,
    choices: perm.map((o) => q.choices[o]),
    answer: perm.indexOf(q.answer),
    whyWrong: perm.map((o) => (q.whyWrong && q.whyWrong[o] !== undefined ? q.whyWrong[o] : null)),
  };
}

/**
 * 出題する問題を選ぶ。優先順: 未回答 → 前回まちがえた → 前回正解。各グループ内はランダム。
 * n を超えない。選んだ後の並びもシャッフルする。
 */
export function pickQuestions(pool, qstats, n, rng = Math.random) {
  const unseen = [], wrong = [], right = [];
  for (const q of pool) {
    const r = qstats && qstats[q.id];
    if (!r || !r.seen) unseen.push(q);
    else if (r.lastOk === false) wrong.push(q);
    else right.push(q);
  }
  const ordered = [...shuffle(unseen, rng), ...shuffle(wrong, rng), ...shuffle(right, rng)];
  return shuffle(ordered.slice(0, n), rng);
}

/** 模擬試験の問題数と制限時間。足りない間は有る分で縮小し、時間も比例して縮める。 */
export function examPlan(exam, available) {
  const full = exam.questions;
  const count = Math.min(full, available);
  const minutes = count >= full ? exam.minutes : Math.max(1, Math.round((exam.minutes * count) / full));
  return { count, minutes, reduced: count < full, fullCount: full, fullMinutes: exam.minutes };
}

/** 大項目別の集計。results: [{major, correct}] */
export function byMajor(results) {
  const m = new Map();
  for (const r of results) {
    const e = m.get(r.major) || { major: r.major, total: 0, correct: 0 };
    e.total += 1;
    if (r.correct) e.correct += 1;
    m.set(r.major, e);
  }
  return [...m.values()].map((e) => ({ ...e, rate: e.total ? e.correct / e.total : 0 }));
}
