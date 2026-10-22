// アプリの版の表示（設定画面のいちばん下「版 0.9.0（117）」）。決まりは docs/01_要件定義/要件定義書.md の 3-2-b。
// 実行: cd shared && node --test tests/appversion.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { root, APPS } from './apps.js';
import {
  isAppVersion, isSwVersion, formatAppVersion, formatTitleVersion, VERSION_UNKNOWN,
  swVersionFromCacheName, swVersionFromCacheNames, readSwVersion,
} from '../js/lib/appversion.js';

// 地図1つのアプリ＋科目のあるアプリ（診断士）。人に見せる版は4つ全部に要る
const ALL = [...APPS, 'shindanshi/1ji'];
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

test('4つのアプリの config.json に、数.数.数 の appVersion がある（始まりは 0.9.0）', () => {
  assert.equal(ALL.length, 4, 'アプリの数: ' + ALL.join(', '));
  for (const app of ALL) {
    const c = readJson(app + '/config.json');
    assert.ok(isAppVersion(c.appVersion), app + ' の appVersion が 数.数.数 でない: ' + c.appVersion);
    const [maj, min] = c.appVersion.split('.').map(Number);
    assert.ok(maj > 0 || min >= 9, app + ' は 0.9.0 より前の番号になっている: ' + c.appVersion);
  }
});

test('設定画面の括弧の数字は、各アプリの sw.js の version（数字）と同じ形で取れる', () => {
  for (const app of ALL) {
    const m = /version:\s*'(\d+)'/.exec(readFileSync(join(root, app, 'sw.js'), 'utf8'));
    assert.ok(m && isSwVersion(m[1]), app + ' の sw.js の version が読めない');
  }
});

test('isAppVersion: 数.数.数 だけ通す（先頭の0・欠け・文字・数字型は通さない）', () => {
  for (const ok of ['0.9.0', '1.0.0', '1.12.30', '0.0.0']) assert.equal(isAppVersion(ok), true, ok);
  for (const ng of ['', '1', '1.0', '1.0.0.0', '01.0.0', '1.00.0', 'v1.0.0', '1.0.x', ' 1.0.0', '0.9.0 ', null, undefined, 1, {}]) assert.equal(isAppVersion(ng), false, String(ng));
});

test('isSwVersion: 1以上の整数（文字でも数字でも）だけ通す', () => {
  for (const ok of ['1', '117', 33, '22']) assert.equal(isSwVersion(ok), true, String(ok));
  for (const ng of ['', '0', '01', '-1', '1.5', 'abc', null, undefined, NaN]) assert.equal(isSwVersion(ng), false, String(ng));
});

test('formatAppVersion: 両方あれば「版 0.9.0（117）」', () => {
  assert.equal(formatAppVersion('0.9.0', '117'), '版 0.9.0（117）');
  assert.equal(formatAppVersion('1.2.3', 33), '版 1.2.3（33）');
});

test('formatAppVersion: 欠けた側は「—」。画面は壊れない（例外を出さない）', () => {
  assert.equal(VERSION_UNKNOWN, '—');
  assert.equal(formatAppVersion('0.9.0', null), '版 0.9.0（—）');
  assert.equal(formatAppVersion('0.9.0', undefined), '版 0.9.0（—）');
  assert.equal(formatAppVersion(undefined, '117'), '版 —（117）');
  assert.equal(formatAppVersion('abc', '117'), '版 —（117）');
  assert.equal(formatAppVersion(null, null), '版 —（—）');
  assert.equal(formatAppVersion({}, []), '版 —（—）');
});

test('保存場所の名前から版を取る: certquest-<アプリ>-v<版>。別のアプリ・違う形は取らない', () => {
  assert.equal(swVersionFromCacheName('certquest-g-kentei-v117', 'g-kentei'), '117');
  assert.equal(swVersionFromCacheName('certquest-shindanshi-1ji-v22', 'shindanshi-1ji'), '22');
  assert.equal(swVersionFromCacheName('certquest-dx-biz-v117', 'g-kentei'), null);
  assert.equal(swVersionFromCacheName('certquest-g-kentei-vabc', 'g-kentei'), null);
  assert.equal(swVersionFromCacheName('certquest-g-kentei-v', 'g-kentei'), null);
  assert.equal(swVersionFromCacheName(undefined, 'g-kentei'), null);
  assert.equal(swVersionFromCacheNames(['certquest-g-kentei-v117', 'certquest-dx-biz-v9'], 'g-kentei'), '117');
  assert.equal(swVersionFromCacheNames(['certquest-g-kentei-v116', 'certquest-g-kentei-v117'], 'g-kentei'), null, '新旧が並んでいるときは決められない');
  assert.equal(swVersionFromCacheNames([], 'g-kentei'), null);
  assert.equal(swVersionFromCacheNames(undefined, 'g-kentei'), null);
});

