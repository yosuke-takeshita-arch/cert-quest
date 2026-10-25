// 場面が変わるときの演出（要件定義書 §6-5、2026-10-25 先生決定 A）。
// 下のメニューを隠す画面（問題・どっち？・模擬試験・ボス戦・真ボス戦）を「場面」とし、ふつうの画面との行き来だけに覆いを出す。
// 覆いは CSS の animation（.scene-veil）。画面の入れ替え（render）は、覆いが画面を隠しきった時点で行う。
// 時間は css/app.css の .scene-veil の animation-duration と同じ値（tests/transition.test.js が突き合わせる）。

export const TIMES = {
  vortex: { in: 450, out: 350 }, // ボス戦・真ボス戦に入る。渦を巻いて暗転（合わせて 0.8 秒）
  wipe: { in: 200, out: 200 }, // 問題・どっち？・模擬試験に入る。暗いパネルが横切る（合わせて 0.4 秒）
  fade: { in: 150, out: 300 }, // 場面からふつうの画面に戻る。暗転から明ける（合わせて 0.45 秒）
};

const BOSS_NAMES = ['boss', 'trueboss'];

// prev / next は { name, full }（full … ROUTES の4つ目が true ＝下のメニューを隠す画面）。戻り値は 'vortex' | 'wipe' | 'fade' | null
export function sceneKind(prev, next) {
  if (!prev || !next) return null;
  if (!!prev.full === !!next.full) return null; // ふつう→ふつう、場面→場面には何も付けない（勉強のテンポを落とさない・場面の中の遷移は場面のまま）
  if (prev.full) return 'fade';
  return BOSS_NAMES.includes(next.name) ? 'vortex' : 'wipe';
}

// 覆いの制御。doc … document、win … window（matchMedia と setTimeout を使う）。
// go(kind, swap) … 演出つきで swap（画面の入れ替え）を呼ぶ。演出を出さないとき（kind なし・動きを減らす設定・覆いを作れない）は即 swap。
// covering … 覆いが画面を隠している最中（この間に来た画面の変更は、最後の swap が location.hash を読み直すので、足さなくてよい）
export function createTransitioner(doc, win) {
  let veil = null;
  let timer = null;
  let covering = false;

  function clearVeil() {
    if (timer !== null) { win.clearTimeout(timer); timer = null; }
    covering = false;
    if (veil) { if (veil.parentNode) veil.parentNode.removeChild(veil); veil = null; }
  }

  function reduced() {
    try { return !win.matchMedia || win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; }
  }

  function go(kind, swap) {
    clearVeil(); // 明けている最中に次の変更が来たら、残さず片付けてから
    const t = kind ? TIMES[kind] : null;
    if (!t || reduced() || !doc || !doc.body) { swap(); return; }
    veil = doc.createElement('div');
    veil.className = 'scene-veil scene-' + kind + ' in';
    veil.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(veil);
    covering = true;
    const mine = veil;
    timer = win.setTimeout(() => {
      covering = false;
      timer = null;
      try { swap(); } finally {
        // swap の最中に別の go が来ていたら、その覆いが veil（mine ではない）
        if (veil === mine) {
          mine.className = 'scene-veil scene-' + kind + ' out';
          timer = win.setTimeout(() => { timer = null; clearVeil(); }, t.out);
        }
      }
    }, t.in);
  }

  return { go, clear: clearVeil, get covering() { return covering; } };
}
