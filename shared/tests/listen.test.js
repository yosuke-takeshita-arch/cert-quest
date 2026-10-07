// 聞き流し: 読み方への整形、読み上げる文の並び、読む順、設定の既定値と保存の互換、画面・オフライン登録との突き合わせ。
// 実行: cd shared && node --test tests/listen.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toSpeechText, splitSpeech, cardSegments, questionSegments, buildPlaylist, listenChapters, pickJaVoice,
  normalizeListenRate, normalizeListenPause, normalizeListenSettings, MAX_SPEAK_CHARS,
} from '../js/lib/listen.js';
import { buildTree } from '../js/lib/data.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { createStorage } from '../js/lib/storage.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// ---- 整形 ----
test('整形: 記号を読み方に置き換える', () => {
  assert.equal(toSpeechText('A→B'), 'AからB');
  assert.equal(toSpeechText('3×4'), '3かける4');
  assert.equal(toSpeechText('8÷2'), '8わる2');
  assert.equal(toSpeechText('x＝y'), 'xはy');
  assert.equal(toSpeechText('50％'), '50パーセント');
  assert.equal(toSpeechText('50%'), '50パーセント');
  assert.equal(toSpeechText('①と②'), '1番と2番');
  assert.equal(toSpeechText('⑨'), '9番');
  assert.equal(toSpeechText('1.5倍'), '1点5倍');
  assert.equal(toSpeechText('−3'), 'マイナス3');
  assert.equal(toSpeechText('1/2'), '2分の1');
  assert.equal(toSpeechText('α と β'), 'アルファ と ベータ');
  assert.equal(toSpeechText('x²'), 'xの2乗');
  assert.equal(toSpeechText('20℃'), '20度');
  assert.equal(toSpeechText('は-1から+1の値'), 'はマイナス1からプラス1の値');
  assert.equal(toSpeechText('Mini-Max法'), 'Mini-Max法');
  assert.equal(toSpeechText('2024-10-07'), '2024-10-07');
  assert.equal(toSpeechText('a≠b'), 'aイコールではないb');
  assert.equal(toSpeechText('V(s)'), 'V s');
  assert.equal(toSpeechText('1〜3回'), '1から3回');
  assert.equal(toSpeechText('4月〜6月'), '4月から6月');
  assert.equal(toSpeechText('理由は〜。'), '理由は。');
  assert.equal(toSpeechText('〜を使う'), 'を使う');
  assert.equal(toSpeechText('Aは〜（略）'), 'Aは、略、');
});

test('整形: かぎ括弧は外し、丸括弧の中の英語の略語はそのまま残す', () => {
  assert.equal(toSpeechText('「経営戦略」の観点'), '経営戦略の観点');
  const t = toSpeechText('人工知能（AI）は');
  assert.ok(t.includes('AI'));
  assert.ok(!/[（）()]/.test(t));
  assert.ok(toSpeechText('GPU（Graphics Processing Unit）').includes('Graphics Processing Unit'));
});

test('整形: 空欄（ア＿＿）は「アの空欄」、数式でない小数点でない点は触らない', () => {
  assert.equal(toSpeechText('（ア＿＿）を避け'), 'アの空欄を避け');
  assert.equal(toSpeechText('Ver. 3 です'), 'Ver. 3 です');
  assert.equal(toSpeechText('AIの歴史。次の文。'), 'AIの歴史。次の文。');
});

test('整形: 空・null でも落ちない／同じ入力は同じ出力（純粋）', () => {
  assert.equal(toSpeechText(''), '');
  assert.equal(toSpeechText(null), '');
  assert.equal(toSpeechText(undefined), '');
  assert.equal(toSpeechText('A→B×C'), toSpeechText('A→B×C'));
});

