// プライバシーポリシーと利用規約: 文面の決まり、単独ページ（privacy.html・terms.html）が文面と一致すること、
// 画面・入口・オフライン登録・SW の版が揃っていること。仕様は docs/01_要件定義/要件定義書.md §3-3。
// 実行: cd shared && node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS, APP_NAMES, CONTACT, PENDING, MEASURE_CANDIDATES, PAGE_FILE, SITE_BASE, plainText, splitContact, otherDoc } from '../js/lib/legal.js';
import { buildLegalPage } from '../../tools/build-legal.mjs';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const KINDS = ['privacy', 'terms'];

test('文書: 2つ。章の ID が重ならず、どの章にも見出しと中身がある', () => {
  assert.deepEqual(Object.keys(DOCS).sort(), ['privacy', 'terms']);
  for (const k of KINDS) {
    const d = DOCS[k];
    assert.ok(d.title && d.lead.length >= 1);
    const ids = d.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, k + ' の章 ID が重なる');
    for (const s of d.sections) {
      assert.ok(s.title && s.blocks.length >= 1, k + '/' + s.id);
      for (const b of s.blocks) assert.ok(typeof b === 'string' || Array.isArray(b.ul) || Array.isArray(b.links), k + '/' + s.id + ' の中身の形');
    }
  }
});

test('アプリ名: 文面の APP_NAMES は、全アプリの config.json の name と一致し、本文に出る', () => {
  const apps = readdirSync(root).filter((d) => existsSync(join(root, d, 'config.json')) && existsSync(join(root, d, 'sw.js')));
  assert.ok(apps.length >= 2, '資格アプリが ' + apps.length + ' 個');
  const names = apps.map((a) => JSON.parse(readFileSync(join(root, a, 'config.json'), 'utf8')).name);
  assert.deepEqual([...names].sort(), [...APP_NAMES].sort(), '文面のアプリ名と config.json の name が違う');
  for (const k of KINDS) for (const n of APP_NAMES) assert.ok(plainText(k).includes(n), k + ' に ' + n + ' が無い');
});

test('利用者に見せない語（開発用の語・設計の ID）が、文面に出ない', () => {
  const BAD = /仮|TODO|未確定|未実装|準備中|\bP\d\b|\bUC-|\bSCR-|\bLAW-|MVP|§/;
  for (const k of KINDS) {
    const m = plainText(k).match(BAD);
    assert.equal(m, null, k + ' に ' + (m && m[0]) + ' が出ている');
  }
});

test('プライバシーポリシー: 保有個人データの公表事項（個人情報保護法 32条1項・施行令10条）が揃っている', () => {
  const t = plainText('privacy');
  const must = [
    ['運営者の名称', 'Aisunia'],
    ['住所（請求に答える形）', '氏名と住所は、ご請求があれば'],
    ['利用目的', '利用目的'],
    ['開示等の請求の手続', '個人情報の請求'],
    ['安全管理のために講じた措置', '安全管理のために行っていること'],
    ['苦情の申出先', '苦情の申出先'],
    ['連絡先', CONTACT],
    ['GitHub が IP アドレスを記録すること', 'IP アドレス'],
    ['端末内だけに保存すること', 'localStorage'],
  ];
  for (const [what, s] of must) assert.ok(t.includes(s), what + '（' + s + '）が無い');
  // 通則編ガイドラインが『適切ではない』とする書き方
  assert.ok(!t.includes('通則編'), '『ガイドラインに沿って実施している』だけの書き方にしない');
  // 確かめていないことを書かない: 運営が GitHub のログを見られるかは未確認
  assert.ok(!/(IP アドレス|ログ)[^。\n]*(取得しません|見ません|見られません|取得していません)/.test(t), 'GitHub のログを運営が見ない、とは書けない（未確認）');
});

test('利用規約: 免責は『一切責任を負わない』にせず、故意・重大な過失を除き、軽い過失だけを限る（消費者契約法 8条）', () => {
  const t = plainText('terms');
  assert.ok(!/一切/.test(t), '『一切』は使わない');
  assert.ok(!t.includes('責任を負わない'), '責任の全部を免除する書き方にしない');
  assert.ok(t.includes('故意または重大な過失がある場合には、次の定めは当てはまりません'));
  assert.ok(t.includes('軽い過失（重大な過失を除く過失）があった場合に限り'));
  assert.ok(!/支払った金額/.test(t), '賠償額を支払額で区切らない（無料なら0円＝全部免責になる）');
  assert.ok(t.includes('いつでも本アプリを使うのをやめられます'), 'やめる自由（消費者契約法 8条の2）');
  assert.ok(t.includes('効力が生じる時期') && t.includes('その時期より前に'), '規約の変更の手続（民法 548条の4 第2項・第3項）');
  assert.ok(!/専属/.test(t), '専属的な管轄は書かない');
  assert.ok(!/特定商取引|特商法/.test(t), '特商法の表示は今回作らない。屋号のみで満たすとは書かない');
});

