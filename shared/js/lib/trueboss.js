// 真ボスの計算。純粋な関数だけ（DOM も localStorage も触らない）。画面は views/trueboss.js。
// 仕様: 要件定義書 3-9。章のボス戦（lib/boss.js・bossrun.js）の部品を使い回し、真ボスだけの決まりをここに足す。
//   出る条件・出題の組み立て（苦手6:それ以外4・形態ごとの難しさ・重複なし）・形態ごとの体力と回復・技・自分の HP の回復・負けたら第1形態から。
//   state.trueBoss = { wins }（倒した回数）。
import { isMissed, accuracyOf, normalizeBoss, PLAYER_HP } from './boss.js';

// ---- 切り替え ----
/** 真ボスを出すアプリか。config.json の "trueBoss": true のときだけ（G検定だけ。DX ほかは先生が確かめてから）。 */
export function trueBossEnabled(config) {
  return !!config && config.trueBoss === true;
}

// ---- アプリごとの言い回し（config.trueBossWords。無いときは G検定の言い回し） ----
// place … 真ボスのいる場所（『◯◯に、なにかが ひそんでいる』『◯◯で、おおきな なにかが めざめた』『◯◯の 真ボス』の形で使う）／ ending … 真ボスを倒したあとの題／ reached … 結果の画面でマスコットが言う文
export const DEFAULT_TRUE_BOSS_WORDS = Object.freeze({ place: '塔の いちばん うえ', ending: '塔を きわめた！', reached: '塔のてっぺんまで たどりついたよ！' });
export function trueBossWords(config) {
  const w = config && config.trueBossWords && typeof config.trueBossWords === 'object' ? config.trueBossWords : {};
  const pick = (k) => (typeof w[k] === 'string' && w[k].trim() ? w[k].trim() : DEFAULT_TRUE_BOSS_WORDS[k]);
  return { place: pick('place'), ending: pick('ending'), reached: pick('reached') };
}
/**
 * エンディング専用の絵の置き場（config.trueBossEnding。例 "./images/ending.webp"）。要件定義書 §3-9。
 * 『./』で始まり『.webp』で終わる、アプリの中の相対パスだけ受ける（『..』や外のURLは無視）。無い・壊れているときは null（今までどおり星空だけ）。
 */
export function trueBossEndingPath(config) {
  const p = config && typeof config.trueBossEnding === 'string' ? config.trueBossEnding.trim() : '';
  if (!/^\.\/[A-Za-z0-9_\-/]+\.webp$/.test(p) || p.includes('..') || p.includes('//')) return null;
  return p;
}
/** 最後の章のボスを倒して、真ボスが現れたときの文。 */
export function trueBossAwakeText(config) { return trueBossWords(config).place + 'で、おおきな なにかが めざめた……'; }

// ---- 決まり（数字はここ1か所） ----
export const TRUE_FORMS = 3; // 第1〜第3形態
export const TRUE_HP_MIN = 5; // 形態ごとのボスの体力（戦いを始めるとき・進化したときに決める）
export const TRUE_HP_MAX = 10;
export const TRUE_HEAL_GAP_MIN = 7; // 形態の中で、ボスが回復するまでの問数（7〜10問に1回。回復のたびに次の間隔を決め直す。先生決定）
export const TRUE_HEAL_GAP_MAX = 10;
export const TRUE_HEAL_AMOUNT = 1; // 1回で回復する体力（仮。要件定義書 §3-9 は「ときどき回復する（目安：5問に1回）」としか決めていない）
export const TRUE_QUEUE_PER_FORM = 25; // 形態ごとに並べる問題の数（苦手 15 : それ以外 10 ＝ 6:4）。倒すのに要る数より十分多い
export const TRUE_WEAK_RATIO = 0.6; // 苦手な問題の割合
export const TRUE_DIFFICULTY = Object.freeze({ 1: [1, 2], 2: [2, 3], 3: [3, 4] }); // 形態ごとの問題の難しさ（difficulty）の範囲
export const DEFAULT_DIFFICULTY = 2; // difficulty が無い・壊れている問題は、いちばん多い 2 として扱う（仮）
export const STREAK_HEAL = 3; // 続けて正解したらこちらの HP が 1 回復する数（先生決定: 3問。一度 2 にしたのは、門番の推した案を決定と取り違えたため）
export const SKILL_TURNS = 3; // 技が続くターン（問題）の数
// 時間制限の技の長さ（先生決定 2026-10-24）: 1問の制限時間＝5秒＋（問題文と選択肢の文字数の合計÷10）秒を切り上げ。最短 SKILL_MIN_SECONDS、最長はそのアプリの1問あたりの秒数（config.secondsPerQuestion）
export const SKILL_BASE_SECONDS = 5;
export const SKILL_CHARS_PER_SECOND = 10; // 読む速さ（1秒に10字）
export const SKILL_MIN_SECONDS = 10;
export const SKILL_MAX_FALLBACK = 40; // 最長の秒数が分からないときの値（G検定の値）
export const SKILL_CURSE_DAMAGE = 2; // 「間違えると HP が 2 減る」
export const SKILL_CHANCE = Object.freeze({ 1: 0.05, 2: 0.08, 3: 0.3 }); // 問題が出る前に技を使ってくる確率（第3形態ほど多い。先生決定）
// 技の種類: 第1・第2形態は時間制限だけ。『HP が2減る』は第3形態だけで、第3形態の技のうち、この割合（残りは時間制限）。
// 第3形態にたどり着いた戦いのうち『HP が2減る』が1回以上来るのが約4回に1回になるように決めた（先生: 2回に1回はやりすぎ。試算は報告）
export const CURSE_SHARE = 0.2;
export const SKILL_KINDS = Object.freeze(['timed', 'curse']);

