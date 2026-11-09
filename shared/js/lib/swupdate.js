// タイトル画面で、新しい版の保存が終わるまで待つ（決まりは docs/01_要件定義/要件定義書.md の 3-2-c「見直し」）。
// 2026-11-09 先生「問題のダウンロードもそこに含めて、全部終わってからタップできるようにしたらいいんじゃないの？」
//
// 開いた時点で service worker が動いていた（controller があった）ときだけ待つ。初めて入れたときは待たない（データはネットから取る）。
// 電波が無い・遅いときに止まり続けないよう、確かめ（update）と受け取り（入れ替わり）にそれぞれ時間の上限を置く。

export const CHECK_TIMEOUT_MS = 5000;
export const INSTALL_TIMEOUT_MS = 45000;
export const SW_UPDATING_TEXT = '新しい版を受け取り中…';

const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));

/**
 * 新しい版があれば、入れ替わるまで待つ。
 * sw は navigator.serviceWorker（テストでは偽物）。onUpdating() は新しい版が見つかったときに1回呼ぶ（画面に「受け取り中」を出す）。
 * 返り値 { state }: 'first'（初めて。待たない）／'none'（新しい版なし）／'updated'（入れ替わった）／'timeout'（打ち切った）／'error'（確かめられない＝電波が無いなど）
 */
export async function waitForSwUpdate(sw, { url = './sw.js', onUpdating = () => {}, checkMs = CHECK_TIMEOUT_MS, installMs = INSTALL_TIMEOUT_MS } = {}) {
  if (!sw) return { state: 'none' };
  const hadController = Boolean(sw.controller);
  let reg;
  try {
    reg = await sw.register(url);
  } catch (e) {
    return { state: 'error' };
  }
  if (!hadController) return { state: 'first' };
  // 入れ替わりを、確かめる前から見張る（確かめている間に入れ替わることがある）
  let changed = false;
  const swapped = new Promise((resolve) => sw.addEventListener('controllerchange', () => { changed = true; resolve('updated'); }, { once: true }));
  if (!reg.installing && !reg.waiting) {
    try {
      const r = await Promise.race([Promise.resolve(reg.update()).then(() => 'ok'), timeout(checkMs)]);
      if (r === 'timeout' && !reg.installing && !reg.waiting && !changed) return { state: 'timeout' };
    } catch (e) {
      if (!reg.installing && !reg.waiting && !changed) return { state: 'error' };
    }
  }
  if (changed) return { state: 'updated' };
  if (!reg.installing && !reg.waiting) return { state: 'none' };
  onUpdating();
  // 待っている版（waiting）は skipWaiting で自分から入れ替わる作り（sw-core.js）なので、入れ替わりだけを待つ
  const r = await Promise.race([swapped, timeout(installMs)]);
  return { state: r === 'updated' ? 'updated' : 'timeout' };
}

/** 問題とカードのデータの指紋（読み直したデータと、開いたときに読んだデータを比べる。3-2-c「帯は、問題が本当に変わったときだけ」） */
export function dataFingerprint(data) {
  if (!data) return '';
  const s = JSON.stringify([data.questions || [], data.concepts || []]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return s.length + ':' + (h >>> 0).toString(16);
}
