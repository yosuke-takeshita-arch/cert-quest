// ボスの名前・せりふのデータ（<アプリ>/data/bosses.json）の読み込みと整形。DOM は触らない。
// 形: [ { no, stageKey, name, title, color, lines: { appear: [], attack: [], hurt: [], defeat: [] } } ]
//   stageKey … 地図の章のキー（大項目|中項目。章の画面・ボス戦と同じ）。no … 章の番号（絵 images/bosses/boss-<no>.webp の番号）
// ファイルが無い・壊れている・その章が無いときは、汎用のボス（「（章の名前）の ボス」と決まったせりふ）で動く。
export const LINE_KINDS = ['appear', 'attack', 'hurt', 'defeat'];
export const DEFAULT_COLOR = '#c62828';
export const BOSSES_FILE = 'bosses.json';

// 汎用のせりふ（データが無いとき）。ボスの口から出る短い言葉で、試験の中身は入れない。
export const GENERIC_LINES = {
  appear: ['ここから先へは 行かせないぞ！'],
  attack: ['まだまだ これからだ！'],
  hurt: ['ぐっ…やるな！'],
  defeat: ['み、みごとだ…！'],
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

/** 読んだ JSON を、使える形の配列にする。配列でないものは空。形が崩れた1件は捨てる。同じ stageKey は先のものを使う。 */
export function normalizeBosses(raw) {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray(raw.bosses) ? raw.bosses : [];
  const out = [];
  const seen = new Set();
  for (const b of arr) {
    if (!b || typeof b !== 'object') continue;
    if (typeof b.stageKey !== 'string' || !b.stageKey || seen.has(b.stageKey)) continue;
    if (typeof b.name !== 'string' || !b.name.trim()) continue;
    seen.add(b.stageKey);
    const lines = {};
    for (const k of LINE_KINDS) lines[k] = strs(b.lines && b.lines[k]);
    out.push({
      no: Number.isInteger(b.no) && b.no > 0 ? b.no : null,
      stageKey: b.stageKey,
      name: b.name.trim(),
      title: typeof b.title === 'string' ? b.title.trim() : '',
      color: typeof b.color === 'string' && HEX.test(b.color) ? b.color : null,
      lines,
    });
  }
  return out;
}

/**
 * その章のボスの姿。bosses は normalizeBosses の結果（無くてもよい）、stage は { key, name }。
 * データに無い章は汎用（generic: true、名前は『（章の名前）の ボス』）。せりふが空の種類は汎用のせりふで埋める。
 */
export function bossProfile(bosses, stage) {
  const list = Array.isArray(bosses) ? bosses : [];
  const found = stage ? list.find((b) => b.stageKey === stage.key) : null;
  const stageName = stage && typeof stage.name === 'string' ? stage.name : '';
  if (!found) {
    return { no: null, stageKey: stage ? stage.key : null, name: stageName + 'の ボス', title: '', color: DEFAULT_COLOR, lines: GENERIC_LINES, generic: true };
  }
  const lines = {};
  for (const k of LINE_KINDS) lines[k] = found.lines[k].length ? found.lines[k] : GENERIC_LINES[k];
  return { ...found, color: found.color || DEFAULT_COLOR, lines, generic: false };
}

/** せりふを1つ選ぶ。rng は 0 以上 1 未満を返す関数（テストでは差し替える）。 */
export function pickLine(profile, kind, rng = Math.random) {
  const list = profile && profile.lines && profile.lines[kind] && profile.lines[kind].length ? profile.lines[kind] : GENERIC_LINES[kind] || [''];
  let r = Number(rng());
  if (!Number.isFinite(r)) r = 0;
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(r * list.length)))];
}

/** 窓に出すせりふの形。すでに 「」『』 で始まっていればそのまま、そうでなければ 「」 で囲む。 */
export function quoted(line) {
  const s = String(line == null ? '' : line);
  return /^[「『]/.test(s) ? s : s ? '「' + s + '」' : '';
}

export const FACE_X = 0.5; // 全身の絵で、顔の中心が絵の幅の何割のところにあるか（左から）
export const FACE_Y = 0.23; // 同じく、上から何割のところか（顔が上3分の1にある前提。要件定義書 §3-7 の全身の絵）

/**
 * 章の画面・地図の小さな丸（顔の切り抜き）の拡大と位置。丸は絵を cover で入れた正方形で、そこへ scale(zoom) をかけ、顔の中心が丸の真ん中に来るよう translate する。
 * 戻り値 { zoom, tx, ty }: tx・ty は丸の大きさに対する割合（CSS の translate の % に掛ける）。
 * 正方形（全身）は zoom 2.5（幅250%・左へ75%・上へ7.5%）。縦長の絵ほど、少し大きく（上限 3.5）。寸法が壊れていれば拡大しない。
 */
export function faceCrop(width, height) {
  if (!(width > 0) || !(height > 0)) return { zoom: 1, tx: 0, ty: 0 };
  const r = height / width;
  const zoom = r <= 1.15 ? 2.5 : Math.min(3.5, Math.round((2.5 + (r - 1.15) * 1.5) * 100) / 100);
  return { zoom, tx: Math.round((0.5 - FACE_X * zoom) * 1000) / 1000, ty: Math.round((0.5 - FACE_Y * zoom) * 1000) / 1000 };
}

/** ボスのデータを読む。失敗（404・壊れた JSON・通信エラー）は空配列。404 は黙って、壊れた形（JSON の読み込みに失敗）だけ reason を返す。 */
export async function loadBosses(url, fetchFn = (u) => fetch(u)) {
  try {
    const res = await fetchFn(url);
    if (!res || !res.ok) return { bosses: [], reason: null };
    try {
      return { bosses: normalizeBosses(await res.json()), reason: null };
    } catch (e) {
      return { bosses: [], reason: '読み込めない形' };
    }
  } catch (e) {
    return { bosses: [], reason: null };
  }
}
