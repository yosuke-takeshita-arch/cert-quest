// npm test の一覧（package.json の test）に、tests/ のテストのファイルが全部、1つずつ載っているかの検証。
// 2026-10-09、一覧の空白が抜けて「tests/bossrun.test.jstests/forecastcard.test.js」となり、2つのファイルが黙って回らなくなった（全部通ったと報告された）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const listed = pkg.scripts.test.split(/\s+/).filter((x) => x.startsWith('tests/'));
const files = readdirSync(new URL('./', import.meta.url)).filter((f) => f.endsWith('.test.js')).map((f) => 'tests/' + f);

test('tests/ のテストのファイルが全部 npm test の一覧に載っている', () => {
  const missing = files.filter((f) => !listed.includes(f));
  assert.deepEqual(missing, []);
});

test('一覧に載っている名前は、どれも実在するファイル（空白の抜けで2つがつながっていない）', () => {
  const ghost = listed.filter((f) => !files.includes(f));
  assert.deepEqual(ghost, []);
});
