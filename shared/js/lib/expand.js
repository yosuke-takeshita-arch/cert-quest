// グループ（<details>）の開け閉めの動き（要件定義書 §6-6、2026-10-25 先生の要望）。
// 開くとき: 高さが伸び、少し行き過ぎて戻る（ばね）。閉じるとき: すっと縮んで閉じる。
// 作り方: document に click の見張りを1つだけ足し、全部の details にまとめて効かせる（画面ごとには書かない）。
//   details 自身の高さを Web Animations API（element.animate。iPhone の Safari 13.1 以上で使える）で動かす。
//   ::details-content や interpolate-size は Safari で使えないので使わない。高さは keyframes だけで動かすので、
//   終わると何も残らない（要素に高さの指定を書かない。中身が増えても切れない）。CSP（style-src 'self'）にも触れない。
// 動きを減らす設定（prefers-reduced-motion）・animate が無い環境では見張りが何もせず、ブラウザ本来のパッと開け閉めになる。

export const EXPAND_MS = { open: 440, close: 280 };
const OPEN_EASE = 'cubic-bezier(0.25, 0.8, 0.35, 1)'; // 伸びる前半（勢いよく）
const SETTLE_EASE = 'ease-in-out'; // 行き過ぎから戻る後半
const CLOSE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const PEAK_AT = 0.55; // 行き過ぎの頂点の時刻（全体の 0.55）

// 行き過ぎの量（px）。伸びる量の 5%、ただし 6〜16px（背の高い章でも空白が大きくならない）
export function overshoot(from, to) {
  const d = to - from;
  if (!(d > 0)) return 0;
  return Math.min(16, Math.max(6, d * 0.05));
}

export function openFrames(from, to) {
  const over = overshoot(from, to);
  return [
    { height: from + 'px', offset: 0, easing: OPEN_EASE },
    { height: to + over + 'px', offset: PEAK_AT, easing: SETTLE_EASE },
    { height: to + 'px', offset: 1 },
  ];
}

export function closeFrames(from, to) {
  return [
    { height: from + 'px', offset: 0, easing: CLOSE_EASE },
    { height: to + 'px', offset: 1 },
  ];
}

function prefersReduced(win) {
  try { return !win || !win.matchMedia || win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; }
}

// ボタンで開け閉めする折りたたみ（button の aria-expanded ＋ 中身 panel の hidden）。details と同じ動きを panel の高さに付ける。
// 開け閉めの結果は今までどおり: aria-expanded が開閉を表し、閉じ切ったあとの panel は hidden。戻り値は「いま開く向きか」。
// onOpen … 開くとき、高さを測る前に呼ぶ（中身をここで作る。測ったあとに足すと、動きの終わりで中身が切れる／跳ねる）。
// 動きを減らす設定・animate が無い環境では、動かさずに即座に切り換える。panel の上下の余白（padding）も 0 から動かす（高さ 0 でも余白が見えないように）。
const panelRunning = new WeakMap(); // panel → { anim, wantOpen }
export function toggleExpand(btn, panel, onOpen, win) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  const cur = panelRunning.get(panel);
  const wantOpen = !(cur ? cur.wantOpen : btn.getAttribute('aria-expanded') === 'true');
  btn.setAttribute('aria-expanded', wantOpen ? 'true' : 'false');
  const settle = () => {
    panel.hidden = !wantOpen;
    panel.classList.remove('is-expanding');
  };
  if (typeof panel.animate !== 'function' || prefersReduced(w)) {
    if (cur) { cur.anim.onfinish = null; cur.anim.cancel(); panelRunning.delete(panel); }
    settle();
    if (wantOpen && onOpen) onOpen();
    return wantOpen;
  }
  const from = panel.hidden ? 0 : panel.getBoundingClientRect().height; // 動いている最中なら、いま見えている高さから
  if (cur) { cur.anim.onfinish = null; cur.anim.cancel(); panelRunning.delete(panel); }
  let pad = { top: 0, bottom: 0 };
  panel.hidden = false;
  if (wantOpen && onOpen) onOpen();
  try {
    const cs = w && w.getComputedStyle ? w.getComputedStyle(panel) : null;
    if (cs) pad = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  } catch (e) { /* 余白を読めなければ 0 のまま */ }
  const to = wantOpen ? panel.getBoundingClientRect().height : 0;
  if (!(Math.abs(to - from) >= 1)) { settle(); return wantOpen; }
  panel.classList.add('is-expanding');
  const frames = wantOpen ? openFrames(from, to) : closeFrames(from, to);
  const padAt = (open) => ({ paddingTop: (open ? pad.top : 0) + 'px', paddingBottom: (open ? pad.bottom : 0) + 'px' });
  // 閉じた高さ 0 のときだけ余白も 0 にそろえる（途中の高さから始まるときは余白はそのまま）
  frames.forEach((f, i) => {
    const atZero = wantOpen ? (i === 0 && from === 0) : (i === frames.length - 1);
    Object.assign(f, padAt(!atZero));
  });
  let anim;
  try {
    anim = panel.animate(frames, { duration: wantOpen ? EXPAND_MS.open : EXPAND_MS.close, fill: 'forwards' });
  } catch (e) { settle(); return wantOpen; }
  panelRunning.set(panel, { anim, wantOpen });
  anim.onfinish = () => {
    const r = panelRunning.get(panel);
    if (!r || r.anim !== anim) return;
    panelRunning.delete(panel);
    settle();
    anim.cancel(); // 動きの指定を外す（高さが残らない）
  };
  return wantOpen;
}

