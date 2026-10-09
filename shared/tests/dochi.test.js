// 「どっち？」早押しの伏せ方・出題・記録の検証。ブラウザ無しで node から叩く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  titleTerms, maskOneLine, buildPairs, pickRound, isCorrect, nextCombo, normalizeDochi, recordDochi,
  DOCHI_ROUNDS, DOCHI_SECONDS, DOCHI_POINT_MS, DOCHI_MASK,
} from '../js/lib/dochi.js';
import { buildConceptIndex } from '../js/lib/data.js';
import { defaultState, mergeState } from '../js/lib/progress.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('決まり: 20問・5秒・違いは2秒', () => {
  assert.equal(DOCHI_ROUNDS, 20);
  assert.equal(DOCHI_SECONDS, 5);
  assert.equal(DOCHI_POINT_MS, 2000);
});

// ---- 伏せ方 ----

test('題名の分け方: 「A・B」「AとB」「A／B」は1語ずつ', () => {
  assert.deepEqual(titleTerms('データマイニング・ウェブマイニング').sort(), ['ウェブマイニング', 'データマイニング']);
  assert.deepEqual(titleTerms('強いAIと弱いAI').sort(), ['弱いAI', '強いAI']);
  assert.deepEqual(titleTerms('CIO／CDO').sort(), ['CDO', 'CIO']);
  assert.deepEqual(titleTerms('CIO/CDO').sort(), ['CDO', 'CIO']);
});

test('題名の分け方: 括弧つきの別名は、外と中の両方（全角・半角の括弧とも）', () => {
  assert.deepEqual(titleTerms('ディープラーニング（深層学習）').sort(), ['ディープラーニング', '深層学習'].sort());
  assert.deepEqual(titleTerms('主成分分析 (PCA)').sort(), ['PCA', '主成分分析']);
});

test('題名の分け方: 長い語が先。1文字の語は伏せない。「の違い」「の関係」の語尾は外した語も伏せる', () => {
  const t = titleTerms('人工知能とロボットの違い');
  assert.deepEqual(t, ['ロボットの違い', '人工知能', 'ロボット']);
  assert.equal(titleTerms('AとB').length, 0);
  assert.deepEqual(titleTerms('is-aの関係・has-aの関係'), ['has-aの関係', 'is-aの関係', 'has-a', 'is-a']);
});

test('伏せ方: 題名の語が「〇〇」になる。複数の語はそれぞれ', () => {
  const m = maskOneLine('強いAIと弱いAI', '強いAI：心を持つ立場。弱いAI：道具とみなす立場。');
  assert.equal(m.ok, true);
  assert.equal(m.text, DOCHI_MASK + '：心を持つ立場。' + DOCHI_MASK + '：道具とみなす立場。');
  assert.equal(m.masked, 2);
});

test('伏せ方: 括弧つきの別名は外も中も伏せる', () => {
  const m = maskOneLine('ディープラーニング（深層学習）', '深層学習とも呼ぶ。ディープラーニングは層を重ねる。');
  assert.equal(m.ok, true);
  assert.equal(m.text, DOCHI_MASK + 'とも呼ぶ。' + DOCHI_MASK + 'は層を重ねる。');
});

test('伏せ方: 英字は大文字小文字を問わず伏せ、別の英単語の一部は伏せない', () => {
  const m = maskOneLine('SVM', 'svm は境界を引く。RAINBOWSVMX は別物。');
  assert.equal(m.text, DOCHI_MASK + ' は境界を引く。RAINBOWSVMX は別物。');
  const ai = maskOneLine('AI', 'AIは考える。RAINは雨。');
  assert.equal(ai.text, DOCHI_MASK + 'は考える。RAINは雨。');
  assert.equal(ai.ok, true);
});

test('伏せ方: 題名の語が一行目に出てこなくても出せる（伏せるものが無いだけ）', () => {
  const m = maskOneLine('エキスパートシステム', '専門家の知識をルールにして推論する仕組み。');
  assert.equal(m.ok, true);
  assert.equal(m.masked, 0);
});

test('伏せきれないカードは出さない: 全角の英字など、置き換えで拾えない書き方が残る', () => {
  const m = maskOneLine('AI', 'ＡＩは考える。');
  assert.equal(m.ok, false);
  assert.equal(maskOneLine('SVM', 'ｓｖｍは境界を引く。').ok, false);
});

test('一行目が空なら出さない', () => {
  assert.equal(maskOneLine('X学習', '   ').ok, false);
});

// ---- 出せる組 ----

