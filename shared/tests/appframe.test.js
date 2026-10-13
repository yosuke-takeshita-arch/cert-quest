// 地図1つのアプリ（g-kentei・dx-biz・ai-passport。tests/apps.js が探す）の枠が、互いに食い違っていないかの検証。
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

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
function swConfig(app) {
  const src = readFileSync(join(root, app, 'sw.js'), 'utf8');
  const m = {};
  vm.runInNewContext(src.replace(/importScripts\([^)]*\);?/, ''), { self: new Proxy({}, { set(_, k, v) { m[k] = v; return true; } }) });
  return { src, cfg: m.CERT_QUEST };
}

test('一覧: 地図1つのアプリとして g-kentei・dx-biz・ai-passport が見つかる（科目のある shindanshi は入らない）', () => {
  for (const a of ['g-kentei', 'dx-biz', 'ai-passport']) assert.ok(APPS.includes(a), a);
  assert.ok(!APPS.some((a) => a.startsWith('shindanshi')));
});

for (const app of APPS) {
  test(`${app}: config・sw.js・manifest・index.html の名前と色と id がそろっている`, () => {
    const config = readJson(app + '/config.json');
    assert.equal(config.id, app, 'config.json の id はディレクトリ名と同じ（記録の保存キーと書き出しのファイル名に使う）');
    const { src, cfg } = swConfig(app);
    assert.equal(cfg.appId, app);
    assert.match(String(cfg.version), /^[1-9]\d*$/);
    assert.match(src, /importScripts\('\.\.\/shared\/sw-core\.js'\)/);
    const man = readJson(app + '/manifest.webmanifest');
    assert.equal(man.name, config.name);
    assert.equal(man.short_name, config.shortName);
    assert.equal(man.theme_color, config.theme.light.accent);
    const html = readFileSync(join(root, app, 'index.html'), 'utf8');
    assert.equal((/<title>([^<]*)<\/title>/.exec(html) || [])[1], config.name);
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
  // ボスの名前・せりふ（bosses.json）は、ボスの単位を先生が決めるまで置かない（§11-1）
  assert.ok(!existsSync(join(root, 'ai-passport', 'data', 'bosses.json')));
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
