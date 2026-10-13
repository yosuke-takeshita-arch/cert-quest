// 科目のあるアプリ（例: 中小企業診断士 第1次試験。config.json に subjects がある）の、記録の置き場と科目の扱い。DOM は触らない。
//
// 決まり（要件定義書 §10）:
//   ・経験値（xp）・連続日数（streak / daily）・音や配色などの設定（settings）は、科目をまたいで共通。
//   ・学習の記録・合格予想・ボス・バッジ・模試・あとで見るは、科目ごと。
// 保存の形（localStorage）:
//   certquest:<アプリid>[:sample]:common:v1        … 共通の記録（上の共通の項目 ＋ 選んだ科目 subject）
//   certquest:<アプリid>[:sample]:<科目id>:v1      … 科目ごとの記録（共通の項目を除いたもの）
//   科目の無いアプリ（G検定・DX）は今までどおり certquest:<アプリid>[:sample]:v1 の1つだけ（singleKey）。ここは変えない。
// 画面やほかの部品は、これまでどおり「平らな1つの記録（defaultState の形）」だけを見る。
// 読むときに共通＋科目を合わせ、書くときに2つへ分ける（createSubjectStore の open）。
import { defaultState, mergeState } from './progress.js';

/** 科目をまたいで共通にする記録の項目（goalAwarded は daily の「今日の目標を達成した日」なので daily と一緒に共通）。 */
export const COMMON_KEYS = ['xp', 'streak', 'daily', 'settings', 'goalAwarded', 'studySeconds']; // 総学習時間もアプリ単位の合計（§6-1）

const SUBJECT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FOLDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
/** 共通の記録の置き場の名前と重なるので、科目の id には使えない。 */
const RESERVED_IDS = ['common'];

/** 科目の無いアプリの保存キー（G検定・DX。今までと同じ）。 */
export function singleKey(appId, sample = false) {
  return 'certquest:' + (appId || 'app') + (sample ? ':sample' : '') + ':v1';
}

/** 科目のあるアプリの、共通の記録の保存キー。 */
export function commonKey(appId, sample = false) {
  return 'certquest:' + (appId || 'app') + (sample ? ':sample' : '') + ':common:v1';
}

/** 科目のあるアプリの、科目ごとの記録の保存キー。 */
export function subjectKey(appId, subjectId, sample = false) {
  return 'certquest:' + (appId || 'app') + (sample ? ':sample' : '') + ':' + subjectId + ':v1';
}

/** config.json に科目の一覧があるか。 */
export function hasSubjects(config) {
  return !!config && Array.isArray(config.subjects) && config.subjects.length > 0;
}

/**
 * config.subjects を整える。形の崩れた項目・id や folder が重なる項目は捨てる。
 * 科目: { id, folder, name, short?, code?, exam?: { minutes, questions? }, mapImage? }
 */
export function normalizeSubjects(config) {
  if (!hasSubjects(config)) return [];
  const ids = new Set();
  const folders = new Set();
  const out = [];
  for (const s of config.subjects) {
    if (!s || typeof s !== 'object') continue;
    if (typeof s.id !== 'string' || !SUBJECT_ID_RE.test(s.id) || RESERVED_IDS.includes(s.id)) continue;
    if (typeof s.folder !== 'string' || !FOLDER_RE.test(s.folder)) continue;
    if (typeof s.name !== 'string' || !s.name) continue;
    if (ids.has(s.id) || folders.has(s.folder)) continue;
    ids.add(s.id);
    folders.add(s.folder);
    out.push({
      id: s.id,
      folder: s.folder,
      name: s.name,
      short: typeof s.short === 'string' && s.short ? s.short : s.name,
      code: typeof s.code === 'string' ? s.code : '',
      exam: s.exam && typeof s.exam === 'object' ? s.exam : null,
      mapImage: typeof s.mapImage === 'string' && s.mapImage ? s.mapImage : null,
    });
  }
  return out;
}

/**
 * 科目を開いているときの config（画面が読む app.config）。アプリ全体の config に、その科目の名前・試験時間などを重ねる。
 * id は変えない（書き出しのファイル名・誤りの報告に使うので、アプリの id のまま）。
 */
export function subjectConfig(config, subject) {
  // subjects は一覧なので、科目を開いたあとの config には持ち越さない
  const { subjects, ...rest } = config; // eslint-disable-line no-unused-vars
  const out = { ...rest };
  out.name = (config.shortName || config.name || '') + ' › ' + subject.name;
  out.subject = { id: subject.id, name: subject.name, short: subject.short, code: subject.code };
  if (subject.exam) out.exam = { ...(config.exam || {}), ...subject.exam };
  if (subject.mapImage) out.mapImage = subject.mapImage;
  return out;
}

/** 科目のデータ（index.json など）の置き場の URL（末尾 /）。pageUrl は config.json と同じ場所（アプリのページの URL）。 */
export function subjectDataBase(subject, pageUrl, sample = false) {
  return new URL((sample ? './_sample/' : './') + subject.folder + '/', pageUrl).href;
}

/** 科目ごとの絵（ボス・バッジ）の置き場の URL（末尾 /）。アプリの images/<科目id>/ 。 */
export function subjectImagesBase(subject, pageUrl) {
  return new URL('./images/' + subject.id + '/', pageUrl).href;
}

/** 平らな記録を、共通の部分と科目の部分に分ける。 */
export function splitState(flat) {
  const merged = mergeState(flat);
  const common = {};
  const subject = {};
  for (const k of Object.keys(merged)) {
    if (COMMON_KEYS.includes(k)) common[k] = merged[k];
    else subject[k] = merged[k];
  }
  return { common, subject };
}

