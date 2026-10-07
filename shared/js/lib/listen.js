// 聞き流し（耳だけで学ぶ）の、ブラウザに触れない部分。読み上げる文の整形・並び・設定の正規化。
// 実際に声を出すのは views/listen.js（speechSynthesis）。ここは純粋な関数だけ（テストできる）。

export const LISTEN_RATE_MIN = 0.8;
export const LISTEN_RATE_MAX = 1.5;
export const DEFAULT_LISTEN_RATE = 1.0;
export const LISTEN_PAUSE_CHOICES = [3, 5, 10];
export const DEFAULT_LISTEN_PAUSE = 5;
/** 1回の speak に渡す文の長さの上限（長いと途中で止まる端末があるため、これを超える文は読点などで分ける） */
export const MAX_SPEAK_CHARS = 70;

/** 読む速さ（倍）。0.8〜1.5 を 0.1 刻みに丸める。数でない・範囲外は初期値／端に寄せる。 */
export function normalizeListenRate(v) {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v);
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_LISTEN_RATE;
  const r = Math.round(v * 10) / 10;
  return Math.min(LISTEN_RATE_MAX, Math.max(LISTEN_RATE_MIN, r));
}

/** 問題の「考える間」（秒）。3・5・10 のどれか。それ以外は 5。 */
export function normalizeListenPause(v) {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v);
  return LISTEN_PAUSE_CHOICES.includes(v) ? v : DEFAULT_LISTEN_PAUSE;
}

/** settings の聞き流しの項目を正しい形に直す（settings 自体を書き換える）。listenKeepAwake＝再生中に画面を消さない（初期オフ）。 */
export function normalizeListenSettings(settings) {
  const s = settings;
  s.listenRate = normalizeListenRate(s.listenRate);
  s.listenPause = normalizeListenPause(s.listenPause);
  s.listenKeepAwake = s.listenKeepAwake === true;
  return s;
}

// ---- 読み方への整形 ----

const CIRCLED = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9 };
const GREEK = { 'α': 'アルファ', 'β': 'ベータ', 'γ': 'ガンマ', 'δ': 'デルタ', 'ε': 'イプシロン', 'θ': 'シータ', 'λ': 'ラムダ', 'μ': 'ミュー', 'µ': 'ミュー', 'σ': 'シグマ', 'Σ': 'シグマ' };

/**
 * 声に出したとき読みにくい記号を、読み方に置き換える。順番に意味がある（長いものを先に）。
 * 置き換えたもの: → から／× かける／÷ わる／＝ は／＋ プラス／％ パーセント／①〜⑨ 1番〜9番／小数点 点／マイナス／
 *   √ ルート／² の2乗／≒ ほぼ／≠ ≧ ≦ ∞／± プラスマイナス／& アンド／〇 まる／℃ 度／㎡ 平方メートル／〜 から（範囲のときだけ。省略の〜は読まない）／ギリシャ文字／空欄（ア＿＿）／分数 N分のM／全角の括弧は間、かぎ括弧は外す
 * 残したもの: 英字・略語（AI・GPU など）／括弧内の英語／式の中の記号（| { } ⊃ ← ^ 添字など。式は整形しきれない）
 */