test('仮の文言（先生の確認待ち P1〜P9）: 文面にそのまま入っていて、要件定義書に ID がある', () => {
  assert.deepEqual(PENDING.map((p) => p.id), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']);
  const spec = read('docs/01_要件定義/要件定義書.md');
  for (const p of PENDING) {
    const kinds = p.doc === 'both' ? KINDS : [p.doc];
    for (const k of kinds) assert.ok(plainText(k).includes(p.text), p.id + ' の仮の文言が ' + k + ' に無い: ' + p.text);
    assert.ok(new RegExp('\\| ' + p.id + ' \\|').test(spec), p.id + ' が要件定義書の表に無い');
  }
});

test('安全管理措置の候補（P3）は、先生が確かめるまで、文面に載せない', () => {
  assert.ok(MEASURE_CANDIDATES.length >= 3);
  for (const c of MEASURE_CANDIDATES) for (const k of KINDS) assert.ok(!plainText(k).includes(c), c + ' が文面に載っている');
});

test('連絡先の文字列を、メールアドレスで区切れる', () => {
  assert.deepEqual(splitContact('宛先：' + CONTACT + ' まで'), [{ text: '宛先：' }, { mail: CONTACT }, { text: ' まで' }]);
  assert.deepEqual(splitContact('なし'), [{ text: 'なし' }]);
  assert.deepEqual(splitContact(CONTACT), [{ mail: CONTACT }]);
  assert.equal(otherDoc('privacy'), 'terms');
});

test('単独ページ: privacy.html・terms.html が、文面から作り直した結果と一致する（古ければ node tools/build-legal.mjs）', () => {
  for (const k of KINDS) {
    assert.ok(existsSync(join(root, PAGE_FILE[k])), PAGE_FILE[k] + ' が無い');
    assert.equal(read(PAGE_FILE[k]), buildLegalPage(k), PAGE_FILE[k] + ' が文面と食い違う。node tools/build-legal.mjs で作り直す');
    assert.ok(!readFileSync(join(root, PAGE_FILE[k]), 'utf8').includes('\r'), PAGE_FILE[k] + ' は改行 LF');
  }
});

test('単独ページ: JavaScript なしで本文が読め、外部の読み込みは無く、ストアに書く URL の土台がアプリと同じ', () => {
  for (const k of KINDS) {
    const html = read(PAGE_FILE[k]);
    assert.ok(html.includes('<h1>' + DOCS[k].title + '</h1>'));
    for (const s of DOCS[k].sections) assert.ok(html.includes('<h2>' + s.title + '</h2>'), k + '/' + s.id);
    assert.ok(html.includes('href="mailto:' + CONTACT + '"'));
    assert.equal((html.match(/<script/g) || []).length, 1, 'script は配色を決める1つだけ');
    assert.ok(!/<script[^>]*src=/.test(html));
    assert.ok(/<link rel="stylesheet" href="shared\/css\/app\.css">/.test(html));
    assert.ok(!/<(img|iframe|link)[^>]*(src|href)="https?:/.test(html), '外部のものを読み込まない');
    assert.ok(html.includes('<meta name="viewport"'));
    assert.ok(html.includes('href="' + PAGE_FILE[otherDoc(k)] + '"'), 'もう1つの文書へのリンク');
  }
  // 公開 URL の土台は、manifest.test.js と同じ
  assert.ok(read('shared/tests/manifest.test.js').includes("const BASE = '" + SITE_BASE + "'"));
});

test('入口: ルート #/privacy #/terms、「このアプリについて」のボタン、タイトル画面のリンク', () => {
  const app = read('shared/js/app.js');
  assert.ok(app.includes("import { renderPrivacy, renderTerms } from './views/legal.js';"));
  assert.ok(app.includes("['privacy', 'more', () => renderPrivacy(app)]"));
  assert.ok(app.includes("['terms', 'more', () => renderTerms(app)]"));
  const about = read('shared/js/views/about.js');
  assert.ok(about.includes('legalMenuCard(app)'));
  const view = read('shared/js/views/legal.js');
  assert.ok(view.includes("app.go('#/privacy')") && view.includes("app.go('#/terms')"));
  const title = read('shared/js/views/title.js');
  assert.ok(title.includes('data-title-legal') && title.includes('legalLink(\'terms\')') && title.includes('legalLink(\'privacy\')'));
  assert.ok(title.includes("target: '_blank'") && title.includes("rel: 'noopener noreferrer'"));
  // 画面は、データ由来の文字を textContent で入れる（innerHTML を使わない）
  assert.ok(!/innerHTML/.test(view));
});

test('オフライン: 文面と画面が sw-core の SHARED に載っていて、実在する。両アプリの SW の版が同じ', () => {
  const core = read('shared/sw-core.js');
  for (const f of ['js/lib/legal.js', 'js/views/legal.js']) {
    assert.ok(core.includes("'../shared/" + f + "'"), f + ' が SHARED に無い');
    assert.ok(existsSync(join(shared, f)), f + ' が無い');
  }
  const apps = readdirSync(root).filter((d) => existsSync(join(root, d, 'sw.js')));
  const versions = apps.map((a) => /version: '(\d+)'/.exec(read(a + '/sw.js'))[1]);
  assert.equal(new Set(versions).size, 1, '両アプリの SW の版が違う: ' + versions);
  assert.ok(Number(versions[0]) >= 35, '文面を足した版は 35 以上（古いキャッシュを捨てる合図）: ' + versions[0]);
});

test('送信しない: shared/js の fetch は、外部のホストを指さない（学習記録を運営に送らない、の裏づけ）', () => {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(join(shared, d), { withFileTypes: true })) { if (e.isDirectory()) walk(d + '/' + e.name); else if (e.name.endsWith('.js')) files.push(d + '/' + e.name); } };
  walk('js');
  assert.ok(files.length > 20);
  for (const f of files) {
    const src = readFileSync(join(shared, f), 'utf8');
    assert.ok(!/sendBeacon|XMLHttpRequest|WebSocket|EventSource/.test(src), f + ' に送信の仕組み');
    for (const line of src.split('\n')) if (/\bfetch\(/.test(line)) assert.ok(!/https?:\/\//.test(line), f + ' の fetch が外部を指す: ' + line.trim());
  }
});
