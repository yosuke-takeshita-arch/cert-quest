// 章のボス戦の計算。純粋な関数だけ（DOM も localStorage も触らない）。画面はあとで別に作る。
// 仕様: 要件定義書 3-7。state.boss = { 章のキー: 撃破の回数 }。

export const BOSS_MIN = 3; // 最後に間違えた問題がこの数以上たまると、ボスが現れる
export const BOSS_MAX = 10; // ボス戦に出す問題の上限
export const PLAYER_HP = 3; // 自分の体力

/**
 * 問題が属する「章」のキー。地図のステージ（シラバスの中項目）と同じ。
 * data.js の buildTree と同じ決め方: syllabus の先頭2つを '|' でつなぐ（中項目が無ければ '全般'）。= stage.key
 * q._path（buildTree が付ける）があればそれを優先する。決められない問題は null。
 */
export function chapterKey(q) {
  if (!q || typeof q !== 'object') return null;
  const src = Array.isArray(q._path) && q._path.length ? q._path : q.syllabus;
  if (!Array.isArray(src) || !src.length || !src.every((s) => typeof s === 'string' && s)) return null;
  const p = src.slice(0, 2);
  if (p.length === 1) p.push('全般');
  return p.join('|');
}

/** 最後に答えたとき間違えた問題か。まだ答えていない（seen が 0）問題は含めない。 */
export function isMissed(rec) {
  return !!rec && rec.seen > 0 && rec.lastOk === false;
}

/**
 * 最後に間違えた問題を、古く間違えた順に並べる。
 * qstats には「いつ間違えたか」の日付が無い。ただし間違えた回答は必ず step=0・due=（間違えた日+1）にするので（srs.js applyAnswer）、
 * lastOk=false の問題では due が小さい＝古く間違えた、と読める。due が無い（壊れた）ものは最後。同じ due は問題データの並び順。
 */
function sortOldestFirst(list, qstats) {
  const dueOf = (q) => {
    const d = qstats[q.id] && qstats[q.id].due;
    return typeof d === 'number' && Number.isFinite(d) ? d : Infinity;
  };
  return list
    .map((q, i) => ({ q, i, d: dueOf(q) }))
    .sort((a, b) => (a.d === b.d ? a.i - b.i : a.d < b.d ? -1 : 1))
    .map((x) => x.q);
}

/** 章のキー → 最後に間違えた問題（古く間違えた順）。questions はデータにある問題だけ渡す（記録に残る消えた問題は数えない）。 */
export function missedByChapter(questions, qstats) {
  const out = {};
  const st = qstats && typeof qstats === 'object' ? qstats : {};
  for (const q of Array.isArray(questions) ? questions : []) {
    const k = chapterKey(q);
    if (k === null || !isMissed(st[q.id])) continue;
    (out[k] || (out[k] = [])).push(q);
  }
  for (const k of Object.keys(out)) out[k] = sortOldestFirst(out[k], st);
  return out;
}

/** その章のボスが現れているか。chapterQuestions は章の問題（同じ章のものだけ）。 */
export function bossInfo(chapterQuestions, qstats) {
  const st = qstats && typeof qstats === 'object' ? qstats : {};
  let missed = 0;
  for (const q of Array.isArray(chapterQuestions) ? chapterQuestions : []) if (q && isMissed(st[q.id])) missed++;
  return { missed, available: missed >= BOSS_MIN, need: Math.max(0, BOSS_MIN - missed) };
}

/** ボスに出す問題。現れていなければ空。最大 max 問、古く間違えた順。 */
export function bossQuestions(chapterQuestions, qstats, max = BOSS_MAX) {
  const st = qstats && typeof qstats === 'object' ? qstats : {};
  const missed = (Array.isArray(chapterQuestions) ? chapterQuestions : []).filter((q) => q && isMissed(st[q.id]));
  if (missed.length < BOSS_MIN) return [];
  return sortOldestFirst(missed, st).slice(0, Math.max(0, max));
}

// ---- 体力 ----

/** 戦いの始まり。bossHp＝出す問題の数。 */
export function newBattle(bossHp, playerHp = PLAYER_HP) {
  const b = Number.isInteger(bossHp) && bossHp > 0 ? bossHp : 0;
  return { boss: b, bossMax: b, player: playerHp, playerMax: playerHp, result: null };
}

/** 1問の結果を反映した新しい状態を返す（元は変えない）。result: null＝続く／'win'／'lose'。終わった後の答えは無視する。 */
export function applyBossAnswer(battle, correct) {
  if (battle.result) return { ...battle };
  const next = { ...battle };
  if (correct) next.boss = Math.max(0, next.boss - 1);
  else next.player = Math.max(0, next.player - 1);
  next.result = next.boss === 0 ? 'win' : next.player === 0 ? 'lose' : null;
  return next;
}

/**
 * 出す問題を全部答え終えたのに決着していない（間違えた分だけボスの体力が残った）か。
 * 画面は、その場合に間違えた問題をもう一度出す（体力は減らし続ける）か、負けにするかを決める必要がある。
 */
export function needsRetry(battle, remainingQuestions) {
  return !battle.result && remainingQuestions <= 0;
}

// ---- 撃破の記録 ----

/** 読んだ保存データの boss を正しい形にする。古い記録（項目なし）は空。回数が正の整数でないものは捨てる。 */
export function normalizeBoss(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, n] of Object.entries(raw)) if (k && Number.isInteger(n) && n > 0) out[k] = n;
  return out;
}

/** 読んだ保存データの bossFlawless（ハートを1つも減らさずに倒した回数）を正しい形にする。古い記録（項目なし）・正の整数でないものは0。 */
export function normalizeBossFlawless(raw) {
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
}

/** ハートを1つも減らさずに勝ったか（要件定義書 §3-8）。 */
export function isFlawlessWin(battle) {
  return !!battle && battle.result === 'win' && battle.player === battle.playerMax;
}

/**
 * 撃破を1回記録する。戻り値は記録後の回数。
 * flawless が true（ハートを減らさずに勝った）なら、state.bossFlawless も1増やす。
 */
export function recordBossWin(state, key, flawless = false) {
  state.boss = normalizeBoss(state.boss);
  state.boss[key] = (state.boss[key] || 0) + 1;
  state.bossFlawless = normalizeBossFlawless(state.bossFlawless) + (flawless ? 1 : 0);
  return state.boss[key];
}

export function bossWins(state, key) {
  const n = state && state.boss ? state.boss[key] : 0;
  return Number.isInteger(n) && n > 0 ? n : 0;
}
