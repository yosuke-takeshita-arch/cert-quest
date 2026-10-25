// 場面が変わるときの演出（要件定義書 §6-5、2026-10-25 先生決定 A）。
// 下のメニューを隠す画面（問題・どっち？・模擬試験・ボス戦・真ボス戦）を「場面」とし、ふつうの画面との行き来だけに覆いを出す。
// 覆いは CSS の animation（.scene-veil）。画面の入れ替え（render）は、覆いが画面を隠しきった時点で行う。
// 時間は css/app.css の .scene-veil の animation-duration と同じ値（tests/transition.test.js が突き合わせる）。

export const TIMES = {
  vortex: { in: 700, out: 300 }, // ボス戦・真ボス戦に入る。四角いドットが渦巻きの順に埋まる（合わせて 1 秒）
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

// ドットの渦（ボス戦）。画面の幅を DOT_COLS 個に割った四角いドットが、外側から内側へ時計回りの渦巻きの順に黒く埋まる。
export const DOT_COLS = 14;

// cols × rows の格子を、外周から内側へ時計回りに巡る順に並べる。戻り値は [x, y] の配列（全マスを1回ずつ）
export function spiralOrder(cols, rows) {
  const out = [];
  let top = 0, left = 0, bottom = rows - 1, right = cols - 1;
  while (top <= bottom && left <= right) {
    for (let x = left; x <= right; x++) out.push([x, top]);
    for (let y = top + 1; y <= bottom; y++) out.push([right, y]);
    if (top < bottom) for (let x = right - 1; x >= left; x--) out.push([x, bottom]);
    if (left < right) for (let y = bottom - 1; y > top; y--) out.push([left, y]);
    top++; left++; bottom--; right--;
  }
  return out;
}

// 埋まっているドットの数。phase 'in' … 0→n（t=0..inMs）、'out' … n→0（t=0..outMs。中心から先に消える＝渦が解ける）
export function dotsFilled(phase, t, n, t_in, t_out) {
  if (phase === 'in') return Math.max(0, Math.min(n, Math.ceil((t / t_in) * n)));
  return Math.max(0, Math.min(n, Math.ceil((1 - t / t_out) * n)));
}

// veil の中に canvas を作ってドットを描く。作れなければ null（呼び出し側は覆いを暗転に切り替える）。style 属性は使わない（CSP）
function createDots(doc, win, veil) {
  try {
    if (!veil.appendChild || !doc.createElement) return null;
    const canvas = doc.createElement('canvas');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    const raf = win.requestAnimationFrame && win.requestAnimationFrame.bind(win);
    if (!ctx || !raf) return null;
    const W = Math.max(1, win.innerWidth || 360);
    const H = Math.max(1, win.innerHeight || 640);
    const size = Math.ceil(W / DOT_COLS);
    const cols = Math.ceil(W / size);
    const rows = Math.ceil(H / size);
    canvas.width = W;
    canvas.height = H;
    canvas.className = 'scene-dots';
    veil.appendChild(canvas);
    const order = spiralOrder(cols, rows);
    const n = order.length;
    const now = () => (win.performance && win.performance.now ? win.performance.now() : Date.now());
    let phase = 'in';
    let t0 = now();
    let stopped = false;
    let drawn = -1;
    function draw(count) {
      if (count === drawn) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      for (let i = 0; i < count; i++) ctx.fillRect(order[i][0] * size, order[i][1] * size, size, size);
      drawn = count;
    }
    function frame() {
      if (stopped) return;
      draw(dotsFilled(phase, now() - t0, n, TIMES.vortex.in, TIMES.vortex.out));
      raf(frame);
    }
    raf(frame);
    return {
      cover() { draw(n); }, // 入れ替えの直前に、ドットを全部埋める（描画が遅れていても、隠してから入れ替える）
      open() { phase = 'out'; t0 = now(); draw(n); },
      stop() { stopped = true; },
    };
  } catch (e) { return null; }
}

// 下のタブを押したときの、画面の中身の浮かび上がり（要件定義書 §6-5、先生決定 B）。覆いは使わない。
// 描いた直後に main へ class を付け、中の主なかたまり（画面1枚の直下の要素。main の直下が複数ならそれ）を上から順に .rise-1〜.rise-8 で 40ms ずつ遅らせ、
// 1つずつ下からばね（行き過ぎて戻る）で弾ませる。9つ目以降は .rise-9 でまとめて 8つ目と同時。終わったら class を外す。
// 動きの中身（距離・ばね）は css/app.css の .main.tab-rise。遅れは class で与える（CSP でインラインの style は使えない）。
export const TAB_RISE_MS = 300; // 1つ分の動きの長さ（CSS の animation と同じ）
export const TAB_RISE_STEP_MS = 40; // かたまり同士のずらし
export const TAB_RISE_STAGGER = 8; // ずらすのは最初のこの数まで
export const TAB_RISE_TOTAL_MS = TAB_RISE_STEP_MS * (TAB_RISE_STAGGER - 1) + TAB_RISE_MS; // 全体が出きるまで（580ms）

// タブを押した直後の画面の変更か（pressed … 押したか）、ふつうの画面どうしか（場面との行き来には付けない）
export function wantsTabRise(pressed, prev, next) {
  return !!pressed && !!next && !next.full && !(prev && prev.full);
}

// 付けた class を全部外す（連打・描き直しでも残さない）
function clearRise(el) {
  if (el._tabRiseTimer && el._tabRiseWin) el._tabRiseWin.clearTimeout(el._tabRiseTimer);
  el._tabRiseTimer = null;
  (el._riseKids || []).forEach(([k, c]) => k.classList.remove(c));
  el._riseKids = [];
  el.classList.remove('tab-rise');
}

// el … main。動きを減らす設定・matchMedia が使えないときは何もしない（戻り値 false）。連打でも class は付け直し（動きが最初からやり直し）
export function tabRise(el, win) {
  try {
    if (!el || !el.classList) return false;
    if (!win.matchMedia || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    el._tabRiseWin = win;
    clearRise(el);
    void el.offsetWidth; // 付け直しで animation を最初からにする
    let kids = el.children ? Array.prototype.slice.call(el.children) : [];
    if (kids.length === 1 && kids[0].children) kids = Array.prototype.slice.call(kids[0].children); // main の中は画面1枚（.view）。そのかたまりを順に出す
    kids.forEach((k, i) => {
      if (!k.classList) return;
      const c = 'rise-' + Math.min(i + 1, TAB_RISE_STAGGER + 1);
      k.classList.add(c);
      el._riseKids.push([k, c]);
    });
    el.classList.add('tab-rise');
    el._tabRiseTimer = win.setTimeout(() => { el._tabRiseTimer = null; clearRise(el); }, TAB_RISE_TOTAL_MS + 50);
    return true;
  } catch (e) { return false; }
}

// 覆いの制御。doc … document、win … window（matchMedia と setTimeout を使う）。
// go(kind, swap) … 演出つきで swap（画面の入れ替え）を呼ぶ。演出を出さないとき（kind なし・動きを減らす設定・覆いを作れない）は即 swap。
// covering … 覆いが画面を隠している最中（この間に来た画面の変更は、最後の swap が location.hash を読み直すので、足さなくてよい）
export function createTransitioner(doc, win) {
  let veil = null;
  let timer = null;
  let covering = false;
  let dots = null;

  function clearVeil() {
    if (timer !== null) { win.clearTimeout(timer); timer = null; }
    covering = false;
    if (dots) { dots.stop(); dots = null; }
    if (veil) { if (veil.parentNode) veil.parentNode.removeChild(veil); veil = null; }
  }

  function reduced() {
    try { return !win.matchMedia || win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; }
  }

  function go(kind, swap) {
    clearVeil(); // 明けている最中に次の変更が来たら、残さず片付けてから
    if (kind && TIMES[kind] && (reduced() || !doc || !doc.body)) { swap(); return; }
    if (!kind || !TIMES[kind]) { swap(); return; }
    veil = doc.createElement('div');
    veil.className = 'scene-veil scene-' + kind + ' in';
    veil.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(veil);
    if (kind === 'vortex') {
      dots = createDots(doc, win, veil);
      if (!dots) { kind = 'fade'; veil.className = 'scene-veil scene-fade in'; } // canvas が使えない端末は、ふつうの暗転に
    }
    const t = TIMES[kind];
    covering = true;
    const mine = veil;
    timer = win.setTimeout(() => {
      covering = false;
      timer = null;
      if (dots) dots.cover();
      try { swap(); } finally {
        // swap の最中に別の go が来ていたら、その覆いが veil（mine ではない）
        if (veil === mine) {
          if (dots) dots.open();
          mine.className = 'scene-veil scene-' + kind + ' out';
          timer = win.setTimeout(() => { timer = null; clearVeil(); }, t.out);
        }
      }
    }, t.in);
  }

  return { go, clear: clearVeil, get covering() { return covering; } };
}