test('readSwVersion: service worker が無い（初回など）・取れないときは null（例外にしない）', async () => {
  assert.equal(await readSwVersion('g-kentei', {}, undefined), null);
  assert.equal(await readSwVersion('g-kentei', { serviceWorker: { controller: null } }, { keys: async () => ['certquest-g-kentei-v117'] }), null);
  const boom = { serviceWorker: { controller: { postMessage() { throw new Error('x'); } } } };
  assert.equal(await readSwVersion('g-kentei', boom, { keys: async () => { throw new Error('y'); } }), null);
});

test('readSwVersion: service worker が答えれば、その版。答えない古い service worker は保存場所の名前から', async () => {
  const answering = { serviceWorker: { controller: { postMessage(msg, ports) { assert.equal(msg.type, 'cq-version'); ports[0].postMessage({ version: '117' }); } } } };
  assert.equal(await readSwVersion('g-kentei', answering, { keys: async () => [] }), '117');
  const silent = { serviceWorker: { controller: { postMessage() {} } } };
  assert.equal(await readSwVersion('g-kentei', silent, { keys: async () => ['certquest-g-kentei-v116'] }, 30), '116');
  const garbage = { serviceWorker: { controller: { postMessage(m, ports) { ports[0].postMessage({ version: 'abc' }); } } } };
  assert.equal(await readSwVersion('g-kentei', garbage, { keys: async () => [] }), null);
});

test('sw-core.js: 聞かれたら CFG.version を返す（文字で）。関係ない便りには答えない', () => {
  const src = readFileSync(join(root, 'shared', 'sw-core.js'), 'utf8');
  const handlers = {};
  const self = { CERT_QUEST: { appId: 't', version: '117', appFiles: ['./'] }, location: { href: 'https://example.test/x/sw.js' }, addEventListener: (t, fn) => { handlers[t] = fn; } };
  vm.runInNewContext(src, { self, caches: {}, fetch: async () => ({}), URL, Request: class {}, Response, Promise, console });
  assert.equal(typeof handlers.message, 'function');
  const sent = [];
  const port = { postMessage: (m) => sent.push(m) };
  handlers.message({ data: { type: 'cq-version' }, ports: [port] });
  assert.equal(JSON.stringify(sent), JSON.stringify([{ version: '117' }]));
  handlers.message({ data: { type: 'other' }, ports: [port] });
  handlers.message({ data: null, ports: [port] });
  handlers.message({ data: { type: 'cq-version' }, ports: [] });
  assert.equal(sent.length, 1);
});

test('設定画面のいちばん下に版が出る（データの状態のカードのあと）', () => {
  const src = readFileSync(join(root, 'shared', 'js', 'views', 'more.js'), 'utf8');
  const i = src.indexOf('root.appendChild(info);');
  const j = src.indexOf('data-app-version');
  assert.ok(i > 0 && j > i, '版の行が「データの状態」のカードより後ろに無い');
  assert.ok(src.indexOf('return { el: root, cleanup: sound.dispose }') > j, '版の行が画面の返り値より後ろになっている');
});

test('タイトル画面の版: 「Ver. 0.9.0」だけ。sw の番号は出さず、取れないときは何も出さない', () => {
  assert.equal(formatTitleVersion('0.9.0'), 'Ver. 0.9.0');
  assert.equal(formatTitleVersion('1.12.3'), 'Ver. 1.12.3');
  for (const ng of [undefined, null, '', '1.0', 'abc', 9, {}]) assert.equal(formatTitleVersion(ng), null, String(ng));
  for (const app of ALL) assert.match(formatTitleVersion(readJson(app + '/config.json').appVersion), /^Ver\. \d+\.\d+\.\d+$/);
});

test('タイトル画面: 「非公式アプリ」のあとに版を置き、押せる範囲に触らない（CSS は pointer-events なし・小さく薄い）', () => {
  const src = readFileSync(join(root, 'shared', 'js', 'views', 'title.js'), 'utf8');
  assert.match(src, /formatTitleVersion\(config && config\.appVersion\)/);
  const bottom = src.slice(src.indexOf("const bottom = h('div', { class: 'title-bottom' }"));
  assert.ok(bottom.indexOf('title-unofficial') > 0 && bottom.indexOf('titleVersionEl(config)') > bottom.indexOf('title-unofficial'), '版は「非公式アプリ」より下');
  const css = readFileSync(join(root, 'shared', 'css', 'app.css'), 'utf8');
  const rule = /\.title-version \{([^}]*)\}/.exec(css);
  assert.ok(rule, '.title-version の規則が無い');
  assert.match(rule[1], /pointer-events:\s*none/);
  assert.match(rule[1], /font-size:\s*0\.75rem/, '「非公式アプリ」（0.8125rem）より小さい');
  assert.match(rule[1], /rgba\(255, 255, 255, 0\.[0-9]+\)/, '薄い白');
  assert.match(rule[1], /text-shadow/, '背景の絵の上で読めるよう影を付ける');
});