test('整形: 実データで「〜」の後ろが句読点・括弧・文末のものは「から」にならない', () => {
  let omitted = 0;
  let range = 0;
  for (const app of ['g-kentei', 'dx-biz']) {
    const idx = JSON.parse(read(app + '/data/index.json'));
    for (const f of [...idx.questions, ...idx.concepts]) {
      for (const o of JSON.parse(read(app + '/data/' + f))) {
        const texts = [o.stem, o.explanation, o.title, o.oneLine, o.why, ...(o.choices || [])].filter((x) => typeof x === 'string');
        for (const t of texts) {
          for (const m of t.matchAll(/[〜～]/g)) {
            const next = t[m.index + 1];
            const before = t.slice(Math.max(0, m.index - 6), m.index).replace(/[〜～]/g, '');
            const one = toSpeechText(before + m[0] + (next || ''));
            if (next === undefined || /[\s。、，,！？!?「」『』（）()]/.test(next)) { omitted++; assert.ok(!one.includes('から'), '省略の〜が「から」になった: ' + t.slice(Math.max(0, m.index - 10), m.index + 10)); } else range++;
          }
        }
      }
    }
  }
  console.log('〜 省略の使い方 ' + omitted + '件、範囲の使い方 ' + range + '件');
});

test('整形: 実データの頻出記号のあとに、読みにくい記号が残らない', () => {
  for (const app of ['g-kentei', 'dx-biz']) {
    const idx = JSON.parse(read(app + '/data/index.json'));
    const left = new Map();
    for (const f of [...idx.questions, ...idx.concepts]) {
      for (const o of JSON.parse(read(app + '/data/' + f))) {
        const texts = [o.stem, o.explanation, o.title, o.oneLine, o.why, ...(o.choices || [])].filter((x) => typeof x === 'string');
        for (const t of texts) for (const ch of toSpeechText(t)) if (/[→×÷＝＋％①-⑨＿「」『』（）√²≒±℃〜～]/.test(ch)) left.set(ch, (left.get(ch) || 0) + 1);
      }
    }
    assert.deepEqual([...left.entries()], [], app + ' に残った記号');
  }
});

// ---- 分割 ----
test('分割: 文末で切る。長い文は読点で、それでも長ければ上限で切る。どの1回も上限を超えない', () => {
  assert.deepEqual(splitSpeech('一つ目。二つ目！三つ目？'), ['一つ目。', '二つ目！', '三つ目？']);
  const longClause = 'あ'.repeat(MAX_SPEAK_CHARS + 30);
  const parts = splitSpeech('前置き、' + longClause + '、おわり。');
  assert.ok(parts.length >= 3);
  for (const p of parts) assert.ok(p.length <= MAX_SPEAK_CHARS, p.length + '文字');
  assert.equal(parts.join(''), '前置き、' + longClause + '、おわり。');
  assert.deepEqual(splitSpeech(''), []);
});

// ---- 読み上げる順 ----
const card = { id: 'C-1', title: 'ディープラーニング', oneLine: '多層のニューラルネットワークで学ぶ手法。', why: '困りごと：特徴を人が作るのが大変。押さえどころ：層を重ねる。' };
const q = { id: 'Q-1', stem: '次のうち正しいものはどれか。', choices: ['甲の説明', '乙の説明', '丙の説明', '丁の説明'], answer: 2, explanation: '丙が正しい。理由は〜。' };

test('順番（カード）: 題名 → 一言で言うと → 背景とポイント（見出しの語を1回ずつ挟む）', () => {
  const t = cardSegments(card).map((s) => s.text);
  assert.deepEqual(t.slice(0, 4), ['ディープラーニング', '一言で言うと。', '多層のニューラルネットワークで学ぶ手法。', '背景とポイント。']);
  assert.ok(t.slice(4).join('').includes('層を重ねる'));
  assert.ok(cardSegments(card).every((s) => typeof s.text === 'string' && !('pause' in s)));
});

test('順番（カード）: 一言・背景が無ければ題名だけ', () => {
  const t = cardSegments({ id: 'C-2', title: '題名だけ', oneLine: '', why: '' }).map((s) => s.text);
  assert.deepEqual(t, ['題名だけ']);
});

const flatOf = (seg) => seg.map((s) => (s.pause ? '<' + s.pause + '>' : s.text));

test('順番（問題）: 問題文 → A〜D → 考える間 → 正解は → 解説', () => {
  const seg = questionSegments(q, 10);
  assert.deepEqual(flatOf(seg), [
    '問題。', '次のうち正しいものはどれか。',
    'A。', '甲の説明', 'B。', '乙の説明', 'C。', '丙の説明', 'D。', '丁の説明',
    '<10>',
    '正解は、C。', '丙の説明',
    '解説。', '丙が正しい。', '理由は。',
  ]);
  assert.equal(seg.filter((s) => s.pause).length, 1);
});

