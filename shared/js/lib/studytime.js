// 総学習時間（要件定義書 §6-1）。DOM・localStorage・時計には触らない。時刻（ミリ秒）は呼び出し側が渡す。
//
// 数え方: アプリの画面が前に出ている間。最後の操作から IDLE_LIMIT_MS（2分）までは数え、それより先は、操作が戻るまで数えない。
// 画面が裏に回ったら（hidden）止め、前に戻ったら（visible）再開する。
// 呼び出し側（app.js）は、操作のたびに 'input'、数秒おきに 'tick'、visibilitychange で 'hidden' / 'visible' を advance に渡す。
// 隣り合う2回の時刻が MAX_GAP_MS より離れていたら（スリープ明けなど、止まっていたかもしれない）、その間は数えない。
// 時計が戻った（負の差）ときも数えない。

/** 無操作がここまで続いたら数えるのを止める（ミリ秒）。最後の操作からちょうどこの長さまでは数える。 */
export const IDLE_LIMIT_MS = 2 * 60 * 1000;
/** 隣り合う2回の時刻の間がこれより長ければ、その間は数えない（ミリ秒）。 */
export const MAX_GAP_MS = 30 * 1000;
/** 保存する合計の上限（秒）。壊れた値で表示が崩れないようにする。 */
export const MAX_STUDY_SECONDS = 100000 * 3600;

/** 保存データの studySeconds を整える。数でない・負・壊れた値は0、小数は切り捨て。 */
export function normalizeStudySeconds(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(Math.floor(v), MAX_STUDY_SECONDS);
}

/** 数える仕組みの状態を作る。now は起動した時刻（ミリ秒）。 */
export function startClock(now, visible = true) {
  return { at: now, lastInput: now, visible: !!visible, carry: 0 };
}

/**
 * 出来事を1つ進める。ev は 'tick'（時間が進んだだけ）／'input'（操作）／'hidden'／'visible'。
 * 戻り値: { clock: 新しい状態, seconds: 今回増えた整数の秒数 }。clock は渡したものを書き換えない。
 */
export function advance(clock, ev, now) {
  const gap = now - clock.at;
  let counted = 0;
  if (clock.visible && gap > 0 && gap <= MAX_GAP_MS) {
    const end = Math.min(now, clock.lastInput + IDLE_LIMIT_MS);
    counted = Math.max(0, end - clock.at);
  }
  const next = { at: now, lastInput: clock.lastInput, visible: clock.visible, carry: 0 };
  if (gap < 0 && next.lastInput > now) next.lastInput = now; // 時計が戻った。未来の「最後の操作」は持ち越さない
  if (ev === 'input') next.lastInput = now;
  else if (ev === 'hidden') next.visible = false;
  else if (ev === 'visible') {
    next.visible = true;
    next.lastInput = now; // 画面を前に出したのは操作とみなす
  }
  const total = clock.carry + counted;
  const seconds = Math.floor(total / 1000);
  next.carry = total - seconds * 1000;
  return { clock: next, seconds };
}

/** 保存データに秒数を足す（state.studySeconds を直接更新）。戻り値は足したあとの合計。 */
export function addStudySeconds(state, seconds) {
  const add = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  state.studySeconds = normalizeStudySeconds(normalizeStudySeconds(state.studySeconds) + add);
  return state.studySeconds;
}

/** 表示用。例: 45240 → '12時間34分'、1500 → '25分'。1分に満たないときは '0分'。 */
export function formatStudyTime(seconds) {
  const s = normalizeStudySeconds(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + '時間' + m + '分' : m + '分';
}
