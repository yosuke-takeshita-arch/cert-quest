// 「どっち？」早押し（要件定義書 §3-5）。用語カードの一行目を出し、そのカードの題名と「混同しやすい相手」の題名の2択にする。
// 純粋な関数だけ（画面は views/dochi.js）。問題は新しく作らず、カードから自動で作る。
import { resolveRef } from './data.js';

export const DOCHI_ROUNDS = 20; // 1回の問題数
export const DOCHI_PICK_SECONDS = 3; // 1問の秒数のうち、読んだあと2つから選ぶ分
export const DOCHI_READ_CHARS_PER_SEC = 8; // 読む速さ（1秒に何字）

/**
 * 1問の制限秒数（時間切れは不正解）。選ぶ3秒＋説明を読む時間（1秒に8字）を切り上げる。
 * 2026-10-19 先生「問題文が長すぎて5秒じゃ無理」。それまでは一律5秒で、G検定の一行目（真ん中で104字）は1秒に20字ほど読まないと間に合わなかった。
 */
export function dochiSeconds(text) {
  const len = [...String(text == null ? '' : text)].length;
  return Math.ceil(DOCHI_PICK_SECONDS + len / DOCHI_READ_CHARS_PER_SEC);
}
export const DOCHI_POINT_MS = 2000; // 間違えたとき、違いを出しておく長さ
export const DOCHI_MASK = '〇〇';

const norm = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAscii = (s) => /^[\x20-\x7e]+$/.test(s);

/**
 * 題名から、伏せる語（1語ずつ）を取り出す。
 * - 括弧つきの別名「ディープラーニング（深層学習）」は、括弧の外と中の両方
 * - 「A・B」「AとB」「A／B」「A、B」は1語ずつ
 * - 1文字の語は伏せない（「と」「の」などを巻き込んで読めなくなるため）
 * 長い語が先に来る順で返す（短い語が先に伏せられて、長い語の一部が残るのを防ぐ）。
 */
