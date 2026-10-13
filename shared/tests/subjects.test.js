// 科目のあるアプリ（中小企業診断士 第1次試験）の、記録の分け方・保存キー・書き出し・オフライン登録の検証。ブラウザ無しで node から叩く。
// 守るもの: ①G検定・DX の保存キーと記録の形が変わらない ②共通（XP・連続日数・設定）は科目をまたぐ ③科目ごとの記録は科目を替えても消えない ④書き出し→読み込みで全科目が戻る
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  COMMON_KEYS, singleKey, commonKey, subjectKey, hasSubjects, normalizeSubjects, subjectConfig, subjectDataBase, subjectImagesBase,
  splitState, joinState, subjectKeys, createSubjectStore,
} from '../js/lib/subjects.js';
import { defaultState, mergeState, recordAnswer } from '../js/lib/progress.js';
import { createStorage } from '../js/lib/storage.js';
import { buildSubjectsBackup, serializeSubjectsBackup, parseSubjectsBackup, parseBackup, serializeBackup, subjectsBackupSummary, BACKUP_REASONS } from '../js/lib/backup.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const shin = readJson('shindanshi/1ji/config.json');

// localStorage の代わり（getItem / setItem / removeItem）
function fakeBacking(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const answer = (state, id, correct, day = 12) => recordAnswer(state, { id }, { correct, now: new Date(2026, 9, day, 9) });
const APP = 'shindanshi-1ji';
const mk = (backing = fakeBacking(), opts = {}) => createSubjectStore({ appId: APP, subjects: normalizeSubjects(shin), backing, ...opts });

// ---- 保存キー ----

test('保存キー: 科目の無いアプリ（G検定・DX）は今までと同じ certquest:<id>:v1。サンプルは :sample が入る', () => {
  assert.equal(singleKey('g-kentei'), 'certquest:g-kentei:v1');
  assert.equal(singleKey('dx-biz'), 'certquest:dx-biz:v1');
  assert.equal(singleKey('g-kentei', true), 'certquest:g-kentei:sample:v1');
  assert.equal(singleKey(undefined), 'certquest:app:v1');
});

test('保存キー: 科目のあるアプリは、共通と科目ごとに別のキー。科目の id が入る', () => {
  assert.equal(commonKey(APP), 'certquest:shindanshi-1ji:common:v1');
  assert.equal(subjectKey(APP, 'economics'), 'certquest:shindanshi-1ji:economics:v1');
  assert.equal(subjectKey(APP, 'economics', true), 'certquest:shindanshi-1ji:sample:economics:v1');
  assert.equal(commonKey(APP, true), 'certquest:shindanshi-1ji:sample:common:v1');
  const ids = new Set(['common', ...normalizeSubjects(shin).map((s) => s.id)].map((id) => (id === 'common' ? commonKey(APP) : subjectKey(APP, id))));
  assert.equal(ids.size, 8, '共通＋7科目のキーが全部違う');
});

test('G検定・DX の config に subjects が無い（科目の仕組みに入らない）。app.js は科目の無いアプリで singleKey を使う', () => {
  for (const a of ['g-kentei', 'dx-biz']) {
    const c = readJson(a + '/config.json');
    assert.equal(hasSubjects(c), false, a);
    assert.deepEqual(normalizeSubjects(c), []);
  }
  const app = readFileSync(join(root, 'shared/js/app.js'), 'utf8');
  assert.match(app, /store \? store\.common\(\) : createStorage\(singleKey\(config\.id, sample\)\)/);
});

test('G検定・DX が今までと同じ保存キーに書く: createStorage(singleKey(...)) の保存先が certquest:<id>:v1 のまま、記録の形（defaultState のキー）も同じ', () => {
  for (const a of ['g-kentei', 'dx-biz']) {
    const b = fakeBacking();
    const st = createStorage(singleKey(a), b);
    const s = st.load();
    answer(s, 'Q1', true);
    st.save(s);
    assert.deepEqual([...b.m.keys()], ['certquest:' + a + ':v1']);
    assert.deepEqual(Object.keys(JSON.parse(b.m.get('certquest:' + a + ':v1'))).sort(), Object.keys(defaultState()).sort());
    assert.ok(st.load().qstats.Q1.seen);
  }
});

// ---- 科目の一覧 ----

test('診断士1次の config: 科目が7つ。id・folder は重ならず、folder は実在し、順は A〜G', () => {
  const subs = normalizeSubjects(shin);
  assert.equal(subs.length, 7);
  assert.equal(new Set(subs.map((s) => s.id)).size, 7);
  assert.equal(new Set(subs.map((s) => s.folder)).size, 7);
  assert.deepEqual(subs.map((s) => s.code), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  assert.deepEqual(subs.map((s) => s.folder), ['01_economics', '02_finance-accounting', '03_management-theory', '04_operations', '05_business-law', '06_information-systems', '07_sme-policy']);
  for (const s of subs) assert.ok(statSync(join(root, 'shindanshi/1ji', s.folder)).isDirectory(), s.folder + ' が無い');
  assert.deepEqual(subs.map((s) => s.exam.minutes), [60, 60, 90, 90, 60, 60, 90]);
});

test('科目の一覧の整え: 形の崩れた項目・重なる id/folder・予約の id(common)・変なフォルダ名は捨てる', () => {
  const ok = { id: 'a', folder: '01_a', name: 'A' };
  const subs = normalizeSubjects({ subjects: [
    ok, { ...ok }, { id: 'a', folder: '02_a', name: 'dup-id' }, { id: 'b', folder: '01_a', name: 'dup-folder' },
    { id: 'common', folder: '03', name: 'reserved' }, { id: 'c', folder: '../x', name: 'bad folder' }, { id: 'D', folder: '04', name: 'upper' },
    { id: 'e', folder: '05', name: '' }, null, 'x', { id: 'f', folder: '06', name: 'F' },
  ] });
  assert.deepEqual(subs.map((s) => s.id), ['a', 'f']);
  assert.deepEqual(normalizeSubjects({}), []);
  assert.deepEqual(normalizeSubjects({ subjects: [] }), []);
});

test('科目を開いたときの config: id はアプリのまま、名前・試験時間・絵が科目の分に重なり、subjects は持ち越さない。元の config は変えない', () => {
  const subs = normalizeSubjects(shin);
  const before = JSON.stringify(shin);
  const c = subjectConfig(shin, subs[2]);
  assert.equal(c.id, 'shindanshi-1ji');
  assert.ok(c.name.includes('企業経営理論'));
  assert.equal(c.exam.minutes, 90);
  assert.equal(c.exam.questions, shin.exam.questions);
  assert.equal('subjects' in c, false);
  assert.equal(c.subject.id, 'management-theory');
  assert.equal(JSON.stringify(shin), before);
});

test('データと絵の置き場: 科目のフォルダ（サンプルは _sample/<フォルダ>）、絵は images/<科目id>/', () => {
  const sub = normalizeSubjects(shin)[0];
  const page = 'https://example.test/cert-quest/shindanshi/1ji/index.html?sample=1';
  assert.equal(subjectDataBase(sub, page), 'https://example.test/cert-quest/shindanshi/1ji/01_economics/');
  assert.equal(subjectDataBase(sub, page, true), 'https://example.test/cert-quest/shindanshi/1ji/_sample/01_economics/');
  assert.equal(subjectImagesBase(sub, page), 'https://example.test/cert-quest/shindanshi/1ji/images/economics/');
});

// ---- 記録の分け方 ----

test('共通の項目は xp・streak・daily・settings・goalAwarded。科目の項目はそれ以外の全部（defaultState の全項目が、どちらか一方にだけ入る）', () => {
  assert.deepEqual([...COMMON_KEYS].sort(), ['daily', 'goalAwarded', 'settings', 'streak', 'studySeconds', 'xp']);
  const all = Object.keys(defaultState());
  const { common, subject } = splitState(defaultState());
  assert.deepEqual(Object.keys(common).sort(), [...COMMON_KEYS].sort());
  assert.deepEqual([...Object.keys(common), ...Object.keys(subject)].sort(), all.sort());
  assert.deepEqual(subjectKeys().sort(), Object.keys(subject).sort());
  for (const k of ['qstats', 'stages', 'badges', 'exams', 'later', 'forecast', 'boss', 'bossMet', 'totals', 'dochi']) assert.ok(k in subject, k + ' は科目ごと');
});

test('分けて合わせると、元の記録に戻る。科目の側に紛れた共通の項目は読まない', () => {
  const s = defaultState();
  answer(s, 'Q1', true);
  answer(s, 'Q2', false);
  s.settings.theme = 'dark';
  s.boss = { 'x|y': 2 };
  const { common, subject } = splitState(s);
  assert.deepEqual(joinState(common, subject), mergeState(s));
  const dirty = joinState({ xp: 50 }, { ...subject, xp: 9999, settings: { theme: 'dark' } });
  assert.equal(dirty.xp, 50);
  assert.equal(dirty.settings.theme, 'light');
});

// ---- 記録の置き場 ----

test('科目を替えても、ほかの科目の記録は消えない。A→B→A で A の記録が残る', () => {
  const b = fakeBacking();
  const store = mk(b);
  const a = store.open('economics');
  let sa = a.load();
  answer(sa, 'EC-1', true);
  a.save(sa);
  const bb = store.open('finance-accounting');
  let sb = bb.load();
  assert.equal(Object.keys(sb.qstats).length, 0, 'B は空から始まる');
  answer(sb, 'FA-1', true);
  bb.save(sb);
  const again = store.open('economics').load();
  assert.ok(again.qstats['EC-1'] && again.qstats['EC-1'].seen);
  assert.equal(again.qstats['FA-1'], undefined, 'B の問題が A に混ざらない');
  const backB = store.open('finance-accounting').load();
  assert.ok(backB.qstats['FA-1'] && !backB.qstats['EC-1']);
  assert.equal(again.totals.answered, 1);
  assert.equal(backB.totals.answered, 1);
});

test('XP・連続日数・1日の記録・設定は科目をまたいで共通。A で貯めた XP が B でも見え、B で足すと A でも増える', () => {
  const store = mk();
  const a = store.open('economics');
  const sa = a.load();
  answer(sa, 'EC-1', true, 11);
  sa.settings.theme = 'dark';
  sa.settings.dailyGoal = 20;
  a.save(sa);
  const xpA = sa.xp;
  assert.ok(xpA > 0);
  const b = store.open('finance-accounting');
  const sb = b.load();
  assert.equal(sb.xp, xpA);
  assert.equal(sb.streak.count, sa.streak.count);
  assert.deepEqual(sb.daily, sa.daily);
  assert.equal(sb.settings.theme, 'dark');
  assert.equal(sb.settings.dailyGoal, 20);
  answer(sb, 'FA-1', true, 12);
  b.save(sb);
  const back = store.open('economics').load();
  assert.equal(back.xp, sb.xp);
  assert.ok(back.xp > xpA);
  assert.equal(back.streak.count, 2);
  assert.equal(back.totals.answered, 1, '答えた数は科目ごと');
});

test('保存先: 共通1つ＋科目ごと1つだけ。科目の無いアプリのキー（certquest:shindanshi-1ji:v1）には書かない。科目の記録に共通の項目は入らない', () => {
  const b = fakeBacking();
  const store = mk(b);
  const a = store.open('economics');
  const s = a.load();
  answer(s, 'EC-1', true);
  a.save(s);
  assert.deepEqual([...b.m.keys()].sort(), [commonKey(APP), subjectKey(APP, 'economics')].sort());
  const subjRaw = JSON.parse(b.m.get(subjectKey(APP, 'economics')));
  for (const k of COMMON_KEYS) assert.equal(k in subjRaw, false, k + ' が科目の記録に入っている');
  const commonRaw = JSON.parse(b.m.get(commonKey(APP)));
  assert.equal(commonRaw.xp, s.xp);
  assert.equal('qstats' in commonRaw, false);
});

test('G検定・DX の記録（certquest:g-kentei:v1 など）は、診断士の操作で変わらない・消えない', () => {
  const g = JSON.stringify({ v: 1, xp: 123, qstats: { 'G-1': { seen: true } } });
  const d = JSON.stringify({ v: 1, xp: 45 });
  const b = fakeBacking({ 'certquest:g-kentei:v1': g, 'certquest:dx-biz:v1': d });
  const store = mk(b);
  const a = store.open('economics');
  const s = a.load();
  answer(s, 'EC-1', true);
  a.save(s);
  store.select('economics');
  a.clear();
  store.importAll({ common: { xp: 7 }, subjects: { economics: {} } });
  assert.equal(b.m.get('certquest:g-kentei:v1'), g);
  assert.equal(b.m.get('certquest:dx-biz:v1'), d);
});

test('「この科目の記録を消す」は、その科目だけ。ほかの科目と共通（XP・設定）は残る', () => {
  const store = mk();
  const a = store.open('economics');
  const sa = a.load();
  answer(sa, 'EC-1', true);
  a.save(sa);
  const b = store.open('finance-accounting');
  const sb = b.load();
  answer(sb, 'FA-1', true);
  b.save(sb);
  const xp = b.load().xp;
  a.clear();
  const afterA = a.load();
  assert.equal(Object.keys(afterA.qstats).length, 0);
  assert.equal(afterA.xp, xp, 'XP は残る');
  assert.ok(store.open('finance-accounting').load().qstats['FA-1'], 'B の記録は残る');
});

test('選んだ科目を保存する。知らない id・消えた科目は無かったことにする。選んでも共通の記録（XP）は消えない', () => {
  const b = fakeBacking();
  const store = mk(b);
  assert.equal(store.selected(), null);
  const a = store.open('economics');
  const s = a.load();
  answer(s, 'EC-1', true);
  a.save(s);
  assert.equal(store.select('nope'), false);
  assert.equal(store.selected(), null);
  assert.equal(store.select('operations'), true);
  assert.equal(mk(b).selected(), 'operations', '作り直した置き場でも読める');
  assert.equal(store.open('operations').load().xp, s.xp, '選んでも XP は残る');
  // 科目を開いて保存しても、選んだ科目は消えない
  const o = store.open('operations');
  o.save(o.load());
  assert.equal(mk(b).selected(), 'operations');
  b.m.set(commonKey(APP), JSON.stringify({ subject: 'removed-subject' }));
  assert.equal(mk(b).selected(), null);
});

test('壊れた記録・知らない科目: 壊れた JSON は空として扱い、知らない科目を開くと例外', () => {
  const b = fakeBacking({ [subjectKey(APP, 'economics')]: '{broken', [commonKey(APP)]: '[1,2]' });
  const store = mk(b);
  const s = store.open('economics').load();
  assert.equal(s.xp, 0);
  assert.deepEqual(s.qstats, {});
  assert.throws(() => store.open('nope'));
  assert.equal(store.peek('nope').totals.answered, 0);
});

test('保存できない環境（setItem が失敗）でも落ちず、persistent が false になり、同じ起動の間はメモリ上で覚える', () => {
  const b = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const store = mk(b);
  const a = store.open('economics');
  const s = a.load();
  answer(s, 'EC-1', true);
  assert.equal(a.save(s), false);
  assert.equal(store.persistent, false);
  const nostore = mk(null);
  const n = nostore.open('economics');
  const ns = n.load();
  answer(ns, 'EC-1', true);
  n.save(ns);
  assert.ok(n.load().qstats['EC-1'], '保存先が無くても、起動中は覚える');
});

test('共通だけのストレージ（科目を選ぶ前のタイトル画面）: 設定を保存しても、選んだ科目・科目の記録に触れない', () => {
  const b = fakeBacking();
  const store = mk(b);
  store.select('economics');
  const a = store.open('economics');
  const s = a.load();
  answer(s, 'EC-1', true);
  a.save(s);
  const before = b.m.get(subjectKey(APP, 'economics'));
  const c = store.common();
  const cs = c.load();
  cs.settings.sound = true;
  c.save(cs);
  assert.equal(b.m.get(subjectKey(APP, 'economics')), before);
  assert.equal(store.selected(), 'economics');
  assert.equal(store.open('economics').load().settings.sound, true);
});

// ---- 書き出し・読み込み ----

function filled() {
  const b = fakeBacking();
  const store = mk(b);
  const a = store.open('economics');
  const sa = a.load();
  answer(sa, 'EC-1', true, 11);
  answer(sa, 'EC-2', false, 11);
  sa.boss = { 'x|y': 1 };
  sa.settings.theme = 'dark';
  a.save(sa);
  const c = store.open('business-law');
  const sc = c.load();
  answer(sc, 'BL-1', true, 12);
  sc.later = { 'BL-1': 1 };
  c.save(sc);
  return { b, store };
}

test('書き出し → 読み込み: 全科目の記録と共通の記録が、別の端末（空の保存先）に戻る', () => {
  const { store } = filled();
  const now = new Date(Date.UTC(2026, 9, 12, 1, 2, 3));
  const text = serializeSubjectsBackup(APP, store.exportAll(), now);
  const parsed = parseSubjectsBackup(text, APP);
  assert.equal(parsed.ok, true);
  assert.deepEqual(Object.keys(parsed.subjects).sort(), ['business-law', 'economics']);
  const b2 = fakeBacking();
  const s2 = mk(b2);
  s2.importAll({ common: parsed.common, subjects: parsed.subjects });
  for (const id of ['economics', 'business-law', 'finance-accounting']) assert.deepEqual(s2.open(id).load(), store.open(id).load(), id);
  assert.equal(s2.open('economics').load().settings.theme, 'dark');
  assert.deepEqual(s2.open('economics').load().boss, { 'x|y': 1 });
  assert.deepEqual(s2.open('business-law').load().later, { 'BL-1': 1 });
});

test('読み込みは、ファイルに有る科目だけ置き換える。無い科目の記録はそのまま', () => {
  const { store } = filled();
  const text = serializeSubjectsBackup(APP, { common: store.exportAll().common, subjects: { economics: store.exportAll().subjects.economics } });
  const dst = mk();
  const d = dst.open('business-law');
  const sd = d.load();
  answer(sd, 'BL-9', true);
  d.save(sd);
  const p = parseSubjectsBackup(text, APP);
  const r = dst.importAll({ common: p.common, subjects: p.subjects });
  assert.deepEqual(r.subjects, ['economics']);
  assert.ok(dst.open('business-law').load().qstats['BL-9'], 'ファイルに無い科目は残る');
  assert.ok(dst.open('economics').load().qstats['EC-1']);
});

test('書き出しの形: layout=subjects・共通・科目ごとの記録。知らない項目（メール等）は入らない。科目の記録に共通の項目は入らない', () => {
  const dirty = { common: { xp: 5, email: 'a@example.com' }, subjects: { economics: { qstats: {}, name: '山田', xp: 999, settings: { theme: 'dark' } }, 'Bad Id': {} } };
  const b = buildSubjectsBackup(APP, dirty, new Date(Date.UTC(2026, 9, 12)));
  assert.equal(b.layout, 'subjects');
  assert.deepEqual(Object.keys(b).sort(), ['app', 'common', 'exportedAt', 'kind', 'layout', 'subjects', 'version']);
  assert.deepEqual(Object.keys(b.subjects), ['economics']);
  assert.deepEqual(Object.keys(b.common).sort(), [...COMMON_KEYS].sort());
  assert.deepEqual(Object.keys(b.subjects.economics).sort(), subjectKeys().sort());
  const text = JSON.stringify(b);
  for (const w of ['a@example.com', '山田', '"email"', '"name"', '999']) assert.ok(!text.includes(w), w);
  assert.equal(b.common.xp, 5);
});

test('読み込みの拒否: 別アプリ・科目なしの形・壊れた形・新しい版・大きすぎる', () => {
  const { store } = filled();
  const good = serializeSubjectsBackup(APP, store.exportAll());
  assert.equal(parseSubjectsBackup(good, 'g-kentei').reason, 'otherApp');
  const flat = serializeBackup(APP, defaultState());
  assert.equal(parseSubjectsBackup(flat, APP).reason, 'layout', '科目なしのファイルは科目ありのアプリで読めない');
  assert.equal(parseBackup(good, APP).reason, 'layout', '科目ありのファイルは科目なしの読み込みで読めない');
  assert.equal(parseSubjectsBackup('{', APP).reason, 'broken');
  assert.equal(parseSubjectsBackup(JSON.stringify({ ...JSON.parse(good), subjects: [] }), APP).reason, 'broken');
  assert.equal(parseSubjectsBackup(JSON.stringify({ ...JSON.parse(good), common: null }), APP).reason, 'broken');
  assert.equal(parseSubjectsBackup(JSON.stringify({ ...JSON.parse(good), version: 99 }), APP).reason, 'newer');
  assert.equal(parseSubjectsBackup('x'.repeat(6 * 1024 * 1024), APP).reason, 'tooBig');
  assert.ok(BACKUP_REASONS.layout);
});

test('G検定・DX の書き出し（科目なし）は今までの形のまま: state が1つ、layout は付かない', () => {
  const text = serializeBackup('g-kentei', defaultState());
  const o = JSON.parse(text);
  assert.equal('layout' in o, false);
  assert.deepEqual(Object.keys(o).sort(), ['app', 'exportedAt', 'kind', 'state', 'version']);
  assert.equal(parseBackup(text, 'g-kentei').ok, true);
});

test('読み込みの確認画面の要約: 全科目の答えた問題の合計・XP・科目数', () => {
  const { store } = filled();
  const p = parseSubjectsBackup(serializeSubjectsBackup(APP, store.exportAll()), APP);
  const sum = subjectsBackupSummary(p);
  assert.equal(sum.answered, 3);
  assert.equal(sum.subjects, 2);
  assert.equal(sum.xp, store.open('economics').load().xp);
});

// ---- アプリの枠・オフライン登録 ----

test('shindanshi/1ji の枠: config の id・sw.js の dataDirs（科目のフォルダと同じ）・sharedBase・version・appFiles が実在・manifest の id', () => {
  const dir = 'shindanshi/1ji';
  assert.equal(shin.id, 'shindanshi-1ji');
  const sw = readFileSync(join(root, dir, 'sw.js'), 'utf8');
  // sw.js の self.CERT_QUEST = {...} の代入を拾う（importScripts の行は実行しない）
  const m = {};
  vm.runInNewContext(sw.replace(/importScripts\([^)]*\);?/, ''), { self: new Proxy({}, { set(_, k, v) { m[k] = v; return true; } }) });
  const c = m.CERT_QUEST;
  assert.equal(c.appId, 'shindanshi-1ji');
  assert.equal(c.version, '1');
  assert.equal(c.sharedBase, '../../shared/');
  assert.deepEqual([...c.dataDirs], normalizeSubjects(shin).map((s) => s.folder));
  for (const f of c.appFiles) {
    if (f === './') continue;
    assert.ok(existsSync(join(root, dir, f)), f + ' が実在しない');
  }
  for (const f of ['./index.html', './main.js', './config.json', './manifest.webmanifest']) assert.ok(c.appFiles.includes(f), f);
  assert.match(sw, /importScripts\('\.\.\/\.\.\/shared\/sw-core\.js'\)/);
  const man = readJson(dir + '/manifest.webmanifest');
  assert.equal(man.id, '/cert-quest/shindanshi/1ji/');
  assert.equal(man.scope, './');
  const html = readFileSync(join(root, dir, 'index.html'), 'utf8');
  assert.match(html, /\.\.\/\.\.\/shared\/css\/app\.css/);
  assert.match(readFileSync(join(root, dir, 'main.js'), 'utf8'), /\.\.\/\.\.\/shared\/js\/app\.js/);
});

test('shared に足したファイル（subjects.js・views/subjects.js）が sw-core.js の SHARED に入っている', () => {
  const sw = readFileSync(join(root, 'shared/sw-core.js'), 'utf8');
  for (const f of ['js/lib/subjects.js', 'js/views/subjects.js']) {
    assert.ok(existsSync(join(root, 'shared', f)), f);
    assert.ok(sw.includes("'../shared/" + f + "'"), f + ' が SHARED に無い');
  }
});

// sw-core.js を偽の self の中で動かす（swbase.test.js と同じ作り）
function runSw(cfg, fetchImpl) {
  const src = readFileSync(join(root, 'shared/sw-core.js'), 'utf8');
  const handlers = {};
  const fetched = [];
  const cacheStore = new Map();
  const cacheObj = {
    addAll: async () => {},
    put: async (req, res) => { cacheStore.set(typeof req === 'string' ? req : req.url, res); },
    match: async (req) => cacheStore.get(typeof req === 'string' ? req : req.url) || null,
  };
  const self = {
    CERT_QUEST: { appId: 't', version: '1', appFiles: ['./'], ...cfg },
    location: { href: 'https://example.test/cert-quest/shindanshi/1ji/sw.js', origin: 'https://example.test', toString() { return this.href; } },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const ctx = {
    self, caches: { open: async () => cacheObj, keys: async () => [], delete: async () => true },
    fetch: async (u, o) => { const url = typeof u === 'string' ? new URL(u, self.location.href).href : u.url; fetched.push(url); return fetchImpl(url, o); },
    URL, Request: class { constructor(u) { this.url = new URL(u, self.location.href).href; } }, Response, Promise, console, setTimeout, clearTimeout,
  };
  vm.runInNewContext(src, ctx);
  return { handlers, fetched, cacheStore };
}
const jsonRes = (body) => ({ ok: true, status: 200, clone() { return jsonRes(body); }, json: async () => body });

test('オフライン登録: dataDirs の全部の置き場の index.json と、その問題・カード・図・ボスを先に取る。dataDirs が無ければ今までどおり data/ だけ', async () => {
  const files = {
    '01_a/index.json': { syllabus: 'syllabus.json', questions: ['q.json'], concepts: [], bosses: 'b.json' },
    '01_a/syllabus.json': [], '01_a/q.json': [{ id: 'q1', figures: ['fig-x-y'] }], '01_a/b.json': [], '01_a/figures/fig-x-y.svg': {},
    '02_b/index.json': { syllabus: 'syllabus.json', questions: [], concepts: [] }, '02_b/syllabus.json': [],
    'data/index.json': { syllabus: 'syllabus.json', questions: [], concepts: [] }, 'data/syllabus.json': [],
  };
  const impl = (url) => {
    const rel = url.replace('https://example.test/cert-quest/shindanshi/1ji/', '');
    return rel in files ? jsonRes(files[rel]) : { ok: false, status: 404, clone() { return this; } };
  };
  const multi = runSw({ dataDirs: ['01_a', '02_b'] }, impl);
  let p;
  multi.handlers.install({ waitUntil: (x) => { p = x; } });
  await p;
  const rels = multi.fetched.map((u) => u.replace('https://example.test/cert-quest/shindanshi/1ji/', ''));
  for (const f of ['01_a/index.json', '01_a/syllabus.json', '01_a/q.json', '01_a/b.json', '01_a/figures/fig-x-y.svg', '02_b/index.json', '02_b/syllabus.json']) assert.ok(rels.includes(f), f + ' を取っていない: ' + rels.join(','));
  assert.ok(!rels.includes('data/index.json'), 'dataDirs があるときは data/ を取らない');
  const dflt = runSw({}, impl);
  dflt.handlers.install({ waitUntil: (x) => { p = x; } });
  await p;
  const r2 = dflt.fetched.map((u) => u.replace('https://example.test/cert-quest/shindanshi/1ji/', ''));
  assert.ok(r2.includes('data/index.json') && r2.includes('data/syllabus.json'));
  assert.ok(!r2.some((f) => f.startsWith('01_a/')));
  // 不正な dataDirs（空・変な名前）は、全部に一致する正規表現にならず data/ に戻る
  const bad = runSw({ dataDirs: ['../x', ''] }, impl);
  bad.handlers.install({ waitUntil: (x) => { p = x; } });
  await p;
  assert.ok(bad.fetched.some((u) => u.endsWith('/data/index.json')));
});

test('配り方: 置き場（dataDirs のフォルダ・data/）の下はキャッシュ優先、それ以外はネット優先', async () => {
  const net = { ok: true, status: 200, from: 'net', clone() { return this; } };
  const hit = { ok: true, status: 200, from: 'cache', clone() { return this; } };
  async function get(cfg, path) {
    const sw = runSw(cfg, () => net);
    const url = 'https://example.test/cert-quest/shindanshi/1ji/' + path;
    sw.cacheStore.set(url, hit);
    let out;
    sw.handlers.fetch({ request: { method: 'GET', url, mode: 'cors' }, respondWith: (pr) => { out = pr; } });
    return (await out).from;
  }
  assert.equal(await get({ dataDirs: ['01_a'] }, '01_a/q.json'), 'cache', '科目のフォルダはキャッシュ優先');
  assert.equal(await get({ dataDirs: ['01_a'] }, '02_b/q.json'), 'net', 'dataDirs に無いフォルダはネット優先');
  assert.equal(await get({ dataDirs: ['01_a'] }, 'main.js'), 'net');
  assert.equal(await get({}, 'data/q.json'), 'cache', '既定は data/（G検定・DX）');
  assert.equal(await get({}, '01_a/q.json'), 'net');
});