/** 共通の部分と科目の部分（どちらも欠けていてよい）から、平らな記録を作る。 */
export function joinState(common, subject) {
  const c = {};
  if (common && typeof common === 'object') for (const k of COMMON_KEYS) if (k in common) c[k] = common[k];
  const s = subject && typeof subject === 'object' && !Array.isArray(subject) ? { ...subject } : {};
  for (const k of COMMON_KEYS) delete s[k]; // 科目の側に紛れた共通の項目は読まない（共通は共通の置き場が正）
  return mergeState({ ...s, ...c });
}

/** defaultState のうち、科目ごとの項目の名前。 */
export function subjectKeys() {
  return Object.keys(defaultState()).filter((k) => !COMMON_KEYS.includes(k));
}

/**
 * 科目のあるアプリの記録の置き場。
 *   common()      … 共通の記録だけを使うストレージ（科目を選ぶ前のタイトル画面の設定など）。load / save / clear
 *   selected()    … 前回選んだ科目の id（無ければ null）。select(id) で保存
 *   open(id)      … その科目を開いたときのストレージ。load は共通＋科目を合わせた平らな記録、save は2つに分けて書く
 *   peek(id)      … 一覧に出す用に、その科目の記録を読むだけ（書かない）
 *   exportAll()   … 書き出し用 { common, subjects: { 科目id: 科目の記録 } }
 *   importAll(x)  … 読み込み。x に有る科目だけ置き換える（無い科目はそのまま）
 * backing は localStorage 相当（getItem / setItem / removeItem）。省略すると localStorage、使えなければメモリ上にだけ持つ。
 */
export function createSubjectStore({ appId, subjects, sample = false, backing }) {
  const list = Array.isArray(subjects) ? subjects : [];
  const ids = new Set(list.map((s) => s.id));
  let store = backing;
  if (store === undefined) {
    try {
      store = typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      store = null;
    }
  }
  let persistent = !!store;
  const memory = new Map();

  const cKey = commonKey(appId, sample);
  const sKey = (id) => subjectKey(appId, id, sample);

  function readRaw(key) {
    try {
      if (store) {
        const raw = store.getItem(key);
        if (raw) {
          const v = JSON.parse(raw);
          return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
        }
        return null;
      }
    } catch (e) {
      persistent = false;
    }
    return memory.has(key) ? JSON.parse(memory.get(key)) : null;
  }
  function writeRaw(key, obj) {
    const text = JSON.stringify(obj);
    memory.set(key, text);
    if (!store) return false;
    try {
      store.setItem(key, text);
      return true;
    } catch (e) {
      persistent = false;
      return false;
    }
  }
  function removeRaw(key) {
    memory.delete(key);
    try {
      if (store) store.removeItem(key);
    } catch (e) {
      persistent = false;
    }
  }

  function commonPart(state) {
    const out = {};
    for (const k of COMMON_KEYS) out[k] = state[k];
    return out;
  }
  function writeCommon(state) {
    const prev = readRaw(cKey) || {};
    return writeRaw(cKey, { ...prev, v: 1, ...commonPart(state) }); // 選んだ科目（subject）などは残す
  }

  const api = {
    get persistent() { return persistent; },
    commonKey: cKey,
    keyFor: sKey,

    common() {
      return {
        load: () => joinState(readRaw(cKey), null),
        save: (state) => writeCommon(mergeState(state)),
        clear: () => removeRaw(cKey),
        get persistent() { return persistent; },
      };
    },

    selected() {
      const c = readRaw(cKey);
      return c && typeof c.subject === 'string' && ids.has(c.subject) ? c.subject : null;
    },
    select(id) {
      if (!ids.has(id)) return false;
      const prev = readRaw(cKey) || {};
      return writeRaw(cKey, { ...prev, v: 1, subject: id });
    },

    open(id) {
      if (!ids.has(id)) throw new Error('知らない科目: ' + id);
      return {
        subjectId: id,
        load: () => joinState(readRaw(cKey), readRaw(sKey(id))),
        save: (state) => {
          const { common, subject } = splitState(state);
          const a = writeRaw(sKey(id), subject);
          const b = writeCommon(common);
          return a && b;
        },
        // 「学習記録を消す」は、その科目の分だけ。共通（XP・連続日数・設定）は残す
        clear: () => removeRaw(sKey(id)),
        get persistent() { return persistent; },
      };
    },

    peek(id) {
      if (!ids.has(id)) return mergeState(null);
      return joinState(readRaw(cKey), readRaw(sKey(id)));
    },

    exportAll() {
      const out = { common: splitState(joinState(readRaw(cKey), null)).common, subjects: {} };
      for (const s of list) {
        const raw = readRaw(sKey(s.id));
        if (raw) out.subjects[s.id] = splitState(joinState(null, raw)).subject;
      }
      return out;
    },

    importAll(x) {
      if (!x || typeof x !== 'object') return { common: false, subjects: [] };
      let commonDone = false;
      if (x.common && typeof x.common === 'object') {
        const prev = readRaw(cKey) || {};
        writeRaw(cKey, { ...prev, v: 1, ...commonPart(joinState(x.common, null)) });
        commonDone = true;
      }
      const done = [];
      if (x.subjects && typeof x.subjects === 'object') {
        for (const s of list) {
          if (!(s.id in x.subjects)) continue;
          writeRaw(sKey(s.id), splitState(joinState(null, x.subjects[s.id])).subject);
          done.push(s.id);
        }
      }
      return { common: commonDone, subjects: done };
    },
  };
  return api;
}
