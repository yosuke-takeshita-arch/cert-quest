// 地図1つのアプリ（g-kentei・dx-biz・ai-passport・sc。tests/apps.js が探す）の枠が、互いに食い違っていないかの検証。
// 2026-10-13、ai-passport/ を足したときに作った。新しいアプリを足すたびに、名前・色・先取りの一覧の書き漏れをここで止める。
// 見ていないもの: 絵の中身（タイトル・地図・ボス・バッジ）、アイコンの PNG が SVG と同じ絵か、データの中身（tools/check-data*.js が見る）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { APPS, root } from './apps.js';
import { appTitle } from '../js/lib/appname.js';

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
function swConfig(app) {
  const src = readFileSync(join(root, app, 'sw.js'), 'utf8');
  const m = {};
  vm.runInNewContext(src.replace(/importScripts\([^)]*\);?/, ''), { self: new Proxy({}, { set(_, k, v) { m[k] = v; return true; } }) });
  return { src, cfg: m.CERT_QUEST };
}

test('一覧: 地図1つのアプリとして g-kentei・dx-biz・ai-passport・sc が見つかる（科目のある shindanshi は入らない）', () => {
  for (const a of ['g-kentei', 'dx-biz', 'ai-passport', 'sc']) assert.ok(APPS.includes(a), a);
  assert.ok(!APPS.some((a) => a.startsWith('shindanshi')));
});

// 科目のある診断士も同じ決まりで見る
for (const app of [...APPS, 'shindanshi/1ji']) {
  test(`${app}: 名前は CertQuest シリーズ＋アプリごとの名前。試験名（登録商標のことがある）は名前に入れず、副題の「〜対策」にだけ書く`, () => {
    // 2026-10-14 先生の決定。G検定（登録6202165）・生成AIパスポート（登録6768938）は登録商標。名前・ロゴ・アイコンの下の名前に試験名を使わない
    const config = readJson(app + '/config.json');
    const man = readJson(app + '/manifest.webmanifest');
    const html = readFileSync(join(root, app, 'index.html'), 'utf8');
    assert.equal(man.name, appTitle(config));
    assert.equal(man.short_name, config.shortName);
    assert.ok(html.includes('<title>' + appTitle(config) + '</title>'), 'index.html の title');
    assert.equal(config.series, 'CertQuest');
    assert.ok(config.name, '名前が無い');
    assert.match(config.subtitle, /対策$/);
    // 『支援士』『情報処理安全確保』は、情報処理の促進に関する法律 第24条（登録を受けていない者が名称を使うことの禁止）に触れないよう、名前に入れない（要件定義書 §12）
    for (const word of ['G検定', '生成AI', 'パスポート', 'DX', 'ビジネス', '診断士', '検定', 'クエスト', '支援士', '情報処理安全確保']) {
      for (const [where, v] of [['config.name', config.name], ['config.shortName', config.shortName], ['manifest の short_name（アイコンの下の名前）', man.short_name]]) {
        assert.ok(!v.includes(word), where + ' の「' + v + '」に「' + word + '」が入っている');
      }
    }
  });
}

