// ボスの名前・せりふのデータ（data/bosses.json）の読み込みと、無い・壊れているときの汎用への切り替えの検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBosses, bossProfile, pickLine, quoted, faceCrop, loadBosses, GENERIC_LINES, LINE_KINDS, DEFAULT_COLOR } from '../js/lib/bossdata.js';

const B = (over = {}) => ({
  no: 1, stageKey: '大|中', name: '真空管の番人', title: '二つ名', color: '#1565C0',
  lines: { appear: ['来たか'], attack: ['くらえ'], hurt: ['ぐう'], defeat: ['無念'] }, ...over,
});

test('形: 正しい1件はそのまま使える。形が崩れた1件・同じ章の2件目・名前の無い1件は捨てる', () => {
  const out = normalizeBosses([B(), null, 5, 'x', B({ name: '重複' }), B({ stageKey: 'a|b', name: '  ' }), B({ stageKey: '', name: 'x' }), B({ stageKey: 'c|d', name: '二番目' })]);
  assert.deepEqual(out.map((b) => b.stageKey), ['大|中', 'c|d']);
  assert.equal(out[0].name, '真空管の番人'); // 先のものを使う
  assert.deepEqual(out[0].lines, { appear: ['来たか'], attack: ['くらえ'], hurt: ['ぐう'], defeat: ['無念'] });
});

test('配列でないもの・壊れた中身は空。{ bosses: [...] } の形も読む', () => {
  for (const bad of [null, undefined, 'x', 5, {}, { bosses: 'x' }, true]) assert.deepEqual(normalizeBosses(bad), [], String(bad));
  assert.equal(normalizeBosses({ bosses: [B()] }).length, 1);
});

test('色・番号・せりふの壊れた値は、その項目だけ捨てる（ボスそのものは残る）', () => {
  const [a] = normalizeBosses([B({ color: 'red', no: 0 })]);
  assert.equal(a.color, null);
  assert.equal(a.no, null);
  const [b] = normalizeBosses([B({ color: '#abc', no: 1.5 })]);
  assert.equal(b.color, null);
  assert.equal(b.no, null);
  const [c] = normalizeBosses([B({ lines: { appear: ['ok', 3, '', '  ', null], attack: 'x' } })]);
  assert.deepEqual(c.lines, { appear: ['ok'], attack: [], hurt: [], defeat: [] });
  const [d] = normalizeBosses([B({ lines: null, title: 5 })]);
  assert.deepEqual(d.lines, { appear: [], attack: [], hurt: [], defeat: [] });
  assert.equal(d.title, '');
});

test('その章のボス: データにあればその名前・色・せりふ。せりふが空の種類だけ汎用で埋める', () => {
  const list = normalizeBosses([B({ lines: { appear: ['来たか'] } })]);
  const p = bossProfile(list, { key: '大|中', name: '章の名前' });
  assert.equal(p.generic, false);
  assert.equal(p.name, '真空管の番人');
  assert.equal(p.color, '#1565C0');
  assert.deepEqual(p.lines.appear, ['来たか']);
  for (const k of ['attack', 'hurt', 'defeat']) assert.deepEqual(p.lines[k], GENERIC_LINES[k], k);
  const noColor = bossProfile(normalizeBosses([B({ color: 'x' })]), { key: '大|中', name: '章' });
  assert.equal(noColor.color, DEFAULT_COLOR);
});

test('その章が無い・データが無い・壊れている: 「（章の名前）の ボス」と汎用のせりふ', () => {
  const list = normalizeBosses([B()]);
  for (const bosses of [list, [], undefined, null, 'x']) {
    const p = bossProfile(bosses, { key: '別|章', name: 'AIの歴史' });
    assert.equal(p.generic, true);
    assert.equal(p.name, 'AIの歴史の ボス');
    assert.equal(p.no, null);
    for (const k of LINE_KINDS) assert.ok(p.lines[k].length >= 1, k);
  }
  assert.equal(bossProfile([], null).name, 'の ボス'); // 章が分からなくても落ちない
});

test('せりふの選び方: 乱数で1つ選ぶ。範囲外の乱数・空のせりふでも落ちない', () => {
  const p = { lines: { appear: ['a', 'b', 'c'], attack: [], hurt: ['h'], defeat: ['d'] } };
  assert.equal(pickLine(p, 'appear', () => 0), 'a');
  assert.equal(pickLine(p, 'appear', () => 0.34), 'b');
  assert.equal(pickLine(p, 'appear', () => 0.99), 'c');
  assert.equal(pickLine(p, 'appear', () => 1), 'c');
  assert.equal(pickLine(p, 'appear', () => -3), 'a');
  assert.equal(pickLine(p, 'appear', () => NaN), 'a');
  assert.equal(pickLine(p, 'attack', () => 0), GENERIC_LINES.attack[0]); // 空の種類は汎用
  assert.equal(pickLine(null, 'defeat', () => 0), GENERIC_LINES.defeat[0]);
  assert.equal(pickLine(p, 'nothing', () => 0), ''); // 知らない種類は空
});

test('窓に出すせりふの形: 「」『』 で始まっていればそのまま、そうでなければ 「」 で囲む。空は空', () => {
  assert.equal(quoted('来たか'), '「来たか」');
  assert.equal(quoted('「来たか」'), '「来たか」');
  assert.equal(quoted('『来たか』'), '『来たか』');
  assert.equal(quoted(''), '');
  assert.equal(quoted(null), '');
});

test('丸の切り抜き: 正方形の全身は幅250%・左へ75%・上へ7.5%（顔が丸の真ん中）。縦長ほど少し大きく、上限 3.5。壊れた寸法は拡大しない', () => {
  assert.deepEqual(faceCrop(512, 512), { zoom: 2.5, tx: -0.75, ty: -0.075 });
  assert.deepEqual(faceCrop(400, 300), { zoom: 2.5, tx: -0.75, ty: -0.075 });
  assert.equal(faceCrop(320, 368).zoom, 2.5); // 1.15 まで
  assert.ok(faceCrop(1000, 1500).zoom > 2.5 && faceCrop(1000, 1500).zoom < 3.5);
  assert.equal(faceCrop(1000, 9000).zoom, 3.5);
  // どの寸法でも、顔の中心（幅の50%・上から23%）が丸の真ん中（0.5, 0.5）に来る
  for (const [w, h] of [[512, 512], [1000, 1500], [1000, 2500]]) {
    const c = faceCrop(w, h);
    assert.ok(Math.abs(0.5 * c.zoom + c.tx - 0.5) < 1e-3 && Math.abs(0.23 * c.zoom + c.ty - 0.5) < 1e-3, w + 'x' + h);
  }
  for (const [w, h] of [[0, 100], [100, 0], [NaN, 5], [-1, 5], [undefined, undefined]]) assert.deepEqual(faceCrop(w, h), { zoom: 1, tx: 0, ty: 0 });
});

test('読み込み: 404・通信エラー・壊れた JSON は空配列（落ちない）。壊れた JSON だけ理由が付く', async () => {
  const ok = (v) => async () => ({ ok: true, json: async () => v });
  assert.equal((await loadBosses('u', ok([B()]))).bosses.length, 1);
  assert.deepEqual(await loadBosses('u', async () => ({ ok: false, status: 404 })), { bosses: [], reason: null });
  assert.deepEqual(await loadBosses('u', async () => { throw new Error('offline'); }), { bosses: [], reason: null });
  const broken = await loadBosses('u', async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }));
  assert.deepEqual(broken.bosses, []);
  assert.ok(broken.reason);
  assert.deepEqual((await loadBosses('u', ok({ not: 'array' }))).bosses, []);
});