export function titleTerms(title) {
  const t = String(title == null ? '' : title);
  const parts = [];
  let outside = t;
  const re = /[（(]([^）)]*)[）)]/g;
  let m;
  while ((m = re.exec(t))) parts.push(m[1]);
  outside = t.replace(re, ' ');
  parts.push(outside);
  const terms = new Set();
  for (const p of parts) {
    for (const piece of p.split(/[・／/、,]|と/)) {
      const w = piece.trim();
      if (w.length >= 2) terms.add(w);
      // 「AとBの違い」「is-aの関係」の末尾の言い方は、一行目には出てこない。語そのものも伏せる
      const core = w.replace(/(の違い|の関係)$/, '').trim();
      if (core !== w && core.length >= 2) terms.add(core);
    }
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

// 英数字だけの語は、ほかの英単語の一部（RAINBOW の AI）まで伏せないよう、前後が英数字でないときだけ当てる
function termRegex(term, flags) {
  const body = escapeRe(term);
  return isAscii(term) ? new RegExp('(?<![A-Za-z0-9])' + body + '(?![A-Za-z0-9])', flags) : new RegExp(body, flags);
}

/**
 * 一行目の中の題名の語を「〇〇」に置き換える。
 * 戻り値: { ok, text, masked }
 *   ok=false … 伏せたあとも題名の語が残っている（全角半角・大文字小文字の違いも含めて見る）。出題に使わない。
 *   masked   … 置き換えた箇所の数
 */
export function maskOneLine(title, oneLine) {
  const terms = titleTerms(title);
  let text = String(oneLine == null ? '' : oneLine);
  let masked = 0;
  for (const term of terms) {
    text = text.replace(termRegex(term, 'gi'), () => {
      masked++;
      return DOCHI_MASK;
    });
  }
  const leaked = hasTerm(text, terms);
  return { ok: !leaked && text.trim().length > 0, text, masked };
}

/** 文の中に、語のどれかが（全角半角・大文字小文字を揃えて）残っているか。 */
export function hasTerm(text, terms) {
  const check = norm(text);
  return terms.some((term) => termRegex(norm(term), 'i').test(check));
}

/**
 * 出せる組を全部作る。カード1枚の confusions の1件ごとに1組。
 * 出さないもの: 一行目が空／相手が見つからない／相手が自分自身／2つの題名が同じ／伏せきれないカード／一行目に相手の題名が書いてある組
 * 戻り値: { pairs, skipped:{ noOneLine, noOpponent, sameTitle, leak, oppInText } }
 */
export function buildPairs(concepts, index) {
  const pairs = [];
  const seen = new Set();
  const skipped = { noOneLine: 0, noOpponent: 0, sameTitle: 0, leak: 0, oppInText: 0 };
  for (const c of concepts) {
    const conf = Array.isArray(c.confusions) ? c.confusions : [];
    for (const ref of conf) {
      const r = resolveRef(ref, index);
      if (!r.concept || r.concept.id === c.id) {
        skipped.noOpponent++;
        continue;
      }
      const key = c.id + '>' + r.concept.id;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!String(c.oneLine || '').trim()) {
        skipped.noOneLine++;
        continue;
      }
      if (norm(c.title) === norm(r.concept.title)) {
        skipped.sameTitle++;
        continue;
      }
      const m = maskOneLine(c.title, c.oneLine);
      if (!m.ok) {
        skipped.leak++;
        continue;
      }
      // 一行目に相手の題名がそのまま書いてあると、選ばなくても消去で答えが分かる
      if (hasTerm(m.text, titleTerms(r.concept.title))) {
        skipped.oppInText++;
        continue;
      }
      pairs.push({ key, id: c.id, oppId: r.concept.id, title: c.title, oppTitle: r.concept.title, text: m.text, point: r.point || '' });
    }
  }
  return { pairs, skipped };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 1回ぶんの出題。同じカードはなるべく1回だけ（足りなければ重ねる）。2つの選択肢の左右は毎回ランダム。
 * 戻り値: [{ pair, choices:[題名, 題名], answer:0|1 }]
 */
export function pickRound(pairs, n = DOCHI_ROUNDS, rng = Math.random) {
  const order = shuffled(pairs, rng);
  const used = new Set();
  const first = [];
  const rest = [];
  for (const p of order) {
    if (used.has(p.id)) rest.push(p);
    else {
      used.add(p.id);
      first.push(p);
    }
  }
  const chosen = first.concat(rest).slice(0, n);
  return chosen.map((pair) => {
    const flip = rng() < 0.5;
    return { pair, choices: flip ? [pair.oppTitle, pair.title] : [pair.title, pair.oppTitle], answer: flip ? 1 : 0 };
  });
}

/** 答えが合っているか。時間切れ（null）や範囲外は不正解。 */
export function isCorrect(item, chosen) {
  return Number.isInteger(chosen) && chosen === item.answer;
}

/** 次のコンボ数。正解で+1、不正解・時間切れで0に戻る。 */
export function nextCombo(combo, correct) {
  return correct ? combo + 1 : 0;
}

// ---- 結果発表のランク（要件定義書 §3-5） ----

/**
 * ランクの区切り（正解の割合。百分率）。S は全問正解（割合ではなく全問）。
 * 20問なら A＝16問以上・B＝11問以上。出せる組が足りず 20問に満たないときも、同じ割合で決める。
 */
export const DOCHI_RANK_A_PERCENT = 80;
export const DOCHI_RANK_B_PERCENT = 55;

/**
 * 正解数と出題数から、ランク（'S'｜'A'｜'B'｜'C'）を返す。
 * 小数の比べを避けるため、百分率を掛け算で比べる（11/20 が 55% ちょうどでも外れない）。出題数が0・数でないときは C。
 */
export function dochiRank(correct, total) {
  const t = toCount(total);
  const c = Math.min(toCount(correct), t);
  if (t <= 0) return 'C';
  if (c === t) return 'S';
  if (c * 100 >= DOCHI_RANK_A_PERCENT * t) return 'A';
  if (c * 100 >= DOCHI_RANK_B_PERCENT * t) return 'B';
  return 'C';
}

// ---- 記録（state.dochi = { runs, best, bestCombo }） ----

const toCount = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isSafeInteger(Math.floor(v)) ? Math.floor(v) : 0);

/** 読んだ保存データの dochi を正しい形にする。項目なし・数でない値・負数は0。 */
export function normalizeDochi(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { runs: toCount(r.runs), best: toCount(r.best), bestCombo: toCount(r.bestCombo) };
}

/**
 * 1回ぶんの結果を記録する。qstats・XP には触らない。
 * 戻り値: { newBest, newBestCombo }（更新したか。0 では更新としない）
 */
export function recordDochi(state, correct, bestCombo) {
  state.dochi = normalizeDochi(state.dochi);
  const d = state.dochi;
  const c = toCount(correct);
  const b = toCount(bestCombo);
  const out = { newBest: c > d.best, newBestCombo: b > d.bestCombo };
  d.runs += 1;
  if (out.newBest) d.best = c;
  if (out.newBestCombo) d.bestCombo = b;
  return out;
}
