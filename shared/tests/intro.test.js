// 使い方の案内: 出すか出さないかの判定、案内の中身、保存データの正規化、オフライン登録・版の食い違い。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTRO_SLIDES, INTRO_TEXT, recordIsEmpty, needsIntro } from '../js/lib/intro.js';
import { isCharacterArt, characterName, CHARACTER_NAMES } from '../js/lib/characters.js';
import { defaultState, mergeState, recordAnswer } from '../js/lib/progress.js';
import { createStorage } from '../js/lib/storage.js';
import { parseBackup, serializeBackup } from '../js/lib/backup.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');

test('判定: 新しい人（記録が空・まだ見ていない）には出す', () => {
  assert.equal(needsIntro(defaultState()), true);
  assert.equal(recordIsEmpty(defaultState()), true);
});

test('判定: 見たあと（introSeen=true）は、記録が空でも出さない', () => {
  const s = defaultState();
  s.settings.introSeen = true;
  assert.equal(needsIntro(s), false);
});

test('判定: すでに学習記録がある人には出さない（1つずつ確かめる）', () => {
  const cases = {
    answered: (s) => { s.totals.answered = 1; },
    xp: (s) => { s.xp = 5; },
    qstats: (s) => { s.qstats.q1 = { seen: true }; },
    stages: (s) => { s.stages.s1 = { stars: 1, best: 0.5, runs: 1 }; },
    badges: (s) => { s.badges.first = '2026-10-01'; },
    exams: (s) => { s.exams.push({ date: '2026-10-01' }); },
  };
  for (const [name, f] of Object.entries(cases)) {
    const s = defaultState();
    f(s);
    assert.equal(recordIsEmpty(s), false, name + ' は空でない');
    assert.equal(needsIntro(s), false, name + ' があれば出さない');
  }
});

test('判定: 実際に1問答えた記録でも出さない', () => {
  const s = defaultState();
  recordAnswer(s, { id: 'q1' }, { correct: true, now: new Date('2026-10-05T09:00:00') });
  assert.equal(needsIntro(s), false);
});

test('判定: 読めない値は、出さない側に倒す（邪魔をしない）', () => {
  assert.equal(needsIntro(null), false);
  assert.equal(needsIntro(undefined), false);
  assert.equal(needsIntro('x'), false);
  assert.equal(recordIsEmpty(null), false);
});

test('保存: 初期値は introSeen=false。true 以外（文字・数・欠け）は false に正される。true は残る', () => {
  assert.equal(defaultState().settings.introSeen, false);
  assert.equal(mergeState({}).settings.introSeen, false);
  assert.equal(mergeState({ settings: { introSeen: 'yes' } }).settings.introSeen, false);
  assert.equal(mergeState({ settings: { introSeen: 1 } }).settings.introSeen, false);
  assert.equal(mergeState({ settings: { introSeen: true } }).settings.introSeen, true);
});

test('保存: 古い記録（introSeen が無い）で記録がある人は、読み込んでも案内は出ない', () => {
  const old = { v: 1, xp: 120, totals: { answered: 30, correct: 20 }, qstats: { q1: { seen: true } }, settings: { examAsked: true, examDate: null } };
  assert.equal(needsIntro(mergeState(old)), false);
});

test('保存: 一度保存すると、次に読み込んでも出ない（保存の往復）', () => {
  const store = new Map();
  const backing = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const storage = createStorage('t', backing);
  const s = storage.load();
  assert.equal(needsIntro(s), true);
  s.settings.introSeen = true;
  storage.save(s);
  assert.equal(needsIntro(createStorage('t', backing).load()), false);
});

test('引き継ぎ: 書き出して読み込んでも introSeen は保たれ、記録がある人には出ない', () => {
  const s = defaultState();
  s.settings.introSeen = true;
  s.totals.answered = 3;
  const r = parseBackup(serializeBackup('g-kentei', s), 'g-kentei');
  assert.equal(r.ok, true);
  assert.equal(r.state.settings.introSeen, true);
  assert.equal(needsIntro(r.state), false);
});

test('中身: 3〜4枚で、絵は実在する素材。1ページに1人で、最後だけ柴犬のサニー', () => {
  assert.ok(INTRO_SLIDES.length >= 3 && INTRO_SLIDES.length <= 4);
  for (const s of INTRO_SLIDES) {
    assert.ok(isCharacterArt(s.art), s.art + ' が素材に無い');
    assert.ok(s.title.length > 0 && s.title.length <= 24, 'タイトルが長すぎる: ' + s.title);
    assert.ok(s.text.length > 0 && s.text.length <= 70, '文言が長すぎる（短く）: ' + s.text);
  }
  INTRO_SLIDES.slice(0, -1).forEach((s) => assert.equal(characterName(s.art), CHARACTER_NAMES.sensei));
  assert.equal(characterName(INTRO_SLIDES[INTRO_SLIDES.length - 1].art), CHARACTER_NAMES.shiba);
});

test('中身: 4つの案内（地図と星・復習・解説と用語カード・模擬試験と続ける工夫）を1枚に1つ言っている', () => {
  const all = INTRO_SLIDES.map((s) => s.title + s.text);
  assert.ok(/地図/.test(all[0]) && /星/.test(all[0]));
  assert.ok(/復習/.test(all[1]));
  assert.ok(/解説/.test(all[2]) && /用語カード/.test(all[2]));
  assert.ok(/模擬試験/.test(all[3]) && /バッジ/.test(all[3]) && /目標/.test(all[3]));
});

test('言葉: ボタンの文言（とばす・はじめる）と、「もっと」の項目名', () => {
  assert.equal(INTRO_TEXT.skip, 'とばす');
  assert.equal(INTRO_TEXT.start, 'はじめる');
  assert.equal(INTRO_TEXT.menu, '使い方');
});

test('結線: オフラインの登録・テスト一覧・両アプリの版・「もっと」「起動」から使われている', () => {
  const sw = readFileSync(join(shared, 'sw-core.js'), 'utf8');
  assert.ok(sw.includes("'../shared/js/lib/intro.js'"), 'lib/intro.js が SHARED に無い');
  assert.ok(sw.includes("'../shared/js/views/intro.js'"), 'views/intro.js が SHARED に無い');
  const pkg = JSON.parse(readFileSync(join(shared, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('tests/intro.test.js'));
  for (const app of ['g-kentei', 'dx-biz']) {
    const v = /version: '(\d+)'/.exec(readFileSync(join(root, app, 'sw.js'), 'utf8'));
    assert.ok(v && Number(v[1]) >= 30, app + ' の版が 30 以上でない');
  }
  const more = readFileSync(join(shared, 'js/views/more.js'), 'utf8');
  assert.ok(more.includes('openIntro()') && more.includes('INTRO_TEXT.menu'));
  const app = readFileSync(join(shared, 'js/app.js'), 'utf8');
  assert.ok(app.includes('needsIntro(titleState)'));
  // 受験日を聞く画面のあと、ホームに入る前に出す
  assert.ok(app.indexOf('createExamDateAsk({') < app.indexOf('needsIntro(titleState)'));
  assert.ok(app.indexOf('needsIntro(titleState)') < app.indexOf('const app = {'));
});
