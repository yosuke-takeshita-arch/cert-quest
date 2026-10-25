// 場面が変わるときの演出（要件定義書 §6-5、2026-10-25 先生決定 A）。
// 下のメニューを隠す画面（問題・どっち？・模擬試験・ボス戦・真ボス戦）を「場面」とし、ふつうの画面との行き来だけに覆いを出す。
// 覆いは CSS の animation（.scene-veil）。画面の入れ替え（render）は、覆いが画面を隠しきった時点で行う。
// 時間は css/app.css の .scene-veil の animation-duration と同じ値（tests/transition.test.js が突き合わせる）。

export const TIMES = {
  vortex: { in: 700, out: 300 }, // ボス戦・真ボス戦に入る。四角いドットが渦巻きの順に埋まる（合わせて 1 秒）
  wipe: { in: 380, out: 280 }, // 問題・どっち？・模擬試験に入る。四角いドットが左上から右下へ斜めの帯になって埋まる（合わせて 0.66 秒）
  fade: { in: 150, out: 300 }, // 場面からふつうの画面に戻る。暗転から明ける（合わせて 0.45 秒）
  zoom: { in: 420, out: 280 }, // 地図の章を押して章の画面に入る。押した位置から四角いドットが円形に広がって埋まり、同じ位置から穴が開くように明ける（合わせて 0.7 秒）
  zoomback: { in: 200, out: 220 }, // 章の画面から地図に戻る。ドットが外側から押した位置へ縮むように埋まり、同じ位置へ縮んで明ける（合わせて 0.42 秒）
};

const BOSS_NAMES = ['boss', 'trueboss'];
const DOT_KINDS = ['vortex', 'wipe', 'zoom', 'zoomback'];

// prev / next は { name, full }（full … ROUTES の4つ目が true ＝下のメニューを隠す画面）。戻り値は 'vortex' | 'wipe' | 'fade' | 'zoom' | 'zoomback' | null
// viaTab … 下のタブを押した変更（章の画面で「地図」のタブを押した場合は、タブの弾む動きのままにして、地図 ⇄ 章の演出は付けない）
export function sceneKind(prev, next, viaTab) {
  if (!prev || !next) return null;
  if (!prev.full && !next.full) { // ふつう→ふつうは付けない（勉強のテンポを落とさない）。ただし地図と章の画面の行き来だけ、小さな演出を付ける
    if (viaTab) return null;
    if (prev.name === 'map' && next.name === 'stage') return 'zoom';
    if (prev.name === 'stage' && next.name === 'map') return 'zoomback';
    return null;
  }
  if (!!prev.full === !!next.full) return null; // 場面→場面には何も付けない（場面の中の遷移は場面のまま）
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

// cols × rows の格子を、左上の角から右下の角へ、斜めの帯（x+y が同じ列）ごとに並べる（問題・どっち？・模擬試験）。帯の中は左から。全マスを1回ずつ
export function diagonalOrder(cols, rows) {
  const out = [];
  for (let d = 0; d <= cols + rows - 2; d++) {
    for (let x = Math.max(0, d - (rows - 1)); x <= Math.min(cols - 1, d); x++) out.push([x, d - x]);
  }
  return out;
}

// cols × rows の格子を、(cx, cy)（画面上の px）に近いマスから遠いマスへ並べる（地図→章の円形）。距離が同じなら上、次に左から。全マスを1回ずつ
export function circleOrder(cols, rows, size, cx, cy) {
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = (x + 0.5) * size - cx;
      const dy = (y + 0.5) * size - cy;
      cells.push([x, y, dx * dx + dy * dy]);
    }
  }
  cells.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  return cells.map((c) => [c[0], c[1]]);
}

// 地図の章を押した位置（画面上の px）の受け渡し。views/home.js が押した瞬間に置き、hashchange 後に go が受け取る。
// 置いてから ORIGIN_TTL_MS を過ぎたものは使わない（押しても画面が変わらなかったときの古い位置を、次の転換に持ち越さない）。
// 位置が取れない押し方（キーボードで開いた等）は null を置き、画面の中心から出す
export const ORIGIN_TTL_MS = 1500;
let pendingOrigin = null; // 次の 地図→章 に使う位置 { x, y, at }
let lastOrigin = null; // 最後に入った章の位置。章→地図 の戻りで、そこへ縮ませる

export function setTransitionOrigin(x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) {
    pendingOrigin = { x, y, at: Date.now() };
  } else {
    pendingOrigin = null;
  }
}