// ---- 状態（学習記録の trueBoss） ----
/** 読んだ保存データの trueBoss を正しい形にする。古い記録（項目なし）・壊れた値は wins 0。 */
export function normalizeTrueBoss(raw) {
  const ok = raw && typeof raw === 'object' && !Array.isArray(raw);
  const w = ok ? raw.wins : 0;
  // seen2 … 第2形態を一度でも見たか（見るまでは『形態』があることを画面に出さない。要件定義書 §3-9）。古い記録（項目なし）は『見ていない』
  // lifted … 呪われた地図が晴れる演出を出したか（要件定義書 §3-9『呪われた地図』）。古い記録（項目なし）で、すでに倒している人は『出した』扱い（急に晴れる演出が出ない）
  // awakened … 真ボスが初めて現れる演出（地図）を出したか（要件定義書 §3-9『出現の演出』）。古い記録（項目なし）・壊れた値は『出していない』（false）
  const wins = Number.isInteger(w) && w > 0 ? w : 0;
  return { wins, seen2: !!(ok && raw.seen2 === true), lifted: !!(ok && raw.lifted === true) || (wins > 0 && !(ok && 'lifted' in raw)), awakened: !!(ok && raw.awakened === true) };
}

// ---- 真ボスが初めて現れる演出（要件定義書 §3-9『出現の演出』）----
/** 演出を、これから出すか。真ボスを出すアプリで、全章のボスを倒して真ボスが現れていて、まだ一度も倒していなくて、演出をまだ出していない。 */
export function trueBossAwakenToShow(config, state, stages) {
  return trueBossEnabled(config) && trueBossUnlocked(state, stages) && trueBossWins(state) === 0 && !normalizeTrueBoss(state && state.trueBoss).awakened;
}
/** 演出は出さず、見たことにだけする人か。すでに真ボスを倒したことがあり（今の利用者）、まだ記録が無い。 */
export function trueBossAwakenRecordOnly(config, state) {
  return trueBossEnabled(config) && trueBossWins(state) >= 1 && !normalizeTrueBoss(state && state.trueBoss).awakened;
}
/** 演出を出した（見たことにした）と記録する。出す前に呼ぶ（途中で離れても繰り返さない）。 */
export function markAwakened(state) {
  const t = normalizeTrueBoss(state.trueBoss);
  t.awakened = true;
  state.trueBoss = t;
}
/**
 * 真ボスの入口を、地図・復習の画面に出してよいか。演出を見たあと、または倒したことがある人。
 * 現れる条件（trueBossUnlocked）とは別に見る（演出の前は、条件を満たしていても入口を出さない。いきなり現れる楽しみのため）。
 */
export function trueBossEntranceReady(state) {
  const t = normalizeTrueBoss(state && state.trueBoss);
  return t.awakened || t.wins > 0;
}

