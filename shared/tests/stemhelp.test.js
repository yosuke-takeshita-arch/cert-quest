// 問題文の意味: 出し分け（stemPlain の有無・用語の有無）、答えになる用語を出さない決まり、模擬試験に出さないこと、画面の結線。
// 実行: cd shared && node --test tests/stemhelp.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeQuestion, normalizeConcept, buildConceptIndex } from '../js/lib/data.js';
import { stemHelp, titleVariants, leaksAnswer, longestCommon, STEM_PLAIN_MAX, MAX_TERMS, OVERLAP_LIMIT } from '../js/lib/stemhelp.js';

const shared = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(shared, '..');
const src = (p) => readFileSync(join(shared, p), 'utf8');

const card = (id, title, oneLine) => normalizeConcept({ id, title, oneLine, why: 'w', syllabus: ['a'] });
const ask = (q, cards, choices) => {
  const concepts = cards.map((c) => (c.id ? c : card(...c)));
  const nq = normalizeQuestion({ id: 'G-01-001', syllabus: ['a'], answer: 0, choices: ['選択肢甲です', '選択肢乙です'], ...q });
  return stemHelp(nq, concepts, buildConceptIndex(concepts), choices);
};
const titles = (r) => r.terms.map((c) => c.title);

// ---- 出し分けの材料: stemPlain の有無・用語の有無 ----

test('stemPlain: データの整形で残る（前後の空白は削る・無ければ空文字・文字列以外は空文字）', () => {
  const base = { id: 'G-01-001', syllabus: ['a'], stem: 's', choices: ['x', 'y'], answer: 0 };
  assert.equal(normalizeQuestion({ ...base, stemPlain: '  やさしく言うと  ' }).stemPlain, 'やさしく言うと');
  assert.equal(normalizeQuestion(base).stemPlain, '');
  assert.equal(normalizeQuestion({ ...base, stemPlain: 5 }).stemPlain, '');
});

test('出し分け: stemPlain があれば plain に入る。無ければ空（用語だけ出る）', () => {
  const cs = [['C-01-001', '過学習', '訓練データに合わせすぎて新しいデータに弱くなること。']];
  const a = ask({ stem: '過学習について述べた文はどれか。', stemPlain: '何を聞かれているかの言い直し' }, cs);
  assert.equal(a.plain, '何を聞かれているかの言い直し');
  assert.deepEqual(titles(a), ['過学習']);
  const b = ask({ stem: '過学習について述べた文はどれか。' }, cs);
  assert.equal(b.plain, '');
  assert.deepEqual(titles(b), ['過学習']);
});

test('出し分け: stemPlain も用語も無ければ、何も出ない（ボタンを出さない合図）', () => {
  const r = ask({ stem: '次の記述のうち正しいものはどれか。' }, [['C-01-001', '過学習', '説明']]);
  assert.equal(r.plain, '');
  assert.equal(r.terms.length, 0);
});

test('出し分け: stemPlain だけでも出る（用語が無くても）', () => {
  const r = ask({ stem: '次の記述のうち正しいものはどれか。', stemPlain: '正しいものを選ぶ問題です' }, []);
  assert.equal(r.plain, '正しいものを選ぶ問題です');
  assert.equal(r.terms.length, 0);
});

// ---- どの用語を出すか ----

test('題名が問題文に出てくるカードだけ出す。q.concepts にあっても、題名が問題文に無ければ出さない（答え側の用語のため）', () => {
  const cs = [['C-01-001', '勾配消失問題', '層が深いと学習が進まなくなる問題。'], ['C-01-002', 'ReLU', '負の入力を0にする活性化関数。']];
  const r = ask({ stem: '深い層の学習で起きる問題について。', concepts: ['C-01-001', 'C-01-002'] }, cs);
  assert.equal(r.terms.length, 0);
  const r2 = ask({ stem: 'ReLU が使われる理由は何か。', concepts: ['C-01-001', 'C-01-002'] }, cs);
  assert.deepEqual(titles(r2), ['ReLU']);
});

