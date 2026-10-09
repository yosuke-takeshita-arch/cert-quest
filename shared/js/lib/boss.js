// 章のボス戦の計算。純粋な関数だけ（DOM も localStorage も触らない）。画面はあとで別に作る。
// 仕様: 要件定義書 3-7。state.boss = { 章のキー: 撃破の回数 }。

export const BOSS_MIN = 3; // 最後に間違えた問題がこの数以上たまると、ボスが現れる
export const BOSS_QUEUE_MAX = 20; // ボス戦に並べる問題の上限（体力は 5〜10 で、間違えても出し直すので、これで足りる）
export const BOSS_HP_MIN = 5; // ボスの体力（倒すのに要る正解の数）の下限。戦いの始まりに BOSS_HP_MIN〜BOSS_HP_MAX から決め、画面には出さない
export const BOSS_HP_MAX = 10;
export const PLAYER_HP = 3; // 自分の体力
export const CRIT_SECONDS = 10; // 問題が出てからこの秒数以内に正解すると、会心の一撃が出ることがある
export const CRIT_CHANCE = 0.25; // 会心の一撃が出る確率（4回に1回）
export const CRIT_DAMAGE = 2; // 会心の一撃でボスの体力が減る数（ふつうは1）

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

/** 答えた記録（qstats の1件）から見た正解率（0〜1）と間違えた回数。答えたことが無い（seen が正の整数でない）ものは null。 */
export function accuracyOf(rec) {
  if (!rec || !Number.isInteger(rec.seen) || rec.seen <= 0) return null;
  const correct = Number.isInteger(rec.correct) ? Math.min(Math.max(rec.correct, 0), rec.seen) : 0;
  return { rate: correct / rec.seen, wrong: rec.seen - correct };
}

/**
 * ボスに出す問題（要件定義書 §3-7 作り直し）。現れていなければ（間違えた問題が BOSS_MIN 未満なら）空。
 * 答えたことのある問題を、正解率の低い順（同じなら間違えた回数の多い順、それも同じなら問題データの順）に並べ、
 * 答えたことのある問題が尽きたら、まだ答えていない問題を問題データの順に後ろへ足す。最大 max 問。
 * chapterQuestions は章の問題（同じ章のものだけ）。
 */
export function bossQuestions(chapterQuestions, qstats, max = BOSS_QUEUE_MAX) {
  const st = qstats && typeof qstats === 'object' ? qstats : {};
  const chapter = (Array.isArray(chapterQuestions) ? chapterQuestions : []).filter((q) => q && typeof q === 'object');
  if (chapter.filter((q) => isMissed(st[q.id])).length < BOSS_MIN) return [];
  const answered = [];
  const fresh = [];
  chapter.forEach((q, i) => {
    const a = accuracyOf(st[q.id]);
    if (a) answered.push({ q, i, a });
    else fresh.push(q);
  });
  answered.sort((x, y) => (x.a.rate !== y.a.rate ? x.a.rate - y.a.rate : x.a.wrong !== y.a.wrong ? y.a.wrong - x.a.wrong : x.i - y.i));
  return [...answered.map((x) => x.q), ...fresh].slice(0, Math.max(0, Number.isInteger(max) ? max : BOSS_QUEUE_MAX));
}

// ---- 体力・会心の一撃・様子の文 ----

/**
 * ボスの体力（倒すのに要る正解の数）を決める。BOSS_HP_MIN〜BOSS_HP_MAX のどれかを同じ確率で。
 * rng は 0 以上 1 未満を返す関数（テストでは差し替える）。cap があれば、それより大きくしない（出す問題の数より多いと、倒せなくなるため）。
 */
export function rollBossHp(rng = Math.random, cap = BOSS_HP_MAX) {
  let r = Number(rng());
  if (!Number.isFinite(r)) r = 0;
  r = Math.min(Math.max(r, 0), 0.999999999);
  const hp = BOSS_HP_MIN + Math.floor(r * (BOSS_HP_MAX - BOSS_HP_MIN + 1));
  return Number.isInteger(cap) && cap >= 0 ? Math.min(hp, cap) : hp;
}

/**
 * 会心の一撃が出るか。正解で、問題が出てから CRIT_SECONDS 秒以内（ちょうどでもよい）のときだけ、CRIT_CHANCE の確率で出る。
 * 条件を満たさないときは rng を使わない（テストで乱数の並びがずれない）。
 */
export function isCritical(correct, seconds, rng = Math.random) {
  if (!correct) return false;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > CRIT_SECONDS) return false;
  return rng() < CRIT_CHANCE;
}

/** ボスの様子の3段階。残りの体力の割合が 0.6 を超える＝'high'（まだ余裕）、0.3 を超える＝'half'（半分くらい）、それ以下＝'low'（かなり弱っている）。決着がついた（体力 0）・体力が不明なら null。 */
export function bossMood(battle) {
  if (!battle || !(battle.bossMax > 0) || !(battle.boss > 0)) return null;
  const r = battle.boss / battle.bossMax;
  return r > 0.6 ? 'high' : r > 0.3 ? 'half' : 'low';
}

export const BOSS_MOOD_TEXT = { high: 'まだ余裕の様子だ', half: 'すこしよろめいた', low: 'かなり弱っている！' };

// ---- 体力 ----

/** 戦いの始まり。bossHp＝ボスの体力（倒すのに要る正解の数）。 */
export function newBattle(bossHp, playerHp = PLAYER_HP) {
  const b = Number.isInteger(bossHp) && bossHp > 0 ? bossHp : 0;
  return { boss: b, bossMax: b, player: playerHp, playerMax: playerHp, result: null };
}

/** 1問の結果を反映した新しい状態を返す（元は変えない）。result: null＝続く／'win'／'lose'。終わった後の答えは無視する。damage は正解のときボスが減る数（会心の一撃は 2）。 */
export function applyBossAnswer(battle, correct, damage = 1) {
  if (battle.result) return { ...battle };
  const next = { ...battle };
  const d = Number.isInteger(damage) && damage >= 1 ? damage : 1;
  if (correct) next.boss = Math.max(0, next.boss - d);
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
