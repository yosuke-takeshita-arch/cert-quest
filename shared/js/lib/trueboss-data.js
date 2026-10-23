// 真ボスの名前・せりふのデータ（<アプリ>/data/trueboss.json）の読み込みと整形。DOM は触らない。
// 形: { name, forms: [ { name, title, color, lines: { appear, attack, hurt, defeat, evolve, heal } } ×3 ],
//        skills: { timed|timer: { name }, curse|double: { name } }, lines: { playerHeal: [..], ending: [..] } } （docs/sources/boss-characters.md の真ボスの JSON と同じ形。形態の formName / formTitle も読む）
// 形態のせりふ: appear 登場／attack 間違えたとき／hurt 正解／heal ボスの回復／skillTimer・skillDouble 技を使うとき／evolve 進化／gloat 負けたとき／defeat 倒されたとき
// ファイルが無い・壊れている・項目が足りないときは、決まった仮の名前とせりふで動く（絵やせりふの差し替えだけで済むように）。
// 絵は <アプリ>/images/bosses/true-1.webp 〜 true-3.webp（形態ごとに全身を1枚。置くだけで記号と入れ替わる）。
import { DEFAULT_COLOR } from './bossdata.js';
import { TRUE_FORMS } from './trueboss.js';

export const TRUE_LINE_KINDS = ['appear', 'attack', 'hurt', 'defeat', 'evolve', 'heal', 'skillTimer', 'skillDouble', 'gloat'];
export const TRUE_BOSS_FILE = 'trueboss.json';

/** 形態ごとの絵で、顔の中心の位置（絵の幅・高さに対する割合）。顔の丸の切り抜き（faceCrop）に使う。絵を差し替えたらここを合わせる。 */
export const TRUE_FACE = Object.freeze({ 1: { x: 0.5, y: 0.19 }, 2: { x: 0.5, y: 0.17 }, 3: { x: 0.5, y: 0.135 } });

// 第1形態の絵（true-1.webp。512×512）の上の位置。数は絵の幅・高さに対する割合（%。0〜100）。実測（絵の水色の部分の重心）: 胸の核 (49.7, 37.5)・一つ目 (49.9, 19.7)。
// 第1形態の殻が割れる演出（ひび）は、絵と同じ正方形の SVG に、この座標で描く。絵を差し替えたら測り直す。
export const TRUE_CORE = Object.freeze({ x: 49.7, y: 37.5 });
export const TRUE_EYE = Object.freeze({ x: 49.9, y: 19.7, rx: 3.6, ry: 2.2 });
// ひびの形（SVG の path。4本。胸の核から体に広がる。1本目・2本目は下へ、3本目・4本目は肩のほうへ）
export const TRUE_CRACKS = Object.freeze([
  'M49.7 37.5 L46 43 L48 48 L42 54 L44 60 L39 66',
  'M49.7 37.5 L54 43 L52 49 L58 55 L56 61 L61 67',
  'M49.7 37.5 L44 34 L40 37 L33 34 L27 38',
  'M49.7 37.5 L55 34 L59 37 L66 34 L72 38',
]);

// 第2形態の絵（true-2.webp。512×512）の頭のうしろの光の玉の輪。位置・半径は絵の幅に対する割合（%）。拡大した絵から、玉の中心を左下から時計まわりに測った（13個ある）。
// 第2→3の進化では、これを1つずつ金色に灯す（章のボス10体の光が集まる、という設定。絵の玉は10個ではなく13個だったので、玉の数はここの長さで決まる）。
export const TRUE_ORBS = Object.freeze([
  { x: 45.3, y: 20.0 }, { x: 43.0, y: 18.7 }, { x: 41.3, y: 15.8 }, { x: 41.3, y: 12.2 }, { x: 43.1, y: 9.0 }, { x: 46.0, y: 6.9 }, { x: 49.8, y: 6.0 },
  { x: 53.6, y: 6.9 }, { x: 56.5, y: 9.0 }, { x: 58.1, y: 12.2 }, { x: 58.2, y: 15.8 }, { x: 56.5, y: 18.7 }, { x: 54.3, y: 20.2 },
].map((o) => Object.freeze({ ...o, r: 1.5 })));