// ---- 呪われた地図（要件定義書 §3-9）----
/** 地図を呪われた見た目にするか。真ボスを出すアプリで、真ボスが現れていて（全章のボスを倒した）、一度も倒していない間。 */
export function trueBossCursed(config, state, stages) {
  return trueBossEnabled(config) && trueBossUnlocked(state, stages) && trueBossWins(state) === 0;
}
/** 呪いが晴れる演出を、これから出すか。真ボスを出すアプリで、倒したことがあり、まだ演出を出していない。 */
export function trueBossCurseToLift(config, state) {
  return trueBossEnabled(config) && trueBossWins(state) >= 1 && !normalizeTrueBoss(state && state.trueBoss).lifted;
}
/** 演出を出したと記録する。 */
export function markCurseLifted(state) {
  const t = normalizeTrueBoss(state.trueBoss);
  t.lifted = true;
  state.trueBoss = t;
}

/** 第2形態を見たことがあるか（倒したことがあれば、見たことになる）。 */
export function trueBossSeenForm2(state) {
  const t = normalizeTrueBoss(state && state.trueBoss);
  return t.seen2 || t.wins > 0;
}

/** 第2形態を見たと記録する。初めてなら true。 */
export function markTrueBossSeenForm2(state) {
  const t = normalizeTrueBoss(state.trueBoss);
  const first = !t.seen2;
  t.seen2 = true;
  state.trueBoss = t;
  return first;
}

/** 真ボスを倒した回数。 */
export function trueBossWins(state) {
  return normalizeTrueBoss(state && state.trueBoss).wins;
}

/** 真ボスを倒したと記録する。戻り値は記録後の回数。 */
export function recordTrueBossWin(state) {
  const t = normalizeTrueBoss(state.trueBoss);
  t.wins += 1;
  state.trueBoss = t;
  return t.wins;
}

/**
 * 真ボスが現れているか。そのアプリの章のボスを、すべて1回以上倒したとき。
 * 「すべて」＝問題のある章（バッジ『全章のボス撃破』と同じ数え方）。stages は木の章（key と questions を持つ）。問題のある章が1つも無ければ false。
 */
export function trueBossUnlocked(state, stages) {
  const list = (Array.isArray(stages) ? stages : []).filter((st) => st && typeof st.key === 'string' && Array.isArray(st.questions) && st.questions.length);
  if (!list.length) return false;
  const beaten = normalizeBoss(state && state.boss);
  return list.every((st) => beaten[st.key] >= 1);
}

// ---- 出す問題 ----
/** 問題の難しさ（1〜4）。数でない・範囲外は DEFAULT_DIFFICULTY。 */
export function difficultyOf(q) {
  const d = q && q.difficulty;
  return Number.isInteger(d) && d >= 1 && d <= 4 ? d : DEFAULT_DIFFICULTY;
}