for (const app of APPS) {
  test(`${app}: config・sw.js・manifest・index.html の名前と色と id がそろっている`, () => {
    const config = readJson(app + '/config.json');
    assert.equal(config.id, app, 'config.json の id はディレクトリ名と同じ（記録の保存キーと書き出しのファイル名に使う）');
    const { src, cfg } = swConfig(app);
    assert.equal(cfg.appId, app);
    assert.match(String(cfg.version), /^[1-9]\d*$/);
    assert.match(src, /importScripts\('\.\.\/shared\/sw-core\.js'\)/);
    const man = readJson(app + '/manifest.webmanifest');
    assert.equal(man.name, appTitle(config), 'ホーム画面に入れたときの名前は CertQuest ＋名前＋（副題）');
    assert.equal(man.short_name, config.shortName);
    assert.equal(man.theme_color, config.theme.light.accent);
    const html = readFileSync(join(root, app, 'index.html'), 'utf8');
    assert.equal((/<title>([^<]*)<\/title>/.exec(html) || [])[1], appTitle(config));
    assert.equal((/<meta name="theme-color" content="([^"]+)"/.exec(html) || [])[1], config.theme.light.accent);
    assert.match(html, /\.\.\/shared\/css\/app\.css/);
    assert.match(readFileSync(join(root, app, 'main.js'), 'utf8'), /\.\.\/shared\/js\/app\.js/);
  });

  test(`${app}: 先取りの一覧（appFiles）は全部実在し、本体とアイコンを含む。絵は置いたときだけ config と一覧に載る`, () => {
    const config = readJson(app + '/config.json');
    const { cfg } = swConfig(app);
    for (const f of cfg.appFiles) {
      if (f === './') continue;
      assert.ok(existsSync(join(root, app, f)), `${app}/${f} が実在しない（インストールが404で失敗する）`);
    }
    for (const f of ['./', './index.html', './main.js', './config.json', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png']) {
      assert.ok(cfg.appFiles.includes(f), `${app}: ${f} が appFiles に無い`);
    }
    // タイトルの絵（地図の絵は maplayout.test.js が同じことを見る）
    const present = existsSync(join(root, app, 'images', 'title.webp'));
    assert.equal(cfg.appFiles.includes('./images/title.webp'), present, app + ': タイトルの絵があるときだけ appFiles に入れる');
    assert.equal(config.titleImage === 'images/title.webp', present, app + ': タイトルの絵があるときだけ config.json に titleImage');
    // タイトルの文字の絵（2026-10-14 先生の決定。文字だけだったタイトルを、クエストらしい文字の絵にする）
    const logo = existsSync(join(root, app, 'images', 'logo.webp'));
    assert.equal(cfg.appFiles.includes('./images/logo.webp'), logo, app + ': 文字の絵があるときだけ appFiles に入れる');
    assert.equal(config.titleLogo === 'images/logo.webp', logo, app + ': 文字の絵があるときだけ config.json に titleLogo');
    for (const f of cfg.appFiles) {
      const m = /^\.\/images\/(bosses|badges)\/[^/]+\.webp$/.exec(f);
      if (m) assert.ok(existsSync(join(root, app, f)), f);
    }
  });

  test(`${app}: data/index.json（と、あれば data/_sample/index.json）が指すファイルが全部ある`, () => {
    // サンプル（?sample=1 で開く）は G検定・生成AIパスポートにある。DX には無い
    for (const base of ['data', 'data/_sample'].filter((b) => b === 'data' || existsSync(join(root, app, b, 'index.json')))) {
      const idx = readJson(`${app}/${base}/index.json`);
      assert.equal(typeof idx.syllabus, 'string');
      for (const f of [idx.syllabus, ...(idx.questions || []), ...(idx.concepts || [])]) {
        if (base === 'data/_sample' && /not-yet/.test(f)) continue; // G検定のサンプルは「まだ無いファイル」の表示を見るため、わざと無いファイルを指す
        assert.ok(existsSync(join(root, app, base, f)), `${app}/${base}/${f} が無い`);
      }
    }
  });

  test(`${app}: 受験日・本番の形・公式の案内が書いてある`, () => {
    const c = readJson(app + '/config.json');
    assert.match(c.examDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(new Date(c.examDate + 'T00:00:00+09:00').getTime()), c.examDate + ' が実在しない日付');
    assert.equal(new Date(c.examDate + 'T00:00:00Z').toISOString().slice(0, 10), c.examDate, c.examDate + ' が繰り上がる（2月29日など）');
    assert.ok(Number.isInteger(c.exam.questions) && c.exam.questions > 0);
    assert.ok(Number.isInteger(c.exam.minutes) && c.exam.minutes > 0);
    assert.ok(Number.isInteger(c.secondsPerQuestion) && c.secondsPerQuestion > 0);
    assert.ok(c.about && c.about.examName && c.about.organizer && /^https:\/\//.test(c.about.organizerUrl));
    assert.ok(Array.isArray(c.officialLinks) && c.officialLinks.length > 0);
    for (const l of c.officialLinks) assert.match(l.url, /^https:\/\//);
  });
}

test('ai-passport: 本番の形は公式ページの試験概要のとおり（60分・60問。2026-10-13 取得）。受験日は 2027年2月試験の受験期間の最終日を仮に置く（要件定義書 §11）', () => {
  const c = readJson('ai-passport/config.json');
  assert.deepEqual({ questions: c.exam.questions, minutes: c.exam.minutes }, { questions: 60, minutes: 60 });
  assert.equal(c.secondsPerQuestion, 60);
  assert.equal(c.examDate, '2027-02-28');
  assert.equal(readJson('ai-passport/manifest.webmanifest').id, '/cert-quest/ai-passport/');
  assert.ok(existsSync(join(root, 'ai-passport', 'data', '_sample', 'index.json')), 'サンプル（?sample=1）が無い');
  // ボスは中項目ごとに1体、32体（§11-1。2026-10-13 先生「ボスの数はAで。」）
  assert.equal(readJson('ai-passport/data/bosses.json').length, 32);
  // シラバスは 2027年2月試験から適用の版（5章・中項目32・学習項目210）
  const syl = readJson('ai-passport/data/syllabus.json');
  assert.equal(syl.length, 5);
  assert.equal(syl.reduce((n, r) => n + r.children.length, 0), 32);
  assert.equal(syl.reduce((n, r) => n + r.children.reduce((k, m) => k + m.children.length, 0), 0), 210);
});

// ---- tools/check-coverage.js が、中項目に置いたキーワード（生成AIパスポートの形）を読む ----
function coverage(stemText) {
  const dir = mkdtempSync(join(tmpdir(), 'cq-cov-'));
  try {
    const d = join(dir, 'data');
    mkdirSync(join(d, 'questions'), { recursive: true });
    writeFileSync(join(d, 'syllabus.json'), readFileSync(join(root, 'ai-passport', 'data', 'syllabus.json')));
    const q = [{ id: 'G-01-001', syllabus: ['AIの基礎と歴史', 'AIの基本的な仕組み', 'AIとは'], stem: stemText, choices: [], explanation: '' }];
    writeFileSync(join(d, 'questions', '01.json'), JSON.stringify(q));
    const r = spawnSync(process.execPath, [join(root, 'tools', 'check-coverage.js'), join(d, 'questions', '01.json')], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('check-coverage.js: 生成AIパスポートの中項目のキーワード（AIの基本的な仕組みの4語）を数える。全部出れば通る', () => {
  const r = coverage('AI（人工知能）とルールベースと機械学習とディープラーニング（深層学習）');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /CH1-01 AIの基本的な仕組み（章・中項目）: 4\/4/);
  assert.match(r.out, /合計 4\/4/);
});

test('check-coverage.js: 中項目のキーワードが1つ欠けたら落ち、欠けた語を出す', () => {
  const r = coverage('AI（人工知能）とルールベースと機械学習');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /3\/4  未: ディープラーニング（深層学習）/);
});

test('check-coverage.js: 全角の括弧「A（B）」は、A か B のどちらかが出れば扱い済み', () => {
  const r = coverage('AIとルールベースと機械学習と深層学習');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /合計 4\/4/);
});

// ---- sc（情報処理安全確保支援士のアプリ。2026-10-29 先生決定。要件定義書 §12）----
test('sc: 名前は仮（ガードの砦）で、「支援士」を名前にもアイコンの下の名前にも使わない。試験名は副題にだけ、小さく添える', () => {
  const c = readJson('sc/config.json');
  const man = readJson('sc/manifest.webmanifest');
  assert.equal(c.name, 'ガードの砦');
  assert.match(c.subtitle, /^情報処理安全確保支援士試験 科目A-2対策$/);
  for (const v of [c.name, c.shortName, man.short_name]) assert.ok(!/支援士|情報処理安全確保/.test(v), v);
  assert.equal(man.id, '/cert-quest/sc/');
  const icon = readFileSync(join(root, 'sc', 'icons', 'icon.svg'), 'utf8');
  assert.ok(!/支援士/.test(icon), 'アイコンの絵に「支援士」の字を入れない');
});

test('sc: 本番の形は仮置き（科目A-2 は 25問・35分。IPA 検討状況 2026-03-31）。受験日は 2027年度の夏頃〜秋頃の仮', () => {
  const c = readJson('sc/config.json');
  assert.deepEqual({ questions: c.exam.questions, minutes: c.exam.minutes }, { questions: 25, minutes: 35 });
  assert.equal(c.secondsPerQuestion, Math.round((35 * 60) / 25));
  assert.ok(c.examDate >= '2027-07-01' && c.examDate <= '2027-12-31', c.examDate);
  assert.equal(c.about.organizerUrl, 'https://www.ipa.go.jp/');
  assert.ok(c.officialLinks.some((l) => l.url === 'https://www.ipa.go.jp/shiken/kubun/sc.html'));
  assert.ok(c.officialLinks.some((l) => l.url === 'https://www.ipa.go.jp/shiken/syllabus/henkou/2025/20260331.html'));
  assert.ok(!('trueBoss' in c) && !('passGuide' in c), '真ボス・合格の目安は決まるまで置かない（要件定義書 §12-1）');
  assert.ok(existsSync(join(root, 'sc', 'data', '_sample', 'index.json')), 'サンプル（?sample=1）が無い');
});

test('sc: シラバスは新試験シラバス（案）Ver.0.1 の科目A-2。中分類10・小分類44・項目112・用語例861。IPA の中分類の番号を ipaNo に持つ', () => {
  const syl = readJson('sc/data/syllabus.json');
  const chapters = syl.flatMap((r) => r.children);
  assert.equal(syl.length, 5);
  assert.equal(chapters.length, 10);
  assert.deepEqual(chapters.map((c) => c.ipaNo), [23, 24, 25, 26, 16, 17, 4, 12, 20, 21]);
  assert.deepEqual(chapters.map((c) => c.id), chapters.map((c) => 'M' + c.ipaNo));
  assert.deepEqual(chapters.map((c) => c.scope), ['専門知識', '専門知識', '専門知識', '専門知識', '専門知識', 'その他', 'その他', 'その他', 'その他', 'その他']);
  const subs = chapters.flatMap((c) => c.children);
  const items = subs.flatMap((s) => s.children);
  assert.equal(subs.length, 44);
  assert.equal(items.length, 112);
  assert.equal(items.reduce((n, i) => n + i.keywords.length, 0), 861);
  for (const i of items) assert.ok(i.keywords.length > 0 && i.children.length === 0, i.id + ' に用語例が無い・下がある');
  // check-coverage.js は小分類（3段目）のキーワードを読む。項目の用語例を全部まとめて持つ
  for (const s of subs) assert.deepEqual(s.keywords, [...new Set(s.children.flatMap((i) => i.keywords))], s.id);
  // 版と出典の URL（要件定義書 §12）
  for (const r of syl) {
    assert.equal(r.source.version, 'Ver.0.1（案）');
    assert.equal(r.source.url, 'https://www.ipa.go.jp/shiken/syllabus/minaoshi/rcu1hd000001g5rk-att/syllabus_sc_ver0_1.pdf');
  }
  // 表の崩れを写していない: 括弧の対応・全角空白・制御文字
  for (const i of items) for (const k of i.keywords) {
    assert.equal(k.split('（').length, k.split('）').length, i.id + ' の「' + k + '」の括弧が合わない');
    assert.ok(!/[\u0000-\u001f\u3000]/.test(k), i.id + ' の「' + k + '」に制御文字・全角空白');
  }
});

test('check-coverage.js: sc のシラバス（小分類に用語例を持つ形）を読んで、章（中分類）の用語例を数える', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cq-sc-cov-'));
  try {
    const d = join(dir, 'data');
    mkdirSync(join(d, 'questions'), { recursive: true });
    writeFileSync(join(d, 'syllabus.json'), readFileSync(join(root, 'sc', 'data', 'syllabus.json')));
    const sub = readJson('sc/data/syllabus.json')[0].children[0].children[1]; // M23-2 攻撃手法
    const q = [{ id: 'SC-01-001', syllabus: ['セキュリティ', '情報セキュリティの脅威', sub.title], stem: 'SQL インジェクション', choices: [], explanation: '' }];
    writeFileSync(join(d, 'questions', '01.json'), JSON.stringify(q));
    const r = spawnSync(process.execPath, [join(root, 'tools', 'check-coverage.js'), join(d, 'questions', '01.json')], { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.equal(r.status, 1, out);
    const chap = readJson('sc/data/syllabus.json')[0].children[0].children;
    assert.ok(out.includes('M23-2 ' + sub.title + ': 1/' + sub.keywords.length + ' '), '攻撃手法の用語例を数えていない: ' + out.slice(0, 200));
    assert.ok(out.includes('合計 1/' + chap.reduce((n, s) => n + s.keywords.length, 0) + '（未 '), '章の合計が合わない');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
