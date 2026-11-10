// 画面が見えている間だけ進む時計。時間制限のある場面（秒数チャレンジ・どっち？早押し・真ボスの時間制限の技・模擬試験）が、同じこの時計を読む。
// 2026-11-10 の決定: アプリを裏に回している間・画面を消している間は、時計を止める。戻ったら、残りの時間の続きから。
//   それまでは Date.now() の差で数えていたので、裏に回して戻ると、その間も時間が減り、戻ったとたんに時間切れ（不正解）になっていた。
// 残り時間の表示・時間切れの判定・「制限時間の中で正解すると経験値が増える」の判定は、どれも同じ時計（visibleNow）から作る。
// 上の半分（createPauseClock）は純粋。時刻（ミリ秒）は呼び出し側が渡すので、テストで時間を進められる。

/** 画面の出来事が届かないまま止まっていた（端末が眠った等）ときに備えて、時計を確かめ直す間隔。 */
export const HEARTBEAT_MS = 1000;
/** 前に時計を読んでからこれより長く空いていたら、その間は止まっていたものとして数えない（出来事が届かずに止められたときの守り）。 */
export const MAX_GAP_MS = 5000;

/**
 * 止められる時計を作る。now() は「動いていた時間の合計（ミリ秒）」を返す。
 * pause() から resume() までの間は進まない。何回くり返してもよい。
 * maxGap … 前に読んだときからこれより長く空いた分は足さない（Infinity なら守りなし）。
 */
export function createPauseClock({ now = () => Date.now(), running = true, maxGap = Infinity } = {}) {
  let at = now(); // 前に時刻を読んだとき
  let total = 0; // 動いていた時間の合計
  let on = !!running;
  function sync() {
    const t = now();
    const gap = t - at;
    at = t;
    if (on && gap > 0 && gap <= maxGap) total += gap; // 端末の時計が戻った（gap < 0）ときも足さない
  }
  return {
    now() {
      sync();
      return total;
    },
    pause() {
      sync();
      on = false;
    },
    resume() {
      sync();
      on = true;
    },
    get running() {
      return on;
    },
  };
}

/**
 * 時計を、画面の出来事につなぐ。裏に回った（visibilitychange の hidden・pagehide・freeze）ら止め、戻ったら動かす。
 * 出来事が届かないこともあるので、HEARTBEAT_MS ごとに画面の状態と合わせ直す。戻り値は、つなぎを外す関数。
 */
export function installPauseClock(clock, { doc = document, win = window } = {}) {
  const hidden = () => doc.visibilityState === 'hidden';
  const match = () => {
    if (hidden()) clock.pause();
    else clock.resume();
  };
  const onHide = () => clock.pause();
  const onBeat = () => {
    if (hidden() === clock.running) match(); // 出来事を取りこぼしていたら合わせる
    else clock.now(); // 読んでおく（長く止まっていた分を、次に読んだ人がまとめて足さないように）
  };
  doc.addEventListener('visibilitychange', match);
  win.addEventListener('pagehide', onHide);
  win.addEventListener('pageshow', match);
  doc.addEventListener('freeze', onHide);
  doc.addEventListener('resume', match);
  const timer = win.setInterval(onBeat, HEARTBEAT_MS);
  return function stop() {
    doc.removeEventListener('visibilitychange', match);
    win.removeEventListener('pagehide', onHide);
    win.removeEventListener('pageshow', match);
    doc.removeEventListener('freeze', onHide);
    doc.removeEventListener('resume', match);
    win.clearInterval(timer);
  };
}

let shared = null;

/**
 * アプリで1つの「見えている間だけ進む時計」の、いまの値（ミリ秒）。
 * 問題を出したときの値を取っておき、あとで読んだ値との差を「その問題に使った時間」にする（Date.now() の代わり）。
 * 日付や時刻ではない（0 から始まる）ので、記録の日時には使わない。
 */
export function visibleNow() {
  if (!shared) {
    const hasDoc = typeof document !== 'undefined' && typeof window !== 'undefined';
    shared = createPauseClock({ running: !hasDoc || document.visibilityState !== 'hidden', maxGap: MAX_GAP_MS });
    if (hasDoc) installPauseClock(shared);
  }
  return shared.now();
}
