// localStorage の薄い包み。読めない・書けない環境（プライベートモード等）でも落ちない。
// 書けないときはメモリ上にだけ持つ（アプリを閉じると消える）。persistent=false でそれを画面に知らせられる。
import { mergeState } from './progress.js';

export function createStorage(key, backing) {
  let store = backing;
  if (store === undefined) {
    try {
      store = typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      store = null;
    }
  }
  let persistent = !!store;
  let memory = null;

  function load() {
    try {
      if (store) {
        const raw = store.getItem(key);
        if (raw) return mergeState(JSON.parse(raw));
      }
    } catch (e) {
      persistent = false;
    }
    return mergeState(memory);
  }

  function save(state) {
    memory = JSON.parse(JSON.stringify(state));
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(state));
      return true;
    } catch (e) {
      persistent = false;
      return false;
    }
  }

  function clear() {
    memory = null;
    try {
      if (store) store.removeItem(key);
    } catch (e) {
      persistent = false;
    }
  }

  return { load, save, clear, get persistent() { return persistent; } };
}

// ---- 解いている途中の模擬試験の置き場（2026-11-10 の決定）----
// 学習の記録とは別の鍵に置く。理由: 答えるたびに書くので、学習の記録まるごとを毎回書き直さないため。バックアップにも入れないため（途中の試験は、その端末だけのもの）。

/** 途中の模擬試験を置く鍵。学習の記録の鍵（…:v1）の後ろに付ける（科目のあるアプリでは、科目ごとの鍵の後ろ）。 */
export function examRunKey(studyKey) {
  return studyKey + ':examrun';
}

/**
 * 途中の模擬試験の置き場。読めない・書けない環境でも落ちない（保存できなくても、試験は続けられる）。
 * load() は { run, broken }。run … 保存していたもの（無ければ null）。broken … 何か入っていたが読めなかった（壊れていた）。
 */
export function createExamRunStore(key, backing) {
  let store = backing;
  if (store === undefined) {
    try {
      store = typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      store = null;
    }
  }
  function load() {
    let raw = null;
    try {
      raw = store ? store.getItem(key) : null;
    } catch (e) {
      return { run: null, broken: false };
    }
    if (raw === null || raw === undefined || raw === '') return { run: null, broken: false };
    try {
      const run = JSON.parse(raw);
      if (run && typeof run === 'object' && !Array.isArray(run)) return { run, broken: false };
    } catch (e) {
      // 下で broken を返す
    }
    return { run: null, broken: true };
  }
  function save(run) {
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(run));
      return true;
    } catch (e) {
      return false;
    }
  }
  function clear() {
    try {
      if (store) store.removeItem(key);
    } catch (e) {
      // 消せなくても先へ進む
    }
  }
  return { load, save, clear };
}
