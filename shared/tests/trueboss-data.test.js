// 真ボスの名前・せりふのデータ（lib/trueboss-data.js と g-kentei/data/trueboss.json）の検証。ブラウザ無しで node から叩く。
// 実行: cd shared && node --test tests/trueboss-data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  normalizeTrueBossData, trueBossForm, pickTrueLine, loadTrueBossData, trueBossImageName, TRUE_LINE_KINDS, DEFAULT_TRUE_BOSS, TRUE_BOSS_FILE,
} from '../js/lib/trueboss-data.js';

const HEX = /^#[0-9a-fA-F]{6}$/;

test('データが無い・壊れているとき: 3つの形態の仮の名前とせりふ・技・エンディングで動く', () => {
  for (const raw of [null, undefined, 'x', 5, [], {}, { forms: 'x' }]) {
    const d = normalizeTrueBossData(raw);
    assert.equal(d.forms.length, 3);
    d.forms.forEach((f, i) => {
      assert.equal(f.form, i + 1);
      assert.ok(f.name && HEX.test(f.color));
      for (const k of TRUE_LINE_KINDS) assert.ok(Array.isArray(f.lines[k]));
      for (const k of ['appear', 'attack', 'hurt', 'defeat', 'heal']) assert.ok(f.lines[k].length > 0, k);
    });
    assert.ok(d.forms[0].lines.evolve.length > 0 && d.forms[1].lines.evolve.length > 0, '進化するのは第1・第2形態');
    assert.deepEqual(d.forms[2].lines.evolve, [], '第3形態は進化しない');
    assert.ok(d.skills.timed.name && d.skills.curse.name && d.skills.timed.line && d.skills.curse.line);
    assert.ok(d.ending.length >= 1);
    assert.ok(d.name);
  }
});

test('データの整形: 持っている項目はそのまま使い、足りない項目・壊れた項目だけ仮で埋める', () => {
  const d = normalizeTrueBossData({
    name: ' ヌシ ',
    forms: [
      { name: '一', title: ' t ', color: '#112233', lines: { appear: [' あ ', '', 5, null], attack: [] } },
      { name: '', color: 'red', lines: 'x' },
      null,
    ],
    skills: { timed: { name: 'T', line: 'tl' }, curse: { name: '' } },
    ending: ['  終わり  ', '', 3],
  });
  assert.equal(d.name, 'ヌシ');
  assert.equal(d.forms[0].name, '一');
  assert.equal(d.forms[0].title, 't');
  assert.equal(d.forms[0].color, '#112233');
  assert.deepEqual(d.forms[0].lines.appear, ['あ']);
  assert.deepEqual(d.forms[0].lines.attack, DEFAULT_TRUE_BOSS.forms[0].lines.attack, '空の種類は仮のせりふ');
  assert.equal(d.forms[1].name, 'ヌシ', '形態の名前が空なら、全体の名前');
  assert.ok(HEX.test(d.forms[1].color), '色が不正なら仮の色');
  assert.equal(d.forms[2].name, 'ヌシ');
  assert.deepEqual(d.skills.timed, { name: 'T', line: 'tl' });
  assert.equal(d.skills.curse.name, DEFAULT_TRUE_BOSS.skills.curse.name);
  assert.deepEqual(d.ending, ['終わり']);
  // 全体の名前が無ければ第1形態の名前
  assert.equal(normalizeTrueBossData({ forms: [{ name: '甲' }] }).name, '甲');
});