export function toSpeechText(input) {
  let t = String(input == null ? '' : input);
  // 空欄: （ア＿＿）→「アの空欄」、ほかの＿＿→「空欄」
  t = t.replace(/[（(]([ア-オA-Za-z])[＿_]+[）)]/g, '$1の空欄');
  t = t.replace(/[＿_]{2,}/g, '空欄').replace(/＿/g, '空欄');
  // 丸数字
  t = t.replace(/[①-⑨]/g, (c) => CIRCLED[c] + '番');
  // 数式まわり
  t = t.replace(/(\d)\s*\/\s*(\d)/g, (m, a, b) => b + '分の' + a);
  t = t.replace(/(\d)\.(\d)/g, '$1点$2');
  t = t.replace(/[−－]\s*(?=\d)/g, 'マイナス').replace(/−/g, 'マイナス');
  t = t.replace(/(^|[^\w.])-(?=\d)/g, '$1マイナス').replace(/(^|[^\w.])\+(?=\d)/g, '$1プラス');
  t = t.replace(/(\d)\s*[%％]/g, '$1パーセント').replace(/[%％]/g, 'パーセント');
  t = t.replace(/√/g, 'ルート').replace(/²/g, 'の2乗').replace(/³/g, 'の3乗');
  t = t.replace(/×/g, 'かける').replace(/÷/g, 'わる');
  t = t.replace(/[＋]/g, 'プラス').replace(/\s\+\s/g, 'プラス');
  t = t.replace(/±/g, 'プラスマイナス').replace(/[≒≈]/g, 'ほぼ').replace(/≠/g, 'イコールではない').replace(/≧/g, '以上').replace(/≦/g, '以下').replace(/∞/g, '無限大');
  t = t.replace(/[&＆]/g, 'アンド').replace(/[〇○]{2,}/g, 'まるまる').replace(/[〇○]/g, 'まる');
  t = t.replace(/[＝]/g, 'は').replace(/\s=\s/g, 'は');
  t = t.replace(/℃/g, '度').replace(/㎡/g, '平方メートル');
  // 〜: 前後が両方とも語・数字（範囲）のときだけ「から」。後ろが句読点・括弧・文末など（省略の使い方）なら読まずに取り除く
  t = t.replace(/(?<=[^\s。、，,！？!?「」『』（）()\[\]［］])[〜～](?=[^\s。、，,！？!?「」『』（）()\[\]［］])/g, 'から').replace(/[〜～]/g, '');
  t = t.replace(/[→⇒]/g, 'から');
  t = t.replace(/[αβγδεθλμµσΣ]/g, (c) => GREEK[c]);
  // 区切りの斜線は読点に（数字どうしの分数は上で処理済み）
  t = t.replace(/\s*[／/]\s*/g, '、');
  // かぎ括弧は外す（読み上げ側が記号名を読むことがあるため）。丸括弧は中身ごと読む
  t = t.replace(/[「」『』]/g, '');
  t = t.replace(/[（]/g, '、').replace(/[）]/g, '、').replace(/[()]/g, ' '); // 全角の括弧は間（読点）に。V(s) のような式の括弧は、読みを切らないよう空白に
  t = t.replace(/[…]+/g, '、').replace(/[―—]+/g, '、');
  // 整理: 連続する読点・空白
  t = t.replace(/\s+/g, ' ').replace(/、\s*、+/g, '、').replace(/^、+/, '').replace(/、+([。！？!?])/g, '$1').replace(/([。！？])、+/g, '$1');
  return t.trim();
}

/** 読み上げる1回ぶん（speak 1回）に分ける。文末（。！？改行）で切り、まだ長ければ読点で、それでも長ければ上限で切る。 */
export function splitSpeech(text, max = MAX_SPEAK_CHARS) {
  const out = [];
  const sentences = String(text).split(/(?<=[。！？!?])|\n+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    if (s.length <= max) { out.push(s); continue; }
    let buf = '';
    for (const part of s.split(/(?<=[、，,])/)) {
      if (buf && (buf + part).length > max) { out.push(buf); buf = ''; }
      buf += part;
      while (buf.length > max) { out.push(buf.slice(0, max)); buf = buf.slice(max); }
    }
    if (buf) out.push(buf);
  }
  return out;
}