// doc … document、win … window。見張りを足して、外すための関数を返す（animate が無い環境では何もせず null）
export function installExpand(doc, win) {
  if (!doc || !doc.addEventListener) return null;
  const running = new WeakMap(); // details → { anim, wantOpen }

  function reduced() { return prefersReduced(win); }

  function settle(det, wantOpen) {
    det.open = wantOpen;
    det.classList.remove('is-expanding', 'is-closing');
  }

  function toggle(det) {
    const cur = running.get(det);
    const from = det.getBoundingClientRect().height; // 動いている最中なら、いま見えている高さ（そこから逆向きに戻る）
    const wantOpen = cur ? !cur.wantOpen : !det.open;
    if (cur) { cur.anim.onfinish = null; cur.anim.cancel(); running.delete(det); }
    let to;
    if (wantOpen) {
      if (!det.open) det.open = true;
      to = det.getBoundingClientRect().height; // 中身の本来の高さ
    } else {
      det.open = false;
      to = det.getBoundingClientRect().height; // 閉じたときの高さ（見出しだけ）
      det.open = true; // 縮み終わるまでは開いたままにして、中身を見せる
    }
    if (!(Math.abs(to - from) >= 1)) { settle(det, wantOpen); return; }
    det.classList.add('is-expanding'); // 動いている間だけ、はみ出しを隠す
    det.classList.toggle('is-closing', !wantOpen); // 閉じる動きの最初から矢印を戻す
    let anim;
    try {
      anim = det.animate(wantOpen ? openFrames(from, to) : closeFrames(from, to), { duration: wantOpen ? EXPAND_MS.open : EXPAND_MS.close, fill: 'forwards' });
    } catch (e) { settle(det, wantOpen); return; }
    running.set(det, { anim, wantOpen });
    anim.onfinish = () => {
      const r = running.get(det);
      if (!r || r.anim !== anim) return;
      running.delete(det);
      settle(det, wantOpen);
      anim.cancel(); // 動きの指定を外す（高さが残らない）
    };
  }

  function onClick(e) {
    const t = e.target;
    if (e.defaultPrevented || !t || !t.closest) return;
    const sum = t.closest('summary');
    if (!sum) return;
    const det = sum.parentNode;
    if (!det || String(det.localName || det.tagName).toLowerCase() !== 'details') return;
    const inner = t.closest('a, button, input, select, textarea, label');
    if (inner && inner !== sum && sum.contains(inner)) return; // 見出しの中のボタンなどは、そのボタンの動きを優先
    if (typeof det.animate !== 'function' || reduced()) return; // ブラウザ本来の開け閉め
    e.preventDefault();
    toggle(det);
  }

  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}