// kind に使う位置 { x, y } を返す（無ければ null）。zoom は受け取ったら使い切り（最後の位置としても覚える）、zoomback は覚えている位置
export function takeTransitionOrigin(kind) {
  if (kind === 'zoom') {
    const o = pendingOrigin && Date.now() - pendingOrigin.at <= ORIGIN_TTL_MS ? pendingOrigin : null;
    pendingOrigin = null;
    lastOrigin = o ? { x: o.x, y: o.y } : null;
    return lastOrigin;
  }
  if (kind === 'zoomback') return lastOrigin;
  return null;
}

// 斜めの帯の先頭（いちばん進んでいる帯）だけ少し明るくする色
const DOT_COLOR = '#000';
const DOT_HEAD_COLOR = '#2b3568';

// 埋まっているドットの数。phase 'in' … 0→n（t=0..inMs）、'out' … n→0（t=0..outMs。中心から先に消える＝渦が解ける）
export function dotsFilled(phase, t, n, t_in, t_out) {
  if (phase === 'in') return Math.max(0, Math.min(n, Math.ceil((t / t_in) * n)));
  return Math.max(0, Math.min(n, Math.ceil((1 - t / t_out) * n)));
}

// veil の中に canvas を作ってドットを描く。作れなければ null（呼び出し側は覆いを暗転に切り替える）。style 属性は使わない（CSP）
function createDots(doc, win, veil, kind, origin) {
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
    const diagonal = kind === 'wipe';
    const zoom = kind === 'zoom' || kind === 'zoomback';
    let order;
    if (diagonal) order = diagonalOrder(cols, rows);
    else if (zoom) {
      const ox = Math.max(0, Math.min(W, origin && Number.isFinite(origin.x) ? origin.x : W / 2));
      const oy = Math.max(0, Math.min(H, origin && Number.isFinite(origin.y) ? origin.y : H / 2));
      order = circleOrder(cols, rows, size, ox, oy);
    } else order = spiralOrder(cols, rows);
    const n = order.length;
    const T = TIMES[kind];
    const band = cols; // 先頭の帯（明るい色）の数
    const now = () => (win.performance && win.performance.now ? win.performance.now() : Date.now());
    let phase = 'in';
    let t0 = now();
    let stopped = false;
    let drawn = -1;
    function draw(count) {
      if (count === drawn) return;
      ctx.clearRect(0, 0, W, H);
      if (zoom) {
        // 円形: order は押した位置に近い順。zoom は近いところから広がり、近いところから穴が開く。zoomback は遠いところから縮み、遠いところから消える（位置へ縮む）
        const nearFirst = (kind === 'zoom') === (phase === 'in');
        const from = nearFirst ? 0 : n - count;
        const to = nearFirst ? count : n;
        ctx.fillStyle = DOT_COLOR;
        for (let i = from; i < to; i++) ctx.fillRect(order[i][0] * size, order[i][1] * size, size, size);
      } else if (!diagonal) {
        ctx.fillStyle = DOT_COLOR;
        for (let i = 0; i < count; i++) ctx.fillRect(order[i][0] * size, order[i][1] * size, size, size);
      } else {
        // 斜め: 隠す間は先頭から count 個（先頭の帯は右下側の端）、明ける間は同じ向きに左上から消える＝残りは末尾の count 個（先頭の帯は左上側の端）
        const from = phase === 'in' ? 0 : n - count;
        const to = phase === 'in' ? count : n;
        const head = phase === 'in' ? (i) => i >= to - band : (i) => i < from + band;
        ctx.fillStyle = DOT_COLOR;
        for (let i = from; i < to; i++) if (!head(i)) ctx.fillRect(order[i][0] * size, order[i][1] * size, size, size);
        ctx.fillStyle = DOT_HEAD_COLOR;
        for (let i = from; i < to; i++) if (head(i) && count < n) ctx.fillRect(order[i][0] * size, order[i][1] * size, size, size);
        if (count >= n) { ctx.fillStyle = DOT_COLOR; for (let i = from; i < to; i++) if (head(i)) ctx.fillRect(order[i][0] * size, order[i][1] * size, size, size); }
      }
      drawn = count;
    }
    function frame() {
      if (stopped) return;
      draw(dotsFilled(phase, now() - t0, n, T.in, T.out));
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
    const origin = takeTransitionOrigin(kind); // 地図→章の押した位置。演出を出さない場合でも使い切る（古い位置を持ち越さない）
    clearVeil(); // 明けている最中に次の変更が来たら、残さず片付けてから
    if (kind && TIMES[kind] && (reduced() || !doc || !doc.body)) { swap(); return; }
    if (!kind || !TIMES[kind]) { swap(); return; }
    veil = doc.createElement('div');
    veil.className = 'scene-veil scene-' + kind + ' in';
    veil.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(veil);
    if (DOT_KINDS.includes(kind)) {
      dots = createDots(doc, win, veil, kind, origin);
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