test('形態の取り出し: 1〜3。範囲外・壊れた値は第1形態。データが無くても落ちない', () => {
  const d = normalizeTrueBossData({ forms: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  assert.equal(trueBossForm(d, 1).name, 'A');
  assert.equal(trueBossForm(d, 2).name, 'B');
  assert.equal(trueBossForm(d, 3).name, 'C');
  for (const f of [0, 4, -1, 1.5, NaN, '2', null, undefined]) assert.equal(trueBossForm(d, f).name, 'A', String(f));
  assert.equal(trueBossForm(null, 2).form, 2, 'データが無ければ仮の同じ形態');
  assert.equal(trueBossForm({ forms: [] }, 3).form, 3);
  assert.equal(trueBossForm(null, 9).form, 1);
});

test('せりふの選び方: 乱数の両端と壊れた値でも範囲内。種類が空なら空文字', () => {
  const p = { lines: { appear: ['a', 'b', 'c'], hurt: [] } };
  assert.equal(pickTrueLine(p, 'appear', () => 0), 'a');
  assert.equal(pickTrueLine(p, 'appear', () => 0.5), 'b');
  assert.equal(pickTrueLine(p, 'appear', () => 0.999), 'c');
  assert.equal(pickTrueLine(p, 'appear', () => 1), 'c');
  assert.equal(pickTrueLine(p, 'appear', () => NaN), 'a');
  assert.equal(pickTrueLine(p, 'appear', () => -3), 'a');
  assert.equal(pickTrueLine(p, 'hurt'), '');
  assert.equal(pickTrueLine(p, 'nothing'), '');
  assert.equal(pickTrueLine(null, 'appear'), '');
});

test('絵のファイル名: 形態ごとに true-1.webp 〜 true-3.webp', () => {
  assert.equal(trueBossImageName(1), 'true-1.webp');
  assert.equal(trueBossImageName(2), 'true-2.webp');
  assert.equal(trueBossImageName(3), 'true-3.webp');
  assert.equal(TRUE_BOSS_FILE, 'trueboss.json');
});

test('読み込み: 404・壊れた JSON・通信エラーのどれでも、仮のデータで動く。読めたら整形して使う', async () => {
  const ok = (body) => async () => ({ ok: true, json: async () => body });
  const a = await loadTrueBossData('x', ok({ name: 'ヌシ', forms: [{ name: '甲' }] }));
  assert.equal(a.name, 'ヌシ');
  assert.equal(a.forms[0].name, '甲');
  assert.equal(a.forms.length, 3);
  const nf = await loadTrueBossData('x', async () => ({ ok: false, status: 404 }));
  assert.equal(nf.forms.length, 3);
  const bad = await loadTrueBossData('x', async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }));
  assert.equal(bad.forms.length, 3);
  const net = await loadTrueBossData('x', async () => { throw new Error('network'); });
  assert.equal(net.forms.length, 3);
  const none = await loadTrueBossData('x', async () => null);
  assert.equal(none.forms.length, 3);
});

// ---- 実際のデータファイル（G検定）。仮の文でも、形が崩れていないこと ----
const file = fileURLToPath(new URL('../../g-kentei/data/trueboss.json', import.meta.url));
// 正本（docs/sources/boss-characters.md の『真ボス シンギュラ』の JSON）と、g-kentei/data/trueboss.json が1文字も違わないこと
function canonical() {
  const md = readFileSync(fileURLToPath(new URL('../../docs/sources/boss-characters.md', import.meta.url)), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const s = md.findIndex((l) => l.startsWith('### 真ボス シンギュラ'));
  const a = md.findIndex((l, i) => i > s && l.startsWith('```json'));
  const b = md.findIndex((l, i) => i > a && l.startsWith('```'));
  assert.ok(s >= 0 && a > s && b > a, '正本の節が見つからない');
  return JSON.parse(md.slice(a + 1, b).join('\n'));
}

test('g-kentei/data/trueboss.json: 正本の JSON と完全に一致する（名前・二つ名・色・せりふ・技の名前・エンディング）', () => {
  assert.ok(existsSync(file), 'g-kentei/data/trueboss.json が無い');
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), canonical());
});

test('g-kentei/data/trueboss.json: 読み込みで正本の文がそのまま使われる（仮の文で埋まっていない）', () => {
  const raw = canonical();
  const d = normalizeTrueBossData(raw);
  assert.equal(d.name, raw.name);
  d.forms.forEach((f, i) => {
    assert.equal(f.name, raw.name);
    assert.equal(f.title, raw.forms[i].formName);
    assert.equal(f.formTitle, raw.forms[i].formTitle);
    assert.equal(f.color, raw.forms[i].color);
    for (const k of Object.keys(raw.forms[i].lines)) assert.deepEqual(f.lines[k], raw.forms[i].lines[k], '第' + (i + 1) + '形態の ' + k);
  });
  assert.equal(d.skills.timed.name, raw.skills.timer.name);
  assert.equal(d.skills.curse.name, raw.skills.double.name);
  assert.deepEqual(d.ending, raw.lines.ending);
  assert.deepEqual(d.playerHeal, raw.lines.playerHeal);
  assert.deepEqual(d.forms[2].lines.defeat, raw.forms[2].lines.defeat);
  assert.deepEqual(d.forms[2].lines.evolve, [], '第3形態は進化しない');
});

test('g-kentei/data/trueboss.json: 長すぎるせりふ・ID・開発用の語が無い', () => {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const texts = [];
  raw.forms.forEach((f) => Object.values(f.lines).forEach((arr) => arr.forEach((t) => texts.push(t))));
  Object.values(raw.lines).forEach((arr) => arr.forEach((t) => texts.push(t)));
  Object.values(raw.skills).forEach((s) => texts.push(s.name));
  assert.ok(texts.length > 60);
  for (const t of texts) {
    assert.ok(t.length <= 40, '長すぎるせりふ: ' + t);
    assert.doesNotMatch(t, /(UC|SCR|TST|LAW)-|§|MVP|未実装|TODO/, '開発用の語: ' + t);
  }
});
