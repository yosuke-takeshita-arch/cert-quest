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

// ---- 第1形態の殻のひび（絵の上の位置。絵の幅・高さに対する割合 0〜100）----
import { TRUE_CORE, TRUE_EYE, TRUE_CRACKS } from '../js/lib/trueboss-data.js';

test('ひびの位置: 胸の核から出て、体の上（絵の不透明な範囲の中）に収まる。4本とも核を始点にする', () => {
  // true-1.webp（512×512）の実測: 水色のひし形（核）の重心 (49.7, 37.5)、一つ目の重心 (49.9, 19.7)、不透明な範囲 x 8.2〜95.7・y 3.5〜96.9
  assert.deepEqual([TRUE_CORE.x, TRUE_CORE.y], [49.7, 37.5]);
  assert.ok(Math.abs(TRUE_EYE.x - 49.9) < 0.5 && Math.abs(TRUE_EYE.y - 19.7) < 0.5);
  assert.equal(TRUE_CRACKS.length, 4);
  for (const d of TRUE_CRACKS) {
    assert.match(d, /^M49\.7 37\.5( L[0-9.]+ [0-9.]+)+$/, '核から始まる折れ線: ' + d);
    const pts = [...d.matchAll(/([0-9.]+) ([0-9.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    assert.ok(pts.length >= 5, '折れ曲がりが少ない: ' + d);
    for (const [x, y] of pts) {
      assert.ok(x >= 20 && x <= 80, 'x が体の外: ' + x);
      assert.ok(y >= 30 && y <= 70, 'y が胸〜腹の外: ' + y); // 頭（y < 25）や脚（y > 75）には出さない
    }
  }
  // 1本目・2本目は下へ、3本目・4本目は肩のほうへ広がる（左右に分かれる）
  const end = (d) => d.split(' L').pop().split(' ').map(Number);
  assert.ok(end(TRUE_CRACKS[0])[0] < TRUE_CORE.x && end(TRUE_CRACKS[1])[0] > TRUE_CORE.x);
  assert.ok(end(TRUE_CRACKS[2])[0] < TRUE_CORE.x && end(TRUE_CRACKS[3])[0] > TRUE_CORE.x);
  assert.ok(end(TRUE_CRACKS[0])[1] > TRUE_CORE.y + 20 && end(TRUE_CRACKS[2])[1] < TRUE_CORE.y + 5);
});

// ---- 進化の時刻の表（要件定義書 §3-9『進化のタメと第3形態の最強感』）----
import { EVO_1_TO_2, EVO_2_TO_3, TRUE_ORBS, orbTimes } from '../js/lib/trueboss-data.js';

test('進化の時刻（第1→2）: 順番どおり。鼓動はだんだん速く、揺れは後ろのほど強く、ひびは1本ずつゆっくり。割れて替わるまで約 8〜10 秒', () => {
  const T = EVO_1_TO_2;
  const inc = (a) => a.every((v, i) => i === 0 || v > a[i - 1]);
  assert.ok(inc(T.glowBlink) && inc(T.heartbeats) && inc(T.quakes) && inc(T.eyeBlinks) && inc(T.cracks));
  // 順番: 光る → 沈む → 鼓動・地鳴り → 目がまたたく → 目が強く光る → 揺れる → ひび → 割れる → 替わる → せりふ
  const seq = [T.glowBlink.at(-1), T.slump, T.defeatText, T.heartbeats[0], T.rumble, T.eyeBlinks[0], T.eyeStrong, T.shake, T.cracks[0], T.cracks.at(-1), T.shatter, T.swap, T.text];
  seq.forEach((v, i) => { if (i) assert.ok(v >= seq[i - 1], i + ' 番目の時刻が前より早い'); });
  // 鼓動の間隔がだんだん短くなる（だんだん速く）
  const gaps = T.heartbeats.slice(1).map((v, i) => v - T.heartbeats[i]);
  gaps.forEach((g, i) => { if (i) assert.ok(g < gaps[i - 1], '鼓動が速くなっていない: ' + gaps); });
  assert.equal(T.heartbeats.length, 6);
  // 目は3回またたいてから、強く光る
  assert.equal(T.eyeBlinks.length, 3);
  assert.ok(T.eyeBlinks.at(-1) < T.eyeStrong);
  // ひびは4本。1本ずつゆっくり（間隔 450ms 以上）
  assert.equal(T.cracks.length, 4);
  T.cracks.slice(1).forEach((v, i) => assert.ok(v - T.cracks[i] >= 450, 'ひびの間隔が短い'));
  assert.ok(T.cracks[0] > T.shake && T.shatter - T.cracks.at(-1) >= 400, '最後のひびのあと、少し間を置いて割れる');
  // 揺れは4つ目から強い。姿が替わるまで 8〜10 秒
  assert.equal(T.strongQuakeFrom, 3);
  assert.ok(T.swap >= 8000 && T.swap <= 10000, '姿が替わる時刻 ' + T.swap);
  assert.ok(T.text > T.swap && T.text - T.swap <= 500);
});

test('進化の時刻（第2→3）: 玉は1つずつ灯り、だんだん速く（間隔が縮む）。力をためる音は玉の途中から、揺れはだんだん強く、金色の光のあとに替わり、曲は決めぜりふのあと。約 7〜10 秒', () => {
  const T = EVO_2_TO_3;
  const times = orbTimes();
  assert.equal(times.length, TRUE_ORBS.length);
  assert.equal(times[0], T.orbStart);
  times.slice(1).forEach((v, i) => assert.ok(v > times[i]));
  const gaps = times.slice(1).map((v, i) => v - times[i]);
  gaps.forEach((g, i) => { if (i) assert.ok(g < gaps[i - 1], '玉が速くなっていない: ' + gaps); });
  assert.equal(T.orbGaps.length, TRUE_ORBS.length - 1);
  assert.ok(T.charge > T.orbStart && T.charge < times.at(-1), '力をためる音は、玉が灯っている途中から');
  assert.ok(T.quakes[0] > T.orbStart && T.quakes.every((v, i) => !i || v > T.quakes[i - 1]));
  assert.equal(T.strongQuakeFrom, 4);
  assert.ok(T.quakes.at(-1) < T.gold && times.at(-1) < T.gold, '全部灯ってから、金色の光が弾ける');
  assert.ok(T.gold < T.swap && T.swap < T.text && T.text < T.music, '光 → 姿が替わる → 決めぜりふ → 曲');
  assert.ok(T.swap >= 6500 && T.swap <= 10000 && T.music <= 10000, '姿が替わる ' + T.swap + '、曲 ' + T.music);
  assert.equal(T.dim, 0);
  assert.equal(T.still, 0);
});

test('光の玉の位置: 第2形態の頭のうしろの輪。頭の上を回る形で、左右対称に近く、体の外（y が小さい）にある。玉どうしは重ならない', () => {
  assert.equal(TRUE_ORBS.length, 13); // 絵の玉は10個ではなく13個だった（設計は10個。玉の数は TRUE_ORBS の長さで決まる）
  for (const o of TRUE_ORBS) {
    assert.ok(o.x > 38 && o.x < 62 && o.y > 4 && o.y < 24, '輪の外: ' + o.x + ',' + o.y);
    assert.ok(o.r >= 1.2 && o.r <= 2);
  }
  // 輪の中心 (50, 13) からの距離がそろっている（最上部の玉と、左右の玉の差が小さい）
  const d = TRUE_ORBS.map((o) => Math.hypot((o.x - 50) * 1.0, (o.y - 13) * 1.15));
  assert.ok(Math.max(...d) - Math.min(...d) < 4, '輪の形から外れている: ' + d.map((v) => v.toFixed(1)));
  // 左右対称（x が 50 をはさんで対）
  const xs = TRUE_ORBS.map((o) => o.x).sort((a, b) => a - b);
  assert.ok(Math.abs((xs[0] + xs.at(-1)) / 2 - 50) < 1.5);
  // 重ならない
  for (let i = 0; i < TRUE_ORBS.length; i++) for (let j = i + 1; j < TRUE_ORBS.length; j++) assert.ok(Math.hypot(TRUE_ORBS[i].x - TRUE_ORBS[j].x, TRUE_ORBS[i].y - TRUE_ORBS[j].y) > 2.5, i + '-' + j);
});

import { orbRate, ORB_SEMITONES } from '../js/lib/trueboss-data.js';

test('光の玉が灯る音の高さ（再生速度）: 13個とも、1つごとに高くなる。いちばん低い音は 0.85 倍。範囲外・壊れた番号でも落ちない。力をためる音は、玉が灯り終わる前から鳴り、金色の光の直前に高まる', () => {
  assert.equal(ORB_SEMITONES.length, TRUE_ORBS.length);
  const rates = TRUE_ORBS.map((_, i) => orbRate(i));
  assert.equal(rates[0], 0.85);
  rates.forEach((r, i) => { if (i) assert.ok(r > rates[i - 1], 'orb' + i + ' が前より高くない'); });
  assert.ok(rates.at(-1) > 2.5 && rates.at(-1) < 3.5, String(rates.at(-1)));
  assert.equal(orbRate(-3), 0.85);
  assert.equal(orbRate(99), rates.at(-1));
  assert.equal(orbRate(NaN), 0.85);
  // 力をためる音（約3.2秒。ふくらむのは約1.4〜1.8秒）が、金色の光（gold）の直前に高まる
  const peak = EVO_2_TO_3.charge + 1600;
  assert.ok(peak < EVO_2_TO_3.gold && EVO_2_TO_3.gold - peak < 1500, '力をためる音の山が金色の光の直前に来ない: ' + (EVO_2_TO_3.gold - peak));
  assert.equal(EVO_1_TO_2.heartbeatFastFrom, 3, '鼓動の前半3回は遅い素材・後半3回は速い素材');
});