test('題名の呼び名: かっこの前・かっこの中でも見つかる。英数字だけの2文字以下と、英数字の語の途中は数えない', () => {
  assert.deepEqual(titleVariants('ReLU（ランプ関数）').sort(), ['relu', 'relu(ランプ関数)', 'ランプ関数'].sort());
  assert.deepEqual(titleVariants('AI'), []);
  // かっこの中が英数字と日本語の混ざった語（『DXレポート』）は呼び名にしない（別の用語と取り違えるため）
  assert.deepEqual(titleVariants('2025年の崖（DXレポート）').sort(), ['2025年の崖', '2025年の崖(dxレポート)'].sort());
  const cs = [['C-01-001', 'ReLU（ランプ関数）', '負なら0・正ならそのまま返す関数。'], ['C-01-002', 'AI', 'ひと言の説明。'], ['C-01-003', 'RNN', '系列を扱うネットワーク。']];
  assert.deepEqual(titles(ask({ stem: 'ランプ関数の特徴は何か。' }, cs)), ['ReLU（ランプ関数）']);
  assert.deepEqual(titles(ask({ stem: 'AI の話。' }, cs)), []); // 2文字は数えない
  assert.deepEqual(titles(ask({ stem: 'SRNNX の話。' }, cs)), []); // 語の途中
  assert.deepEqual(titles(ask({ stem: 'RNN の話。' }, cs)), ['RNN']);
});

test('別の題名にすっぽり含まれる題名は出さない。出す順は問題文に出てくる順', () => {
  const cs = [['C-01-001', '学習', 'なにかを身につけること。'], ['C-01-002', '機械学習', 'データから規則を見つける技術。'], ['C-01-003', '推論', '学習した結果を使うこと。']];
  assert.deepEqual(titles(ask({ stem: '推論と機械学習の関係について。' }, cs)), ['推論', '機械学習']);
});

test('上限 MAX_TERMS 枚。oneLine が空のカードは出さない', () => {
  const names = ['りんご', 'みかん', 'ぶどう', 'もも', 'なし', 'すいか', 'いちご'];
  const cs = names.map((n, i) => ['C-01-00' + (i + 1), n + '論', n + 'の説明をします。']);
  cs.push(['C-01-009', '空説明論', '']);
  const stem = names.map((n) => n + '論').join('と') + 'と空説明論について。';
  const r = ask({ stem }, cs);
  assert.equal(r.terms.length, MAX_TERMS);
  assert.ok(!titles(r).includes('空説明論'));
  assert.deepEqual(titles(r), names.slice(0, MAX_TERMS).map((n) => n + '論'));
});

// ---- 答えになる用語を出さない決まり ----

test('出さない① 題名が選択肢に出てくる用語（その用語が選択肢で問われている）', () => {
  const cs = [['C-01-001', 'ドロップアウト', 'ランダムにノードを無効にして過学習を防ぐ手法。'], ['C-01-002', '過学習', '訓練データに偏りすぎる現象。']];
  const r = ask({ stem: '過学習を防ぐ手法はどれか。', choices: ['ドロップアウト', 'バッチ処理'] }, cs);
  assert.deepEqual(titles(r), ['過学習']); // 過学習は選択肢に出ない
  const r2 = ask({ stem: '過学習を防ぐ手法はどれか。', choices: ['過学習の判定に使う', 'バッチ処理'] }, cs);
  assert.deepEqual(titles(r2), []);
});

test('出さない② 選択肢が題名そのもの（「〜を何というか」で選択肢が用語名）', () => {
  const cs = [['C-01-001', '敵対的生成ネットワーク（GAN）', '生成器と識別器を競わせて学ぶモデル。']];
  const r = ask({ stem: '敵対的生成ネットワークの略称は何か。', choices: ['GAN', 'RNN'] }, cs);
  assert.deepEqual(titles(r), []);
  const r2 = ask({ stem: '敵対的生成ネットワークの略称は何か。', choices: ['ジーエー', 'アールエヌ'] }, cs);
  assert.deepEqual(titles(r2), ['敵対的生成ネットワーク（GAN）']);
});

test('出さない③ 一言説明が選択肢と OVERLAP_LIMIT 文字以上同じ文字並びを共有する（境目: 10文字は出さない・9文字は出す）', () => {
  assert.equal(OVERLAP_LIMIT, 10);
  const one = 'データの中から有益な規則を見つけ出す作業のこと。';
  const mk = (frag) => ask({ stem: 'テキストマイニングとはどのようなものか。', choices: [frag, '全く関係のない別の話'] }, [['C-01-001', 'テキストマイニング', one]]);
  // 共有部分が 13文字 → 出さない／ 10文字ちょうど → 出さない／ 9文字 → 出す
  assert.deepEqual(titles(mk('有益な規則を見つけ出す作業')), []); // 13文字
  assert.deepEqual(titles(mk('有益な規則を見つけ出')), []); // 10文字ちょうど
  assert.deepEqual(titles(mk('益な規則を見つけ出')), ['テキストマイニング']); // 9文字
});