// 進化の時刻（ミリ秒。進化の演出が始まった時を 0 とする）。要件定義書 §3-9『進化のタメと第3形態の最強感』。数はここ1か所。
// 第1→2: 偽の撃破 → 鼓動（だんだん速く）・地鳴り・揺れがだんだん強く → 一つ目がまたたいてから強く光る → ひびが1本ずつゆっくり → 割れる。割れて姿が替わるまで約 9 秒。
export const EVO_1_TO_2 = Object.freeze({
  glowBlink: [350, 620, 890, 1160],
  slump: 1350, defeatText: 1450,
  heartbeats: [3200, 4000, 4700, 5300, 5800, 6200], // 低い鼓動の音（フック heartbeat）。間隔 800・700・600・500・400
  rumble: 4000, // 地鳴り（フック rumble）と「ゴゴゴゴ」
  quakes: [4200, 4900, 5400, 5800, 6150, 6450], // 画面の揺れ。4つ目から強い揺れ
  strongQuakeFrom: 3,
  eyeBlinks: [5000, 5500, 5900], // 消えた一つ目が短くまたたく
  eyeStrong: 6300, // 一つ目が強く光り、灰色が戻りはじめる
  shake: 6600, // 殻が揺れはじめる
  cracks: [6850, 7400, 7950, 8400], // ひび1〜4本目（ゆっくり1本ずつ。フック crack1・crack2）
  shatter: 8900, // 割れる（フック shatter1・shatter2）
  swap: 9150, // 第2形態の姿に替わる
  text: 9450, // 進化のせりふ
});
// 第2→3: 曲が止まり画面が暗くなる → 宙で静止 → 光の玉が1つずつ金色に灯る（だんだん速く。フック orb）→ 力をためる音（フック charge）と揺れがだんだん強く → 金色の光が弾ける（フック impact）→ 第3形態と決めぜりふ → 第3形態の曲
export const EVO_2_TO_3 = Object.freeze({
  dim: 0, still: 0,
  orbStart: 2000,
  orbGaps: [500, 450, 400, 360, 330, 300, 280, 260, 240, 220, 200, 190], // 玉の数（TRUE_ORBS.length）-1 個ぶん。だんだん速く
  charge: 3200,
  quakes: [3800, 4300, 4700, 5050, 5350, 5600, 5800, 6000, 6200, 6400],
  strongQuakeFrom: 4,
  gold: 6700, // 金色の光が弾ける（フック impact）。画面全体が金に光る。四角い面ではなく、画面いっぱいの丸い放射の光
  swap: 7000, // 第3形態の姿に替わる
  text: 7300, // 決めぜりふ
  music: 8200, // 第3形態の曲
});
/** 玉が灯る時刻（EVO_2_TO_3.orbStart から、orbGaps を足していく）。 */
export function orbTimes(evo = EVO_2_TO_3) {
  const out = [evo.orbStart];
  for (const g of evo.orbGaps) out.push(out[out.length - 1] + g);
  return out;
}

/** 形態ごとの絵のファイル名（<アプリ>/images/bosses/ の中）。 */
export function trueBossImageName(form) {
  return 'true-' + form + '.webp';
}