const C = (id, title, oneLine, confusions = []) => ({ id, title, oneLine, confusions, links: [], syllabus: [], figures: [], sources: [], status: 'verified', why: '' });
const concepts = [
  C('a', '強化学習', '強化学習は報酬を最大にする学び方。', [{ id: 'b', point: '教師あり学習は正解を与える' }, { id: 'GONE', point: '消えたカード' }, { id: 'a', point: '自分自身' }]),
  C('b', '教師あり学習', '正解つきのデータから学ぶ。', [{ id: 'a', point: '強化学習は報酬で学ぶ' }]),
  C('c', 'カードC', '', [{ id: 'a', point: 'x' }]),
  C('d', 'カードD', 'Dの説明。', [{ title: '強化学習', point: '題名で指す' }, { id: 'a', point: '同じ相手をもう一度' }]),
  C('e', 'AI', 'ＡＩの説明。', [{ id: 'a', point: 'x' }]),
  C('f', 'カードF', 'Fの説明。', [{ id: 'f2', point: 'x' }]),
  C('f2', 'カードＦ', 'F2の説明。', []),
];
const index = buildConceptIndex(concepts);

test('出せる組: 相手が存在しない・自分自身・一行目が空・伏せきれないものは出さない', () => {
  const { pairs, skipped } = buildPairs(concepts, index);
  assert.deepEqual(pairs.map((p) => p.key).sort(), ['a>b', 'b>a', 'd>a'].sort());
  assert.equal(skipped.noOpponent, 2); // GONE と 自分自身
  assert.equal(skipped.noOneLine, 1);
  assert.equal(skipped.leak, 1);
  assert.equal(skipped.sameTitle, 1); // 「カードF」と「カードＦ」は全角半角を揃えると同じ題名
});

test('出せる組: 伏せた文・題名・相手の題名・違いが入る。相手は題名でも引ける。同じ組は1つだけ', () => {
  const { pairs } = buildPairs(concepts, index);
  const ab = pairs.find((p) => p.key === 'a>b');
  assert.equal(ab.text, DOCHI_MASK + 'は報酬を最大にする学び方。');
  assert.equal(ab.title, '強化学習');
  assert.equal(ab.oppTitle, '教師あり学習');
  assert.equal(ab.point, '教師あり学習は正解を与える');
  assert.equal(pairs.filter((p) => p.key === 'd>a').length, 1);
  assert.equal(pairs.find((p) => p.key === 'd>a').oppTitle, '強化学習');
});

test('出せる組: confusions が無い・壊れていてもエラーにしない', () => {
  const odd = [{ id: 'z', title: 'Z学習', oneLine: 'Z', confusions: undefined }, { id: 'y', title: 'Y学習', oneLine: 'Y', confusions: [null, 5, {}] }];
  assert.deepEqual(buildPairs(odd, buildConceptIndex(odd)).pairs, []);
});

// ---- 出題 ----

const many = Array.from({ length: 30 }, (_, i) => ({ key: 'k' + i, id: 'c' + (i % 25), oppId: 'o' + i, title: 'T' + i, oppTitle: 'O' + i, text: '〇〇' + i, point: 'p' + i }));

test('出題: 20問。答えの位置が題名と合っている', () => {
  const round = pickRound(many, DOCHI_ROUNDS, seeded(7));
  assert.equal(round.length, 20);
  for (const it of round) {
    assert.equal(it.choices.length, 2);
    assert.equal(it.choices[it.answer], it.pair.title);
    assert.equal(it.choices[1 - it.answer], it.pair.oppTitle);
  }
});

test('出題: 同じカードはなるべく重ねない（足りるとき）。足りなければ重ねて出す', () => {
  const round = pickRound(many, 20, seeded(3));
  assert.equal(new Set(round.map((r) => r.pair.id)).size, 20);
  const few = many.slice(0, 3).map((p) => ({ ...p, id: 'same' }));
  assert.equal(pickRound(few, 20, seeded(1)).length, 3);
  assert.equal(pickRound([], 20).length, 0);
});

test('出題: 2つの並びが毎回ランダム（左も右も正解になる）', () => {
  const answers = new Set();
  for (let s = 1; s <= 10; s++) for (const it of pickRound(many, 20, seeded(s))) answers.add(it.answer);
  assert.deepEqual([...answers].sort(), [0, 1]);
});

test('出題: 元の配列を書き換えない', () => {
  const copy = many.map((p) => p.key);
  pickRound(many, 20, seeded(2));
  assert.deepEqual(many.map((p) => p.key), copy);
});

