// 「新しい問題が届きました」の帯（決まりは 要件定義書 3-2-c）。
// 実行: cd shared && node --test tests/updatenotice.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './apps.js';
import { createUpdateWatcher, UPDATE_NOTICE_TEXT, UPDATE_NOTICE_BUTTON, UPDATE_NOTICE_LATER } from '../js/lib/updatenotice.js';

test('開いたとき service worker が動いていて、入れ替わったら出す', () => {
  assert.equal(createUpdateWatcher(true).onChange(), true);
});

test('初めて入れたとき（開いた時点で controller が無い）は出さない。何度起きても出さない', () => {
  const w = createUpdateWatcher(false);
  assert.equal(w.onChange(), false);
  assert.equal(w.onChange(), false);
});

test('2回起きても帯は1つだけ（2回目は出さない）', () => {
  const w = createUpdateWatcher(true);
  assert.equal(w.onChange(), true);
  assert.equal(w.onChange(), false);
  assert.equal(w.onChange(), false);
});

test('文言', () => {
  assert.equal(UPDATE_NOTICE_TEXT, '新しい問題が届きました');
  assert.equal(UPDATE_NOTICE_BUTTON, '開き直す');
  assert.equal(UPDATE_NOTICE_LATER, 'あとで');
});

test('app.js が判定器で結線され、勝手には再読み込みしない。sw-core.js が新ファイルを先取りしている', () => {
  const app = readFileSync(join(root, 'shared/js/app.js'), 'utf8');
  assert.ok(app.includes("from './lib/updatenotice.js'"));
  assert.ok(app.includes('createUpdateWatcher(Boolean(navigator.serviceWorker.controller))'), '登録の前に controller の有無を渡す');
  const onChange = app.slice(app.indexOf("addEventListener('controllerchange'"));
  assert.ok(onChange.includes('watcher.onChange()'));
  const body = onChange.slice(0, onChange.indexOf('});'));
  assert.ok(!body.includes('location.reload'), 'controllerchange で勝手に再読み込みしない');
  assert.ok(/addEventListener\('click'[^]*location\.reload\(\)/.test(app.slice(app.indexOf('showUpdateNotice'))), '再読み込みは帯のボタンを押したときだけ');
  assert.ok(app.includes("later.addEventListener('click', () => box.remove())"), '「あとで」は帯を消すだけ（再読み込みしない）');
  const css = readFileSync(join(root, 'shared/css/app.css'), 'utf8');
  const rule = css.split('\n').find((l) => l.startsWith('.update-notice {'));
  assert.ok(rule.includes('top: calc(env(safe-area-inset-top)') && !rule.includes('bottom:'), '帯は画面の上に出す');
  const sw = readFileSync(join(root, 'shared/sw-core.js'), 'utf8');
  assert.ok(sw.includes("'../shared/js/lib/updatenotice.js'"), 'sw-core.js の SHARED に無い');
});
