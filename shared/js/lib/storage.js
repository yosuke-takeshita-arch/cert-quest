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