// 仮の名前とせりふ（データが無いとき）。ボスの口から出る短い言葉で、試験の中身は入れない。
export const DEFAULT_TRUE_BOSS = Object.freeze({
  name: '塔の主',
  forms: [
    { name: '塔の主', title: '第1形態', color: '#7b1fa2', lines: { appear: ['ここまで たどりついたか。だが これからが ほんばんだ'], attack: ['まだ まだ これからだ！'], hurt: ['ほう…やるではないか'], defeat: ['キィ…ン…'], evolve: ['わたしを おこらせたな。すがたを かえよう'], heal: ['この くらいの きずは すぐに なおる'], skillTimer: [], skillDouble: [], gloat: ['もういちど、はじめから だ'] } },
    { name: '塔の主・真', title: '第2形態', color: '#c62828', lines: { appear: ['ここからは ほんきで いくぞ'], attack: ['その ていどか！'], hurt: ['なかなか やるな…！'], defeat: ['キィ…ン…'], evolve: ['みせてやろう。わたしの さいごの すがたを'], heal: ['なんどでも たちあがる'], skillTimer: [], skillDouble: [], gloat: ['もういちど、はじめから だ'] } },
    { name: '塔の主・極', title: '第3形態', color: '#ff6f00', lines: { appear: ['これが わたしの ぜんりょくだ'], attack: ['ここまでだ！'], hurt: ['ぐ…ぐぐ…！'], defeat: ['み、みごとだ…！'], evolve: [], heal: ['まだ…たおれぬ…！'], skillTimer: [], skillDouble: [], gloat: ['もういちど、はじめから だ'] } },
  ],
  skills: { timed: { name: 'ときの かせ', line: 'じかんが ない！ いそげ！' }, curse: { name: 'のろいの いたみ', line: 'まちがえれば おおきな きずを おうぞ' } },
  playerHeal: ['……れんぞくで あてて くるか'],
  ending: ['……こうして、塔の いちばん うえの ボスは たおれた。', 'あなたが ここまで たどりついたのは、まちがえた もんだいを ひとつずつ こえてきたからだ。', 'ほんとうに、おめでとう！'],
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);
const str = (v, d) => (typeof v === 'string' && v.trim() ? v.trim() : d);

/** 読んだ JSON を、使える形にする。壊れた・足りない項目は DEFAULT_TRUE_BOSS で埋める（せりふが空の種類も仮のせりふ。ただし進化のせりふは第3形態では空でよい）。 */
export function normalizeTrueBossData(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const rawForms = Array.isArray(r.forms) ? r.forms : [];
  const forms = [];
  for (let i = 0; i < TRUE_FORMS; i++) {
    const d = DEFAULT_TRUE_BOSS.forms[i];
    const f = rawForms[i] && typeof rawForms[i] === 'object' ? rawForms[i] : {};
    const lines = {};
    for (const k of TRUE_LINE_KINDS) {
      const own = strs(f.lines && f.lines[k]);
      lines[k] = own.length ? own : d.lines[k].slice();
    }
    forms.push({
      form: i + 1,
      name: str(f.name, str(r.name, d.name)),
      title: typeof f.title === 'string' ? f.title.trim() : str(f.formName, d.title),
      formTitle: str(f.formTitle, ''),
      color: typeof f.color === 'string' && HEX.test(f.color) ? f.color : d.color || DEFAULT_COLOR,
      lines,
    });
  }
  const sk = r.skills && typeof r.skills === 'object' ? r.skills : {};
  const skills = {};
  for (const [k, alias] of [['timed', 'timer'], ['curse', 'double']]) {
    const o = sk[k] || sk[alias];
    skills[k] = { name: str(o && o.name, DEFAULT_TRUE_BOSS.skills[k].name), line: str(o && o.line, DEFAULT_TRUE_BOSS.skills[k].line) };
  }
  const gl = r.lines && typeof r.lines === 'object' ? r.lines : {};
  const ending = strs(gl.ending).length ? strs(gl.ending) : strs(r.ending);
  const playerHeal = strs(gl.playerHeal);
  return {
    name: str(r.name, forms[0].name),
    forms,
    skills,
    ending: ending.length ? ending : DEFAULT_TRUE_BOSS.ending.slice(),
    playerHeal: playerHeal.length ? playerHeal : DEFAULT_TRUE_BOSS.playerHeal.slice(),
  };
}

/** 形態（1〜3）の姿。範囲外は第1形態。 */
export function trueBossForm(data, form) {
  const d = data && Array.isArray(data.forms) && data.forms.length === TRUE_FORMS ? data : normalizeTrueBossData(null);
  const i = Number.isInteger(form) && form >= 1 && form <= TRUE_FORMS ? form - 1 : 0;
  return d.forms[i];
}

/** せりふを1つ選ぶ。rng は 0 以上 1 未満を返す関数。種類が空なら ''。 */
export function pickTrueLine(profile, kind, rng = Math.random) {
  const list = profile && profile.lines && profile.lines[kind] ? profile.lines[kind] : [];
  if (!list.length) return '';
  let r = Number(rng());
  if (!Number.isFinite(r)) r = 0;
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(r * list.length)))];
}

/** データを読む。失敗（404・壊れた JSON・通信エラー）は仮の名前とせりふ。 */
export async function loadTrueBossData(url, fetchFn = (u) => fetch(u)) {
  try {
    const res = await fetchFn(url);
    if (!res || !res.ok) return normalizeTrueBossData(null);
    try {
      return normalizeTrueBossData(await res.json());
    } catch (e) {
      return normalizeTrueBossData(null);
    }
  } catch (e) {
    return normalizeTrueBossData(null);
  }
}