test('longestCommon: 共通部分の長さ。記号と空白は数えない（leaksAnswer の下ごしらえ）', () => {
  assert.equal(longestCommon('abcdef', 'xxcdexx'), 3);
  assert.equal(longestCommon('', 'abc'), 0);
  const c = normalizeConcept({ id: 'C-01-001', title: '用語', oneLine: 'あいうえお、かきくけこ。さしすせそ' });
  assert.equal(leaksAnswer(c, titleVariants('用語'), ['あいうえお かきくけこ']), true); // 空白・読点を除くと10文字一致
  assert.equal(leaksAnswer(c, titleVariants('用語'), ['あいうえお かきくけ']), false); // 9文字
});

test('出さない: 正解だけでなく全選択肢で判定する（誤答の説明でも消去法の手がかりになる）', () => {
  const cs = [['C-01-001', '汎化性能', '未知のデータに対する予測の当たりやすさ。']];
  const r = ask({ stem: '汎化性能が高いとはどういうことか。', choices: ['訓練データだけに強い', '汎化性能が低い状態のこと'], answer: 0 }, cs);
  assert.deepEqual(titles(r), []); // 誤答側の選択肢に題名がある
});

test('選択肢の並び（シャッフル後）に引数で渡しても、同じ判定になる', () => {
  const cs = [['C-01-001', '過学習', '訓練データに偏りすぎる現象。']];
  const q = { stem: '過学習の説明はどれか。', choices: ['A案です', 'B案です'] };
  assert.deepEqual(titles(ask(q, cs, ['B案です', 'A案です'])), ['過学習']);
  assert.deepEqual(titles(ask(q, cs, ['過学習に関する案', 'B案です'])), []);
});

// ---- 実データ: どの問題でも、出る用語が決まりに当たらないこと ----

for (const app of ['g-kentei', 'dx-biz']) {
  test(`実データ(${app}): 出る用語は、どの問題でも題名が問題文にあり、選択肢と重ならない。出る問題が1件以上ある`, () => {
    const dir = join(root, app, 'data');
    const read = (sub, key) => readdirSync(join(dir, sub)).filter((f) => f.endsWith('.json')).flatMap((f) => {
      const j = JSON.parse(readFileSync(join(dir, sub, f), 'utf8'));
      return Array.isArray(j) ? j : j[key];
    });
    const concepts = read('concepts', 'concepts').map(normalizeConcept).filter(Boolean);
    const questions = read('questions', 'questions').map(normalizeQuestion).filter(Boolean);
    const index = buildConceptIndex(concepts);
    const norm = (s) => s.normalize('NFKC').toLowerCase();
    let shown = 0;
    for (const q of questions) {
      const r = stemHelp(q, concepts, index, q.choices);
      assert.ok(r.terms.length <= MAX_TERMS, q.id);
      if (r.terms.length) shown++;
      for (const c of r.terms) {
        assert.ok(titleVariants(c.title).some((v) => norm(q.stem).includes(v)), `${q.id} ${c.title}: 題名が問題文に無い`);
        assert.ok(c.oneLine, `${q.id} ${c.title}: 一言説明が空`);
        assert.equal(leaksAnswer(c, titleVariants(c.title), q.choices), false, `${q.id} ${c.title}: 選択肢と重なっている`);
      }
    }
    assert.ok(questions.length > 0 && shown > 0, `用語が出る問題が無い（問題 ${questions.length}）`);
  });
}

// ---- 画面: ボタンの出し分けと開閉（簡易 DOM で動かす。ブラウザでの見た目は Playwright で確かめる） ----

class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ''; this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  click() { (this.listeners.click || []).forEach((f) => f()); }
  find(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof FakeEl) c.find(pred, out); return out; }
}
globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (s) => ({ text: s }) };
globalThis.location = { href: 'http://localhost/g-kentei/' };
const { stemHelpBlock } = await import('../js/views/stemhelp.js');

function appWith(cards) {
  const concepts = cards.map((c) => card(...c));
  return { data: { concepts, conceptIndex: buildConceptIndex(concepts) } };
}
const mkQ = (o) => normalizeQuestion({ id: 'G-01-001', syllabus: ['a'], answer: 0, choices: ['選択肢甲です', '選択肢乙です'], ...o });

