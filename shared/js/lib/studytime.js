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

/** 1日に数える上限（秒）。24時間を超える日は無い。 */
export const MAX_DAY_SECONDS = 86400;
/** 日ごとの記録を持つ日数の上限（約100年）。壊れたファイルで保存データが膨らまないための歯止めで、普通は届かない。 */
export const MAX_STUDY_DAYS = 36600;

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' が実在する日付か（2月30日などは false）。 */
export function isDateKey(k) {
  const m = typeof k === 'string' ? DATE_KEY_RE.exec(k) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/**
 * 保存データの studyDays（'YYYY-MM-DD' → その日の秒数）を整える。項目なし・配列・壊れた値は空。
 * 日付でないキー・数でない値・0以下は捨て、小数は切り捨て、1日の上限（24時間）を超える値は上限にする。古い日は消さない（上限の日数を超えたときだけ古い側から）。
 */
export function normalizeStudyDays(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const keys = Object.keys(raw).filter((k) => isDateKey(k) && typeof raw[k] === 'number' && Number.isFinite(raw[k]) && raw[k] >= 1).sort();
  for (const k of keys.slice(-MAX_STUDY_DAYS)) out[k] = Math.min(Math.floor(raw[k]), MAX_DAY_SECONDS);
  return out;
}

function localKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate()); // srs.js の dateKey と同じ（端末の日付）
}

/**
 * 保存データに秒数を足す（state.studySeconds と、その日の分 state.studyDays[日付] を直接更新）。戻り値は足したあとの合計。
 * now は足す時刻（その日の分の日付を決める。端末の日付）。
 */
export function addStudySeconds(state, seconds, now = new Date()) {
  const add = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  state.studySeconds = normalizeStudySeconds(normalizeStudySeconds(state.studySeconds) + add);
  if (add > 0) {
    if (!state.studyDays || typeof state.studyDays !== 'object' || Array.isArray(state.studyDays)) state.studyDays = {};
    const key = localKey(now);
    const cur = typeof state.studyDays[key] === 'number' && Number.isFinite(state.studyDays[key]) && state.studyDays[key] > 0 ? Math.floor(state.studyDays[key]) : 0;
    state.studyDays[key] = Math.min(cur + add, MAX_DAY_SECONDS);
  }
  return state.studySeconds;
}

/** 表示用。例: 45240 → '12時間34分'、1500 → '25分'。1分に満たないときは '0分'。 */
export function formatStudyTime(seconds) {
  const s = normalizeStudySeconds(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + '時間' + m + '分' : m + '分';
}