function distanceToBand(d, band) {
  return d < band[0] ? band[0] - d : d > band[1] ? d - band[1] : 0;
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    let r = Number(rng());
    if (!Number.isFinite(r)) r = 0;
    const j = Math.min(i, Math.max(0, Math.floor(r * (i + 1))));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 真ボスに出す問題を組み立てる（要件定義書 §3-9）。全分野の問題 questions から、形態ごとに perForm 問。
 *   ・苦手（最後に答えたとき間違えた問題）が6割、それ以外（答えたことのある苦手でない問題・まだ答えていない問題）が4割。
 *     苦手は正答率の低い順（同じなら間違えた回数の多い順）に選ぶ。それ以外は rng で選ぶ。
 *   ・難しさは形態ごとの範囲（TRUE_DIFFICULTY）から。苦手が足りなければそれ以外で、それ以外が足りなければ苦手で、範囲内を埋める。
 *     それでも足りなければ、範囲に近い難しさ（苦手を先に）で埋める。
 *   ・1回の戦いで同じ問題を2度出さない（形態をまたいでも）。同じ ID の問題が重なっていても1問として数える。
 *   ・問題の数が足りないときは、3つの形態に同じ数ずつ（1形態が空にならないように）。
 *   ・難しい形態から先に選ぶ（難しさ4は少ないので、第3形態が取り損ねないように）。各形態の中の並びは rng で混ぜる。
 * 戻り値 { forms: [第1形態の問題, 第2, 第3], perForm, weak } （weak は選んだ苦手な問題の数）。
 */
export function buildTrueBossPlan(questions, qstats, opts = {}) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const st = qstats && typeof qstats === 'object' ? qstats : {};
  const ids = new Set();
  const pool = [];
  for (const q of Array.isArray(questions) ? questions : []) {
    if (!q || typeof q !== 'object' || typeof q.id !== 'string' || !q.id || ids.has(q.id)) continue;
    ids.add(q.id);
    pool.push(q);
  }
  const want = Number.isInteger(opts.perForm) && opts.perForm > 0 ? opts.perForm : TRUE_QUEUE_PER_FORM;
  const per = Math.min(want, Math.floor(pool.length / TRUE_FORMS));
  const weakAll = [];
  const otherAll = [];
  pool.forEach((q, i) => {
    if (isMissed(st[q.id])) {
      const a = accuracyOf(st[q.id]);
      weakAll.push({ q, i, d: difficultyOf(q), rate: a ? a.rate : 0, wrong: a ? a.wrong : 0, weak: true });
    } else otherAll.push({ q, i, d: difficultyOf(q), weak: false });
  });
  weakAll.sort((x, y) => (x.rate !== y.rate ? x.rate - y.rate : x.wrong !== y.wrong ? y.wrong - x.wrong : x.i - y.i));
  const otherMixed = shuffled(otherAll, rng);
  const weakN = Math.round(per * TRUE_WEAK_RATIO);
  const used = new Set();
  const out = {};
  let weakChosen = 0;
  for (const f of [3, 2, 1]) {
    const band = TRUE_DIFFICULTY[f];
    const wFree = weakAll.filter((x) => !used.has(x.q.id));
    const oFree = otherMixed.filter((x) => !used.has(x.q.id));
    const inW = wFree.filter((x) => distanceToBand(x.d, band) === 0);
    const inO = oFree.filter((x) => distanceToBand(x.d, band) === 0);
    const takeW = inW.slice(0, weakN);
    const takeO = inO.slice(0, per - weakN);
    const picked = [...takeW, ...takeO];
    let need = per - picked.length;
    if (need > 0) { // 範囲の中で、足りないほうを、余っているほうで埋める
      const add = [...inW.slice(takeW.length), ...inO.slice(takeO.length)].slice(0, need);
      picked.push(...add);
      need -= add.length;
    }
    if (need > 0) { // 範囲の外から、範囲に近い順（同じ近さなら苦手を先）
      const rest = [...wFree, ...oFree]
        .filter((x) => distanceToBand(x.d, band) > 0)
        .map((x, k) => ({ x, k, dist: distanceToBand(x.d, band) }))
        .sort((a, b) => (a.dist !== b.dist ? a.dist - b.dist : a.x.weak !== b.x.weak ? (a.x.weak ? -1 : 1) : a.k - b.k))
        .map((e) => e.x);
      picked.push(...rest.slice(0, need));
    }
    for (const x of picked) { used.add(x.q.id); if (x.weak) weakChosen++; }
    out[f] = shuffled(picked, rng).map((x) => x.q);
  }
  return { forms: [out[1], out[2], out[3]], perForm: per, weak: weakChosen };
}

// ---- 体力・回復・技 ----
/** 形態ごとのボスの体力。TRUE_HP_MIN〜TRUE_HP_MAX のどれかを同じ確率で。rng は 0 以上 1 未満を返す関数。 */
export function rollFormHp(rng = Math.random) {
  let r = Number(rng());
  if (!Number.isFinite(r)) r = 0;
  r = Math.min(Math.max(r, 0), 0.999999999);
  return TRUE_HP_MIN + Math.floor(r * (TRUE_HP_MAX - TRUE_HP_MIN + 1));
}

/** 戦いの始まり（第1形態）。boss／bossMax はいまの形態のボスの体力（boss.js の bossMood がそのまま使える名前）。 */
/** 次にボスが回復するまでの問数（形態の中で数える）。TRUE_HEAL_GAP_MIN〜TRUE_HEAL_GAP_MAX のどれか。 */
export function rollHealGap(rng = Math.random) {
  let r = Number(rng());
  if (!Number.isFinite(r)) r = 0;
  r = Math.min(Math.max(r, 0), 0.999999999);
  return TRUE_HEAL_GAP_MIN + Math.floor(r * (TRUE_HEAL_GAP_MAX - TRUE_HEAL_GAP_MIN + 1));
}

export function newTrueBattle(rng = Math.random) {
  const hp = rollFormHp(rng);
  return { form: 1, boss: hp, bossMax: hp, player: PLAYER_HP, playerMax: PLAYER_HP, streak: 0, asked: 0, skill: null, result: null, nextHeal: rollHealGap(rng) };
}