test('順番（問題）: 考える間は設定の秒。知らない値は5秒。解説が無ければ正解で終わる', () => {
  assert.equal(questionSegments(q, 3).find((s) => s.pause).pause, 3);
  assert.equal(questionSegments(q, 7).find((s) => s.pause).pause, 5);
  assert.deepEqual(flatOf(questionSegments({ ...q, explanation: '' }, 5)).slice(-2), ['正解は、C。', '丙の説明']);
});

test('順番（問題）: 長い解説は、どの1回も上限を超えない', () => {
  const seg = questionSegments({ ...q, explanation: ('これは長い文です、' + 'あ'.repeat(40) + '。').repeat(6) }, 5);
  for (const s of seg) if (s.text) assert.ok(s.text.length <= MAX_SPEAK_CHARS);
});

// ---- 読む順の一覧 ----
function sample() {
  const mk = (id, syl) => ({ id, title: id, syllabus: syl, oneLine: '', why: '' });
  const mq = (id, syl) => ({ id, syllabus: syl, stem: id, choices: ['a', 'b'], answer: 0, explanation: '' });
  const concepts = [mk('c3', ['大', '二章']), mk('c1', ['大', '一章']), mk('c2', ['大', '一章']), mk('c0', [])];
  const questions = [mq('q2', ['大', '二章']), mq('q1', ['大', '一章'])];
  const tree = buildTree({ tree: [{ name: '大', children: [{ name: '一章' }, { name: '二章' }] }] }, questions, concepts);
  return { concepts, questions, tree };
}

test('読む順: 全部は章の順（一章 → 二章）。章に入らないカードは最後', () => {
  const { concepts, questions, tree } = sample();
  const ids = buildPlaylist({ kind: 'card', tree, concepts, questions }).map((e) => e.id);
  assert.deepEqual(ids, ['c1', 'c2', 'c3', 'c0']);
  assert.deepEqual(buildPlaylist({ kind: 'question', tree, concepts, questions }).map((e) => e.id), ['q1', 'q2']);
});

test('読む順: 章を選ぶと、選んだ章だけ。選んだ順ではなく章の順。章に入らないものは入れない', () => {
  const { concepts, questions, tree } = sample();
  const k1 = tree.stages[0].key;
  const k2 = tree.stages[1].key;
  assert.deepEqual(buildPlaylist({ kind: 'card', tree, concepts, questions, chapters: [k2] }).map((e) => e.id), ['c3']);
  assert.deepEqual(buildPlaylist({ kind: 'card', tree, concepts, questions, chapters: [k2, k1] }).map((e) => e.id), ['c1', 'c2', 'c3']);
});

test('読む順: シャッフルは件数と中身を変えず、乱数で並びを変える', () => {
  const { concepts, questions, tree } = sample();
  const a = buildPlaylist({ kind: 'card', tree, concepts, questions, shuffle: true, rng: () => 0 }).map((e) => e.id);
  assert.deepEqual([...a].sort(), ['c0', 'c1', 'c2', 'c3']);
  assert.notDeepEqual(a, ['c1', 'c2', 'c3', 'c0']);
});

test('章の一覧: 聞く種類が1件でもある章だけ（件数つき）', () => {
  const { tree } = sample();
  assert.deepEqual(listenChapters(tree, 'card').map((c) => [c.name, c.count]), [['一章', 2], ['二章', 1]]);
  assert.deepEqual(listenChapters(tree, 'question').map((c) => [c.name, c.count]), [['一章', 1], ['二章', 1]]);
});

// ---- 声の選び方 ----
test('声: lang が ja で始まるものを選ぶ。端末の中の声を優先。無ければ null', () => {
  const v = (lang, o = {}) => ({ lang, name: lang, localService: false, default: false, ...o });
  assert.equal(pickJaVoice([v('en-US'), v('ja-JP', { name: 'x' })]).name, 'x');
  assert.equal(pickJaVoice([v('ja_JP', { name: 'under' })]).name, 'under');
  assert.equal(pickJaVoice([v('ja-JP', { name: 'net' }), v('ja-JP', { name: 'local', localService: true })]).name, 'local');
  assert.equal(pickJaVoice([v('en-US'), v('jav-ID')]), null); // ジャワ語（jav）は日本語ではない
  assert.equal(pickJaVoice([]), null);
  assert.equal(pickJaVoice(undefined), null);
});

