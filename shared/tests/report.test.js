// 「誤りを報告」の開き先の組み立て（https と mailto）。文字のエンコードまで確かめる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportUrl, headOf, reportBase, reportTarget, reportHint, REPORT_HEAD_CHARS, REPORT_SHOT_NOTE } from '../js/lib/report.js';

const CFG = { id: 'g-kentei', name: 'G検定クエスト', reportUrl: 'https://github.com/yosuke-takeshita-arch/cert-quest/issues/new' };
const MAIL = { id: 'g-kentei', name: 'G検定クエスト', reportUrl: 'mailto:report@example.test' };
const parse = (u) => { const url = new URL(u); return { url, title: url.searchParams.get('title'), body: url.searchParams.get('body') }; };
// mailto の ?subject=…&body=… を取り出す（URL クラスは mailto の検索部を扱えるが、念のため自分で割る）
const mailParts = (u) => {
  const [head, q] = u.split('?');
  const o = {};
  for (const kv of q.split('&')) { const i = kv.indexOf('='); o[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }
  return { head, subject: o.subject, body: o.body };
};

test('問題: GitHub Issues の新規作成ページに title と body が付く', () => {
  const u = buildReportUrl(CFG, { kind: 'question', id: 'G-03-026', text: '割引率が高いとき、将来の報酬は…' });
  assert.ok(u.startsWith('https://github.com/yosuke-takeshita-arch/cert-quest/issues/new?title='));
  const p = parse(u);
  assert.equal(p.url.pathname, '/yosuke-takeshita-arch/cert-quest/issues/new');
  assert.equal(p.title, '【誤りの報告】G検定クエスト 問題 G-03-026');
  assert.ok(p.body.includes('アプリ: G検定クエスト（g-kentei）'));
  assert.ok(p.body.includes('問題ID: G-03-026'));
  assert.ok(p.body.includes('冒頭: 割引率が高いとき、将来の報酬は…'));
  assert.ok(p.body.includes(REPORT_SHOT_NOTE));
});

test('用語カード: 種別の表示が変わる', () => {
  const p = parse(buildReportUrl(CFG, { kind: 'card', id: 'C-0001', text: '活性化関数' }));
  assert.equal(p.title, '【誤りの報告】G検定クエスト 用語カード C-0001');
  assert.ok(p.body.includes('用語カードID: C-0001'));
});

test('https: 空白は %20、改行は %0A、& # ? 日本語 絵文字が壊れない', () => {
  const text = 'A&B=C #1 ?x /y 100% "q" <b>タグ</b> 😀 \n 改行';
  const u = buildReportUrl(CFG, { kind: 'question', id: 'X&Y#1', text });
  assert.ok(!u.includes(' '));
  assert.ok(!u.includes('+'));
  assert.ok(u.includes('%20'));
  assert.ok(u.includes('%0A'));
  const p = parse(u);
  assert.equal(p.url.hash, '');
  assert.equal([...p.url.searchParams.keys()].join(','), 'title,body');
  assert.ok(p.title.endsWith('X&Y#1'));
  assert.ok(p.body.includes('冒頭: A&B=C #1 ?x /y 100% "q" <b>タグ</b> 😀 改行'));
});

test('mailto: subject と body が付き、改行は %0D%0A、最後にスクリーンショットの一言', () => {
  const u = buildReportUrl(MAIL, { kind: 'question', id: 'G-03-026', text: '割引率が高いとき…' });
  assert.ok(u.startsWith('mailto:report@example.test?subject='));
  assert.ok(u.includes('%0D%0A'));
  assert.ok(!/%0A/.test(u.replace(/%0D%0A/g, '')), '改行は CRLF だけ');
  assert.ok(!u.includes(' ') && !u.includes('\n'));
  const m = mailParts(u);
  assert.equal(m.head, 'mailto:report@example.test');
  assert.equal(m.subject, '【誤りの報告】G検定クエスト 問題 G-03-026');
  assert.ok(m.body.includes('アプリ: G検定クエスト（g-kentei）\r\n問題ID: G-03-026\r\n冒頭: 割引率が高いとき…'));
  assert.ok(m.body.endsWith(REPORT_SHOT_NOTE));
  assert.equal(REPORT_SHOT_NOTE, '画面のスクリーンショットを添付していただけると助かります。');
});

test('mailto: 日本語・改行・& ? # = の入った冒頭がエンコードされ、パラメータを割らない', () => {
  const text = '次のうち、A&B は？\n  #1 x=y と 100% 😀';
  const u = buildReportUrl(MAIL, { kind: 'card', id: 'C&1?', text });
  assert.equal(u.split('?').length, 2); // 「?」は区切りの1つだけ
  assert.equal(u.split('&').length, 2); // 「&」は subject と body の間の1つだけ
  assert.ok(!u.includes('#'));
  const m = mailParts(u);
  assert.equal(m.subject, '【誤りの報告】G検定クエスト 用語カード C&1?');
  assert.ok(m.body.includes('冒頭: 次のうち、A&B は？ #1 x=y と 100% 😀'));
  assert.ok(m.body.includes('用語カードID: C&1?'));
});

test('mailto: 宛先の読み取り（%40・複数の宛先・不正）', () => {
  assert.deepEqual(reportTarget({ reportUrl: 'mailto:a.b+c@example.test' }), { kind: 'mailto', address: 'a.b+c@example.test', query: '' });
  assert.equal(reportTarget({ reportUrl: 'MAILTO:a%40example.test' }).address, 'a@example.test');
  assert.equal(reportBase({ reportUrl: 'mailto:a@example.test' }), 'mailto:a@example.test');
  for (const bad of ['mailto:', 'mailto:abc', 'mailto:a@b', 'mailto:a@example.test,b@example.test', 'mailto:a b@example.test', 'mailto:@example.test', 'mailto:a@example.test:x']) {
    assert.equal(reportTarget({ reportUrl: bad }), null, bad);
    assert.equal(buildReportUrl({ name: 'x', reportUrl: bad }, { kind: 'question', id: 'Q1', text: 't' }), null, bad);
  }
});

test('案内の文: 先に合わせて出る（スクリーンショットに触れる）。先が無ければ空', () => {
  assert.ok(reportHint(MAIL).includes('メール') && reportHint(MAIL).includes('スクリーンショット'));
  assert.ok(reportHint(CFG).includes('スクリーンショット'));
  assert.equal(reportHint({}), '');
  assert.equal(reportHint({ reportUrl: 'http://x.test/' }), '');
});

test('冒頭は空白を整え、60文字で切る（絵文字を割らない）', () => {
  assert.equal(headOf('  a \n\n  b\t c  '), 'a b c');
  assert.equal(headOf('あ'.repeat(REPORT_HEAD_CHARS)), 'あ'.repeat(REPORT_HEAD_CHARS));
  assert.equal(headOf('あ'.repeat(REPORT_HEAD_CHARS + 1)), 'あ'.repeat(REPORT_HEAD_CHARS) + '…');
  const emoji = headOf('😀'.repeat(61));
  assert.equal(Array.from(emoji).length, 61);
  assert.equal(headOf(undefined), '');
  assert.equal(headOf(null), '');
  assert.equal(headOf(12345), '12345');
});

test('報告の先が未設定・不正ならボタンを出さない（null）', () => {
  const item = { kind: 'question', id: 'Q1', text: 't' };
  for (const bad of [undefined, null, '', '   ', 'not a url', 'http://example.com/new', 'javascript:alert(1)', 'ftp://x/y', 5, {}]) {
    assert.equal(buildReportUrl({ name: 'x', reportUrl: bad }, item), null, String(bad));
    assert.equal(reportBase({ reportUrl: bad }), null, String(bad));
  }
  assert.equal(buildReportUrl({ name: 'x' }, item), null);
  assert.equal(buildReportUrl(null, item), null);
  assert.equal(buildReportUrl(CFG, { kind: 'question', id: '', text: 't' }), null);
  assert.equal(buildReportUrl(CFG, null), null);
});

test('報告の先を差し替えても動く（別の https・すでに ? がある URL）', () => {
  const u = buildReportUrl({ ...CFG, reportUrl: 'https://example.com/form?src=app' }, { kind: 'question', id: 'Q1', text: 't' });
  const p = parse(u);
  assert.equal(p.url.searchParams.get('src'), 'app');
  assert.ok(p.title.includes('Q1'));
  assert.equal(p.url.host, 'example.com');
});
