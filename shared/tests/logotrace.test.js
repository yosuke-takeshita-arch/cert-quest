// lib/logotrace.js（ロゴの決めた部分だけを光の粒がたどる演出の、形と時間割り）と、各アプリの config.titleLogoTrace の検証
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, root } from './apps.js';
import { validTrace, partPath, lineLength, traceSchedule } from '../js/lib/logotrace.js';

test('validTrace: 線が1本以上、どの線も2点以上、座標は0以上の数。flash は無くてもよい', () => {
  assert.equal(validTrace({ parts: [[[0, 0], [3, 4]]] }), true);
  assert.equal(validTrace({ parts: [[[0, 0], [3, 4]]], flash: [1, 2] }), true);
  for (const bad of [undefined, null, {}, { parts: [] }, { parts: [[[0, 0]]] }, { parts: [[[0, 0], [1]]] }, { parts: [[[0, 0], [-1, 2]]] },
    { parts: [[[0, 0], ['1', 2]]] }, { parts: [[[0, 0], [NaN, 2]]] }, { parts: [[[0, 0], [1, 2]]], flash: [1] }, { parts: [[[0, 0], [1, 2]]], flash: null }]) {
    assert.equal(validTrace(bad), false, JSON.stringify(bad));
  }
});

test('partPath: k 倍して小数1桁に丸め、閉じない path にする', () => {
  assert.equal(partPath([[10, 20], [30, 41]], 0.25), 'M2.5 5L7.5 10.3');
  assert.equal(partPath([[1, 2], [3, 4], [5, 6]]), 'M1 2L3 4L5 6');
});

test('lineLength: 折れ線の長さ', () => {
  assert.equal(lineLength([[0, 0], [3, 4], [3, 10]]), 11);
  assert.equal(lineLength([[2, 2]]), 0);
});

test('traceSchedule: 同じ速さで1本ずつ、あいだを gap あけてたどり、最後の線の終わりで光って、休んで戻る', () => {
  const s = traceSchedule([100, 50], { speed: 50, lead: 0.5, gap: 0.25, flash: 1, rest: 2 });
  assert.deepEqual(s.parts, [{ start: 0.5, end: 2.5 }, { start: 2.75, end: 3.75 }]);
  assert.equal(s.flashAt, 3.75);
  assert.equal(s.cycle, 6.75);
  // 省いた値は0
  assert.deepEqual(traceSchedule([10], { speed: 10 }), { parts: [{ start: 0, end: 1 }], flashAt: 1, cycle: 1 });
});

// webp の幅と高さ（VP8 / VP8L / VP8X）
function webpSize(buf) {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  throw new Error('webp ではない: ' + kind);
}

for (const app of APPS) {
  const config = JSON.parse(readFileSync(join(root, app, 'config.json'), 'utf8'));
  if (config.titleLogoTrace === undefined) continue;
  test(`${app}: titleLogoTrace は使える形で、点はどれもロゴの絵の中にある`, () => {
    assert.equal(validTrace(config.titleLogoTrace), true, '形が違う（parts は2点以上の線の並び、flash は [x, y]）');
    assert.equal(typeof config.titleLogo, 'string', 'titleLogoTrace はロゴの絵（titleLogo）があるときだけ');
    const [w, h] = webpSize(readFileSync(join(root, app, config.titleLogo)));
    const pts = [...config.titleLogoTrace.parts.flat(), ...(config.titleLogoTrace.flash ? [config.titleLogoTrace.flash] : [])];
    for (const [x, y] of pts) assert.ok(x <= w && y <= h, `絵（${w}×${h}）の外の点 ${x},${y}`);
  });
}