/** 文章を、整形して分けた speak 用の文の列にする。読むものが無ければ空。 */
function speech(text) {
  return splitSpeech(toSpeechText(text)).map((t) => ({ text: t }));
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * 用語カード1枚の読み上げ。題名 → 一言で言うと → 背景とポイント。
 * 返すもの: 読む区切りの配列。{ text } は声に出す1回ぶん、{ pause: 秒 } は無音の間。
 */
export function cardSegments(c) {
  const seg = [];
  seg.push(...speech(c.title));
  if (c.oneLine) { seg.push(...speech('一言で言うと。' + c.oneLine)); }
  if (c.why) { seg.push(...speech('背景とポイント。' + c.why)); }
  return seg;
}

/**
 * 問題1問の読み上げ。問題文 → 選択肢をA〜Dで → 考える間 → 『正解は〜』 → 解説。
 * pauseSec … 考える間（秒）
 */
export function questionSegments(q, pauseSec = DEFAULT_LISTEN_PAUSE) {
  const seg = [];
  seg.push(...speech('問題。' + q.stem));
  q.choices.forEach((ch, i) => seg.push(...speech((LETTERS[i] || String(i + 1)) + '。' + ch)));
  seg.push({ pause: normalizeListenPause(pauseSec) });
  const L = LETTERS[q.answer] || String(q.answer + 1);
  seg.push(...speech('正解は、' + L + '。' + q.choices[q.answer]));
  if (q.explanation) seg.push(...speech('解説。' + q.explanation));
  return seg;
}

// ---- 読む順 ----

/** 章（ステージ）の一覧。聞く種類ごとに、その種類が1件でもある章だけ。順番は地図と同じ。 */
export function listenChapters(tree, kind) {
  return tree.stages
    .map((s) => ({ key: s.key, major: s.path[0], name: s.name, count: (kind === 'question' ? s.questions : s.concepts).length }))
    .filter((c) => c.count > 0);
}

function shuffled(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 読む順の一覧を作る。
 *  kind … 'card'（用語カード）／'question'（問題）
 *  chapters … 章のキー（tree.stages の key）の配列。空なら全部。順番は選び順ではなく章の順
 *  shuffle … true なら全体を混ぜる
 * 返すもの: { id, title, chapter, item } の配列（item は元のカード／問題）
 */
export function buildPlaylist({ kind, tree, concepts = [], questions = [], chapters = [], shuffle = false, rng = Math.random }) {
  const want = new Set(chapters);
  const all = want.size === 0;
  const items = [];
  for (const s of tree.stages) {
    if (!all && !want.has(s.key)) continue;
    for (const it of kind === 'question' ? s.questions : s.concepts) items.push({ it, chapter: s.name });
  }
  if (all) {
    // 章に入っていないカード・問題（シラバスの経路が無い）は、全部を聞くときだけ最後に足す
    const seen = new Set(items.map((x) => x.it.id));
    for (const it of kind === 'question' ? questions : concepts) if (!seen.has(it.id)) items.push({ it, chapter: '' });
  }
  const list = items.map(({ it, chapter }) => ({
    id: it.id,
    title: kind === 'question' ? questionTitle(it) : it.title,
    chapter,
    item: it,
  }));
  return shuffle ? shuffled(list, rng) : list;
}

/** 問題の画面用の題名。問題文の頭を短く（読み上げには使わない）。 */
export function questionTitle(q) {
  const t = String(q.stemPlain || q.stem || '').replace(/\s+/g, ' ').trim();
  return t.length > 40 ? t.slice(0, 40) + '…' : t;
}

/** 読む順の1件を、読み上げる区切りの列にする。 */
export function segmentsFor(kind, entry, pauseSec) {
  return kind === 'question' ? questionSegments(entry.item, pauseSec) : cardSegments(entry.item);
}

/**
 * 日本語の声を選ぶ。lang が ja で始まる（ja-JP も ja_JP も）もの。
 * 優先: 端末の中の声（localService）→ 既定の声 → 先頭。無ければ null。
 */
export function pickJaVoice(voices) {
  const ja = (voices || []).filter((v) => v && typeof v.lang === 'string' && /^ja([-_]|$)/i.test(v.lang));
  if (!ja.length) return null;
  return ja.find((v) => v.localService && v.default) || ja.find((v) => v.localService) || ja.find((v) => v.default) || ja[0];
}