test('答え合わせ: 時間切れ（null）・範囲外・文字は不正解', () => {
  const it = { answer: 1 };
  assert.equal(isCorrect(it, 1), true);
  assert.equal(isCorrect(it, 0), false);
  assert.equal(isCorrect(it, null), false);
  assert.equal(isCorrect(it, undefined), false);
  assert.equal(isCorrect(it, '1'), false);
});

test('コンボ: 正解で伸び、不正解・時間切れで0に戻る', () => {
  let c = 0;
  const seq = [true, true, true, false, true];
  const got = seq.map((ok) => (c = nextCombo(c, ok)));
  assert.deepEqual(got, [1, 2, 3, 0, 1]);
});

// ---- 記録 ----

test('初期の記録は dochi が 0', () => {
  assert.deepEqual(defaultState().dochi, { runs: 0, best: 0, bestCombo: 0 });
});

test('古い記録（dochi の項目なし）を読める', () => {
  const old = defaultState();
  delete old.dochi;
  assert.deepEqual(mergeState(old).dochi, { runs: 0, best: 0, bestCombo: 0 });
  assert.deepEqual(mergeState({ xp: 5 }).dochi, { runs: 0, best: 0, bestCombo: 0 });
});

test('数でない値は捨てる（文字・null・負数・NaN・Infinity・配列・小数は切り捨て）', () => {
  for (const bad of [null, 'x', 5, [1, 2], undefined, true]) assert.deepEqual(normalizeDochi(bad), { runs: 0, best: 0, bestCombo: 0 }, String(bad));
  assert.deepEqual(normalizeDochi({ runs: 'a', best: -3, bestCombo: NaN }), { runs: 0, best: 0, bestCombo: 0 });
  assert.deepEqual(normalizeDochi({ runs: Infinity, best: null, bestCombo: {} }), { runs: 0, best: 0, bestCombo: 0 });
  assert.deepEqual(normalizeDochi({ runs: 3, best: 12.9, bestCombo: 7 }), { runs: 3, best: 12, bestCombo: 7 });
  assert.deepEqual(mergeState({ dochi: { runs: '9', best: 4 } }).dochi, { runs: 0, best: 4, bestCombo: 0 });
});

test('記録: 回数が増え、最高だけ更新する。更新したかを返す。XP と問題の記録には触らない', () => {
  const s = defaultState();
  const before = JSON.stringify({ xp: s.xp, qstats: s.qstats, totals: s.totals, challenge: s.challenge, daily: s.daily });
  assert.deepEqual(recordDochi(s, 12, 5), { newBest: true, newBestCombo: true });
  assert.deepEqual(s.dochi, { runs: 1, best: 12, bestCombo: 5 });
  assert.deepEqual(recordDochi(s, 9, 8), { newBest: false, newBestCombo: true });
  assert.deepEqual(s.dochi, { runs: 2, best: 12, bestCombo: 8 });
  assert.deepEqual(recordDochi(s, 12, 8), { newBest: false, newBestCombo: false });
  assert.deepEqual(recordDochi(s, 0, 0), { newBest: false, newBestCombo: false });
  assert.equal(s.dochi.runs, 4);
  assert.equal(JSON.stringify({ xp: s.xp, qstats: s.qstats, totals: s.totals, challenge: s.challenge, daily: s.daily }), before);
});

test('記録: dochi の無い state でも壊れない', () => {
  const s = {};
  recordDochi(s, 3, 2);
  assert.deepEqual(s.dochi, { runs: 1, best: 3, bestCombo: 2 });
});

test('バックアップ: dochi が書き出され、読み込みで戻る。壊れた値は読み込みで捨てる', () => {
  const s = defaultState();
  recordDochi(s, 15, 9);
  const r = parseBackup(serializeBackup('g-kentei', s), 'g-kentei');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.dochi, { runs: 1, best: 15, bestCombo: 9 });
  const text = JSON.stringify({ kind: 'cert-quest-backup', app: 'g-kentei', version: 1, state: { ...s, dochi: { runs: 'x', best: 7, bestCombo: -1 } } });
  assert.deepEqual(parseBackup(text, 'g-kentei').state.dochi, { runs: 0, best: 7, bestCombo: 0 });
});

test('バックアップ: dochi の無い古いファイルは0で読める', () => {
  const old = defaultState();
  delete old.dochi;
  const r = parseBackup(JSON.stringify({ kind: 'cert-quest-backup', app: 'dx-biz', version: 1, state: old }), 'dx-biz');
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.dochi, { runs: 0, best: 0, bestCombo: 0 });
});
