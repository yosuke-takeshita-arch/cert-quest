// アプリの版の表示（設定画面のいちばん下）。「版 0.9.0（117）」の形。
// 前の数字: 人に見せる版。各アプリの config.json の appVersion が正本（決まりは docs/01_要件定義/要件定義書.md の 3-2-b）。
// 括弧の数字: service worker の版。各アプリの sw.js の version が正本。画面は動いている service worker に聞いて知る（なければ、保存場所の名前から知る）。

/** 人に見せる版の形（数.数.数。先頭の0を付けない）。 */
const APP_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SW_VERSION_RE = /^[1-9]\d*$/;

/** 取れなかった側に出す文字。 */
export const VERSION_UNKNOWN = '—';

export function isAppVersion(v) {
  return typeof v === 'string' && APP_VERSION_RE.test(v);
}

export function isSwVersion(v) {
  return (typeof v === 'string' || typeof v === 'number') && SW_VERSION_RE.test(String(v));
}

/** 画面に出す文字。どちらかが取れていなければ、その側を「—」にする（画面は壊さない）。 */
export function formatAppVersion(appVersion, swVersion) {
  const a = isAppVersion(appVersion) ? appVersion : VERSION_UNKNOWN;
  const s = isSwVersion(swVersion) ? String(swVersion) : VERSION_UNKNOWN;
  return '版 ' + a + '（' + s + '）';
}

/** service worker の保存場所の名前（certquest-<アプリ>-v<版>）から版を取り出す。違う形・別のアプリのものは null。 */
export function swVersionFromCacheName(name, appId) {
  const prefix = 'certquest-' + appId + '-v';
  if (typeof name !== 'string' || typeof appId !== 'string' || !name.startsWith(prefix)) return null;
  const v = name.slice(prefix.length);
  return SW_VERSION_RE.test(v) ? v : null;
}

/** 保存場所の名前の一覧から、このアプリの版を決める。ちょうど1つのときだけ（新旧が並んでいるときは決められない）。 */
export function swVersionFromCacheNames(names, appId) {
  const found = (names || []).map((n) => swVersionFromCacheName(n, appId)).filter(Boolean);
  return found.length === 1 ? found[0] : null;
}

/** 動いている service worker の版を取る。取れなければ null。 */
export async function readSwVersion(appId, nav = globalThis.navigator, cacheStorage = globalThis.caches, timeoutMs = 1500) {
  try {
    const ctl = nav && nav.serviceWorker && nav.serviceWorker.controller;
    if (ctl && typeof MessageChannel !== 'undefined') {
      const v = await new Promise((resolve) => {
        const ch = new MessageChannel();
        const timer = setTimeout(() => { ch.port1.close(); resolve(null); }, timeoutMs); // 古い service worker は答えない
        ch.port1.onmessage = (e) => {
          clearTimeout(timer);
          ch.port1.close();
          resolve(e.data && isSwVersion(e.data.version) ? String(e.data.version) : null);
        };
        ctl.postMessage({ type: 'cq-version' }, [ch.port2]);
      });
      if (v) return v;
    }
    if (ctl && cacheStorage) return swVersionFromCacheNames(await cacheStorage.keys(), appId);
  } catch (e) { /* 取れないときは出さない */ }
  return null;
}