/** 負けたあと、もう一度挑むとき。第1形態からやり直す。負けていない戦いはそのまま（写しを返す）。 */
export function restartAfterLose(battle, rng = Math.random) {
  return battle && battle.result === 'lose' ? newTrueBattle(rng) : { ...battle };
}

/**
 * 時間制限の技の、その問題の制限時間（秒。整数）。5秒＋（問題文と選択肢の文字数の合計÷10）秒、切り上げ。最短 10 秒、最長 maxSeconds。
 * q は問題（stem と choices）。壊れた問題（文字列でない・選択肢が配列でない）は、文字数に数えない。maxSeconds が数でない・10 未満なら、最長は 40（10 未満は 10）。
 */
export function timedSecondsFor(q, maxSeconds) {
  const len = (v) => (typeof v === 'string' ? v.length : 0);
  const chars = len(q && q.stem) + (q && Array.isArray(q.choices) ? q.choices.reduce((n, c) => n + len(c), 0) : 0);
  const max = Math.max(SKILL_MIN_SECONDS, Number.isFinite(maxSeconds) && maxSeconds > 0 ? Math.floor(maxSeconds) : SKILL_MAX_FALLBACK);
  const sec = Math.ceil((SKILL_BASE_SECONDS * SKILL_CHARS_PER_SECOND + chars) / SKILL_CHARS_PER_SECOND); // 整数で割って、小数の誤差を避ける
  return Math.min(max, Math.max(SKILL_MIN_SECONDS, sec));
}

/** その問題の制限時間（秒）。時間制限の技がかかっていなければ null。 */
export function timeLimitFor(skill, q, maxSeconds) {
  return skill && skill.kind === 'timed' ? timedSecondsFor(q, maxSeconds) : null;
}

/** 時間切れか。制限時間より長くかかったとき（ちょうど制限時間は間に合っている）。技がかかっていなければ常に false。 */
export function isTimedOut(skill, seconds, q, maxSeconds) {
  const lim = timeLimitFor(skill, q, maxSeconds);
  return lim !== null && Number.isFinite(seconds) && seconds > lim;
}

/**
 * 問題を出す前に、ボスが技を使ってくるか。使うのは、技がかかっていなくて、形態の最初の問題でないときだけ（rng は使うときだけ消費する）。
 * 戻り値 { battle, started }。started は始まった技の種類（'timed' | 'curse'）、使わなければ null。
 */
export function rollSkill(battle, rng = Math.random) {
  if (!battle || battle.result || battle.skill || !(battle.asked > 0)) return { battle: { ...battle }, started: null };
  const chance = SKILL_CHANCE[battle.form] || 0;
  if (!(rng() < chance)) return { battle: { ...battle }, started: null };
  const kind = battle.form === 3 && rng() < CURSE_SHARE ? 'curse' : 'timed';
  return { battle: { ...battle, skill: { kind, turns: SKILL_TURNS } }, started: kind };
}

/**
 * 1問の結果を反映する。戻り値 { battle, events }（元は変えない）。終わった後の答えは無視する。
 *   correct … 正解か。timedOut … 時間切れ（不正解として数える）。damage … 正解のときボスが減る数（会心の一撃は 2）
 * 順序: ①正解ならボスが減り・不正解ならこちらが減る（呪いの間は 2）→ ②3問続けて正解で HP が 1 回復 → ③技のターンが 1 減る
 *       → ④HP 0 で負け ／ ボスの体力 0 で進化（第3形態なら勝ち）→ ⑤進化も決着もしなければ、形態の中で 7〜10問に1回（TRUE_HEAL_GAP_MIN〜MAX。回復のたびに決め直す）ボスが回復。
 * events: { hit, miss, damage, lost, playerHealed, bossHealed, evolved: {from,to}|null, skillEnded: 種類|null, timedOut }
 */