// ---- 設定 ----
test('設定: 読む速さは0.8〜1.5・0.1刻み、考える間は3・5・10', () => {
  assert.equal(normalizeListenRate(1), 1);
  assert.equal(normalizeListenRate('1.2'), 1.2);
  assert.equal(normalizeListenRate(0.5), 0.8);
  assert.equal(normalizeListenRate(9), 1.5);
  assert.equal(normalizeListenRate(1.04), 1);
  assert.equal(normalizeListenRate('abc'), 1);
  assert.equal(normalizeListenRate(NaN), 1);
  assert.equal(normalizeListenRate(undefined), 1);
  assert.equal(normalizeListenPause(3), 3);
  assert.equal(normalizeListenPause('10'), 10);
  assert.equal(normalizeListenPause(7), 5);
  assert.equal(normalizeListenPause(null), 5);
});

test('設定: 既定値（速さ1・考える間5秒・画面を消さないはオフ）', () => {
  const s = defaultState().settings;
  assert.equal(s.listenRate, 1);
  assert.equal(s.listenPause, 5);
  assert.equal(s.listenKeepAwake, false);
});

test('保存の互換: 古い記録（項目なし）は初期値で補い、ほかの設定・記録を壊さない。壊れた値は直す', () => {
  const old = defaultState();
  delete old.settings.listenRate;
  delete old.settings.listenPause;
  delete old.settings.listenKeepAwake;
  old.xp = 120;
  old.settings.theme = 'dark';
  old.settings.dailyGoal = 20;
  old.badges = { 'first-answer': '2026-10-01' };
  const m = mergeState(JSON.parse(JSON.stringify(old)));
  assert.equal(m.settings.listenRate, 1);
  assert.equal(m.settings.listenPause, 5);
  assert.equal(m.settings.listenKeepAwake, false);
  assert.equal(m.xp, 120);
  assert.equal(m.settings.theme, 'dark');
  assert.equal(m.settings.dailyGoal, 20);
  assert.deepEqual(m.badges, { 'first-answer': '2026-10-01' });
  const bad = mergeState({ settings: { listenRate: 'はやい', listenPause: 99, listenKeepAwake: 'yes' } });
  assert.deepEqual([bad.settings.listenRate, bad.settings.listenPause, bad.settings.listenKeepAwake], [1, 5, false]);
  const o = normalizeListenSettings({ listenRate: 1.3, listenPause: 10, listenKeepAwake: true });
  assert.deepEqual(o, { listenRate: 1.3, listenPause: 10, listenKeepAwake: true });
});

test('保存の互換: 保存して読み直しても、書き出して読み込んでも同じ', () => {
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const st = createStorage('t:listen', ls);
  const s = st.load();
  s.settings.listenRate = 1.4;
  s.settings.listenPause = 10;
  s.settings.listenKeepAwake = true;
  st.save(s);
  const back = st.load();
  assert.deepEqual([back.settings.listenRate, back.settings.listenPause, back.settings.listenKeepAwake], [1.4, 10, true]);
  const r = parseBackup(serializeBackup('x', back, new Date('2026-10-07T00:00:00Z')), 'x');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.state.settings.listenRate, r.state.settings.listenPause, r.state.settings.listenKeepAwake], [1.4, 10, true]);
});

// ---- 画面・オフライン登録 ----
test('オフライン登録: 聞き流しの JS 3本が sw-core.js の先取りに載っている', () => {
  const sw = read('shared/sw-core.js');
  for (const f of ['js/views/listen.js', 'js/listen-player.js', 'js/lib/listen.js']) assert.ok(sw.includes("'../shared/" + f + "'"), f);
});

test('入口: ルート・「もっと」・ホームから行ける。再生中は BGM を止める', () => {
  assert.ok(/\['listen', 'more', \(\) => renderListen\(app\)\]/.test(read('shared/js/app.js')));
  assert.ok(read('shared/js/views/more.js').includes("'#/listen'"));
  assert.ok(read('shared/js/views/home.js').includes("'#/listen'"));
  const v = read('shared/js/views/listen.js');
  assert.ok(v.includes('setBgmSuppressed(active)') && v.includes('setBgmSuppressed(false)'));
  assert.ok(/if \(B\.suppressed\) return null;/.test(read('shared/js/audio.js')));
});