test('画面: 出すものが無い問題ではボタンを出さない（null）', () => {
  assert.equal(stemHelpBlock(appWith([]), mkQ({ stem: '次のうち正しいものはどれか。' }), ['甲', '乙'], () => {}), null);
});

test('画面: stemPlain だけでも出る。ボタンは閉じた状態で始まり、押すと開き、もう一度押すと閉じる（aria-expanded が追従）', () => {
  const el = stemHelpBlock(appWith([]), mkQ({ stem: '次のうち正しいものはどれか。', stemPlain: '正しい説明を選ぶ問題です。' }), ['甲', '乙'], () => {});
  const [btn] = el.find((e) => e.tag === 'button' && e.className.includes('stem-help-btn'));
  const [body] = el.find((e) => e.className.includes('stem-help-body'));
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(btn.getAttribute('aria-controls'), body.getAttribute('id'));
  assert.ok(body.hasAttribute('hidden'));
  assert.equal(btn.children[0].text, '問題文の意味');
  btn.click();
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.ok(!body.hasAttribute('hidden'));
  btn.click();
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.ok(body.hasAttribute('hidden'));
  const [plainP] = el.find((e) => e.tag === 'p');
  assert.equal(plainP.textContent, '正しい説明を選ぶ問題です。');
  assert.equal(el.find((e) => e.className === 'stem-help-words').length, 0); // 用語が無ければ用語の節は無い
});

test('画面: stemPlain が無くても用語があれば出る。題名のボタンで、そのカードを開く', () => {
  const opened = [];
  const el = stemHelpBlock(appWith([['C-01-001', '過学習', '訓練データに偏りすぎる現象。']]), mkQ({ stem: '過学習の説明はどれか。' }), ['甲', '乙'], (id) => opened.push(id));
  assert.ok(el);
  assert.equal(el.find((e) => e.className === 'stem-help-plain').length, 0);
  const [chip] = el.find((e) => e.tag === 'button' && e.className.includes('chip'));
  chip.click();
  assert.deepEqual(opened, ['C-01-001']);
  const [line] = el.find((e) => e.className === 'stem-help-line');
  assert.equal(line.textContent, '訓練データに偏りすぎる現象。');
});

test('画面: 開閉は採点・記録に触らない（stemhelp.js は recordAnswer・commit・state を使わない）', () => {
  const s = src('js/views/stemhelp.js') + src('js/lib/stemhelp.js');
  assert.ok(!/recordAnswer|\.commit\(|app\.state|localStorage|savePro/.test(s));
});

// ---- 結線: 出題画面にだけ置く。模擬試験・解説には置かない ----

test('結線: 出題画面(play.js)は問題文の後・選択肢の前に置く。模擬試験(exam.js)・解説(explain.js)には置かない', () => {
  const play = src('js/views/play.js');
  assert.ok(/import \{ stemHelpBlock \} from '\.\/stemhelp\.js'/.test(play));
  const iStem = play.indexOf("class: 'stem'");
  const iHelp = play.indexOf('stemHelpBlock(app, q, sq.choices');
  const iChoices = play.indexOf("class: 'choices'");
  assert.ok(iStem > 0 && iStem < iHelp && iHelp < iChoices, '問題文 → 問題文の意味 → 選択肢 の順');
  assert.ok(/openCardSheet\(app, id\)/.test(play.slice(iHelp, iChoices)), '用語を押したらカードを開く');
  for (const f of ['js/views/exam.js', 'js/views/explain.js']) assert.ok(!/stemhelp|stemHelp/.test(src(f)), f + ' に問題文の意味を置かない');
});

test('結線: 2つのファイルを、オフライン用の一覧(sw-core.js)に載せている。2つのアプリの sw.js の version がそろっている', () => {
  const core = src('sw-core.js');
  assert.ok(core.includes("'../shared/js/lib/stemhelp.js'") && core.includes("'../shared/js/views/stemhelp.js'"));
  const ver = (app) => /version:\s*'(\d+)'/.exec(readFileSync(join(root, app, 'sw.js'), 'utf8'))[1];
  assert.equal(ver('g-kentei'), ver('dx-biz'));
  assert.ok(Number(ver('g-kentei')) >= 42);
});

test('stemPlain の上限は 200 文字（tools/check-data*.js と同じ値）', () => {
  assert.equal(STEM_PLAIN_MAX, 200);
  for (const f of ['tools/check-data.js', 'tools/check-data-dx.js']) assert.ok(/const STEM_PLAIN_MAX = 200;/.test(readFileSync(join(root, f), 'utf8')), f);
});