export function answerTrueBattle(battle, { correct = false, damage = 1, timedOut = false } = {}, rng = Math.random) {
  const ev = { hit: false, miss: false, damage: 0, lost: 0, playerHealed: false, bossHealed: false, evolved: null, skillEnded: null, timedOut: !!timedOut };
  if (battle.result) return { battle: { ...battle }, events: ev };
  const b = { ...battle };
  const ok = !!correct && !timedOut;
  const skill = b.skill;
  if (ok) {
    const d = Number.isInteger(damage) && damage >= 1 ? damage : 1;
    b.boss = Math.max(0, b.boss - d);
    ev.hit = true;
    ev.damage = d;
    b.streak += 1;
    if (b.streak >= STREAK_HEAL) {
      b.streak = 0;
      if (b.player < b.playerMax) { b.player += 1; ev.playerHealed = true; }
    }
  } else {
    const before = b.player;
    b.player = Math.max(0, b.player - (skill && skill.kind === 'curse' ? SKILL_CURSE_DAMAGE : 1));
    ev.miss = true;
    ev.lost = before - b.player;
    b.streak = 0;
  }
  b.asked += 1;
  if (skill) {
    if (skill.turns - 1 <= 0) { b.skill = null; ev.skillEnded = skill.kind; } else b.skill = { ...skill, turns: skill.turns - 1 };
  }
  if (b.player === 0) {
    b.result = 'lose';
    return { battle: b, events: ev };
  }
  if (b.boss === 0) {
    if (b.form < TRUE_FORMS) {
      ev.evolved = { from: b.form, to: b.form + 1 };
      b.form += 1;
      const hp = rollFormHp(rng);
      b.boss = hp;
      b.bossMax = hp;
      b.asked = 0;
      b.nextHeal = rollHealGap(rng);
      if (b.skill) { ev.skillEnded = b.skill.kind; b.skill = null; } // 進化すると技は解ける
    } else {
      b.result = 'win';
    }
    return { battle: b, events: ev };
  }
  if (b.asked >= b.nextHeal && b.boss < b.bossMax) { // 間隔が来ても満タンなら回復しない（減ったらすぐ回復する）
    b.nextHeal = b.asked + rollHealGap(rng);
    b.boss = Math.min(b.bossMax, b.boss + TRUE_HEAL_AMOUNT);
    ev.bossHealed = true;
  }
  return { battle: b, events: ev };
}

// ---- 1回の戦い（問題の順番つき） ----
// run = { battle, queues: [第1,第2,第3形態の残りの問題], history: [{ q, correct }], recycled: 出し直した回数 }
// 問題が尽きても決着していなければ（問題の数が少ないアプリ・とても長引いた戦い）、この戦いで出した問題を、間違えたものを先にして出し直す。
function refill(run) {
  if (run.battle.result) return run;
  const i = run.battle.form - 1;
  if (run.queues[i].length || !run.history.length) return run;
  const latest = new Map();
  for (const h of run.history) latest.set(h.q.id, h);
  const all = [...latest.values()];
  const queue = [...all.filter((x) => !x.correct), ...all.filter((x) => x.correct)].map((x) => x.q);
  const queues = run.queues.map((q, k) => (k === i ? queue : q));
  return { ...run, queues, recycled: run.recycled + 1 };
}

/** 戦いの始まり。plan は buildTrueBossPlan の結果。 */
export function newTrueRun(plan, rng = Math.random) {
  const forms = plan && Array.isArray(plan.forms) ? plan.forms.slice(0, TRUE_FORMS).map((f) => (Array.isArray(f) ? f.slice() : [])) : [];
  while (forms.length < TRUE_FORMS) forms.push([]);
  return refill({ battle: newTrueBattle(rng), queues: forms, history: [], recycled: 0 });
}

/** いま出す問題。決着がついている・出せる問題が無ければ null。 */
export function currentTrueQuestion(run) {
  if (run.battle.result) return null;
  return run.queues[run.battle.form - 1][0] || null;
}

/** 問題を出す前の技の判定を戦いに反映する。 */
export function rollRunSkill(run, rng = Math.random) {
  const r = rollSkill(run.battle, rng);
  return { run: { ...run, battle: r.battle }, started: r.started };
}

/** いまの問題への答えを反映する。戻り値 { run, events }（元は変えない）。問題が無ければ events は null。 */
export function answerTrueRun(run, answer, rng = Math.random) {
  const q = currentTrueQuestion(run);
  if (!q) return { run: { ...run }, events: null };
  const { battle, events } = answerTrueBattle(run.battle, answer, rng);
  const i = run.battle.form - 1;
  const queues = run.queues.map((x, k) => (k === i ? x.slice(1) : x));
  const history = [...run.history, { q, correct: !events.miss }];
  return { run: refill({ ...run, battle, queues, history }), events };
}
