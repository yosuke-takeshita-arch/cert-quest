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

/** 形態ごとの絵のファイル名（<アプリ>/images/bosses/ の中）。 */
export function trueBossImageName(form) {
  return 'true-' + form + '.webp';
}

// 仮の名前とせりふ（データが無いとき）。ボスの口から出る短い言葉で、試験の中身は入れない。
export const DEFAULT_TRUE_BOSS = Object.freeze({
  name: '塔の主',
  forms: [
    { name: '塔の主', title: '第1形態', color: '#7b1fa2', lines: { appear: ['ここまで たどりついたか。だが これからが ほんばんだ'], attack: ['まだ まだ これからだ！'], hurt: ['ほう…やるではないか'], defeat: ['ぐ…これで おわりと おもうな'], evolve: ['わたしを おこらせたな。すがたを かえよう'], heal: ['この くらいの きずは すぐに なおる'], skillTimer: [], skillDouble: [], gloat: ['もういちど、はじめから だ'] } },
    { name: '塔の主・真', title: '第2形態', color: '#c62828', lines: { appear: ['ここからは ほんきで いくぞ'], attack: ['その ていどか！'], hurt: ['なかなか やるな…！'], defeat: ['まだだ…まだ おわらぬ'], evolve: ['みせてやろう。わたしの さいごの すがたを'], heal: ['なんどでも たちあがる'], skillTimer: [], skillDouble: [], gloat: ['もういちど、はじめから だ'] } },
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
