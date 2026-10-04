// 文字の大きさの設定: 正規化、保存データ、CSS・画面・オフライン登録との突き合わせ。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXT_SIZES, DEFAULT_TEXT_SIZE, TEXT_SCALE, TEXT_SIZE_LABEL, normalizeTextSize } from '../js/lib/textsize.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { createStorage } from '../js/lib/storage.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('段階: 4つ、小さい順、初期は「ふつう」（倍率1）', () => {
  assert.deepEqual(TEXT_SIZES, ['small', 'normal', 'large', 'xlarge']);
  assert.equal(DEFAULT_TEXT_SIZE, 'normal');
  assert.equal(TEXT_SCALE.normal, 1);
  const scales = TEXT_SIZES.map((k) => TEXT_SCALE[k]);
  assert.deepEqual(scales, [...scales].sort((a, b) => a - b));
  assert.equal(new Set(scales).size, 4);
  for (const k of TEXT_SIZES) assert.ok(TEXT_SIZE_LABEL[k], k + ' の名前');
});

test('正規化: 正しい値はそのまま、ありえない値は「ふつう」', () => {
  for (const k of TEXT_SIZES) assert.equal(normalizeTextSize(k), k);
  for (const bad of [undefined, null, '', 'huge', 'LARGE', ' large', 2, 1.3, NaN, true, {}, [], ['large'], '__proto__', 'toString', 'constructor']) {
    assert.equal(normalizeTextSize(bad), 'normal', String(bad));
  }
});

test('保存データ: 初期値は normal、古い記録（項目なし）も normal、正しい値は保つ、ありえない値は normal', () => {
  assert.equal(defaultState().settings.textSize, 'normal');
  assert.equal(mergeState({ settings: { theme: 'dark' } }).settings.textSize, 'normal');
  assert.equal(mergeState(null).settings.textSize, 'normal');
  for (const k of TEXT_SIZES) assert.equal(mergeState({ settings: { textSize: k } }).settings.textSize, k);
  assert.equal(mergeState({ settings: { textSize: 'giant' } }).settings.textSize, 'normal');
  assert.equal(mergeState({ settings: { textSize: 3 } }).settings.textSize, 'normal');
});

test('保存と読み出し: 端末の記録を通しても同じ。書き出し・読み込みでも保たれる', () => {
  const mem = new Map();
  const fake = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const st = createStorage('k', fake);
  const s = st.load();
  s.settings.textSize = 'xlarge';
  st.save(s);
  assert.equal(createStorage('k', fake).load().settings.textSize, 'xlarge');
  const out = parseBackup(serializeBackup('x', s, new Date('2026-10-05T00:00:00Z')), 'x');
  assert.equal(out.ok, true);
  assert.equal(out.state.settings.textSize, 'xlarge');
});

test('CSS: html[data-text] の font-size が、倍率（16px×倍率）と一致する。本文は rem 基準', () => {
  const css = read('shared/css/app.css');
  const px = (n) => Math.round(16 * n * 100) / 100;
  for (const k of TEXT_SIZES) {
    const rule = new RegExp(String.raw`html\[data-text="${k}"\]\s*\{\s*font-size:\s*([0-9.]+)px`);
    const m = css.match(rule);
    assert.ok(m, k + ' の規則がある');
    assert.equal(Number(m[1]), px(TEXT_SCALE[k]), k);
  }
  assert.match(css, /body\s*\{[^}]*font:\s*1rem\/1\.7/);
  // 文字の大きさに px を直接書かない（書くと設定が効かない）。例外は図（.fig）の中だけ（図ごと拡大されるため）
  const bad = css.split(/\r?\n/).filter((l) => /font-size:\s*[0-9.]+px/.test(l) && !/^html[ []|\.fig /.test(l));
  assert.deepEqual(bad, []);
});

test('画面: 設定に選択欄があり、起動時と読み込み・消去のあとにも反映する。オフライン登録と版', () => {
  const more = read('shared/js/views/more.js');
  assert.match(more, /set-textSize/);
  assert.match(more, /text-sample/);
  const app = read('shared/js/app.js');
  assert.match(app, /applyTextSize/);
  assert.match(app, /dataset\.text\s*=/);
  assert.equal((app.match(/app\.applyTextSize\(\)/g) || []).length >= 2, true, '読み込み・消去のあとに反映');
  assert.match(read('shared/sw-core.js'), /shared\/js\/lib\/textsize\.js/);
  for (const a of ['g-kentei', 'dx-biz']) {
    const v = read(a + '/sw.js').match(/version:\s*'(\d+)'/);
    assert.ok(v && Number(v[1]) >= 32, a + ' の version は 32 以上');
  }
});
