// スマホの「戻る」の決まり（lib/backguard.js。2026-10-15 先生決定 A・2026-11-10 の直し）の検証。
// 見ているもの:
//   ・画面を変えるとき履歴をどう動かすかの表（leavePlan）と、hash の比べ方・履歴の印の読み方
//   ・にせものの履歴（下の makeBrowser）の上で createBackNav を動かしたときの道すじ:
//     見張っている画面をボタンで出たあとの「戻る」（地図 → ホーム → アプリの前のページ）、開けない画面（出す問題が無い #/play）へ
//     「戻る」「進む」・読み込み直し・直に開く、で着いても同じ所を回らない、「やめますか？」の 続ける・やめる、結果の画面、待ちきれなかったとき
//   ・app.js の配線（履歴をさわるのは backguard.js だけ・描いている最中の印・見張りを画面ごとに外す）
// 見ていないもの:
//   ・本物のブラウザの履歴の動き（にせものは「戻る・進むは後から起きる」「popstate が先、hashchange が後」だけを真似ている）。
//     本物では Playwright ＋ Chrome で見る（2026-11-10 に play・模擬試験・どっち？・章ボスで見た）。スマホの実機・Safari は見ていない
//   ・場面転換の覆い（app.js の hashchange は覆いをはさんで描く。ここのにせものは、すぐ描く）
//   ・画面の中身（views）。どの画面が見張るか・どのボタンがどこへ行くかは、にせものの画面で決め打ちしている
//   ・sw-core.js の SHARED と package.json の一覧への登録（門番が足す）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sameHash, fromOf, isGuard, leavePlan, createBackNav, LEAVE_TIMEOUT_MS } from '../js/lib/backguard.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const appSrc = read('../js/app.js');

const STAGE = '#/stage/a';

// ---------- にせもののブラウザ ----------
// entries[0] はアプリの前のページ（外）。そこへ戻ったら outside が true になり、それより後の出来事は起きない
function makeBrowser(startHash) {
  const b = {
    entries: [{ outside: true, hash: '', state: null }, { hash: startHash, state: null }],
    index: 1,
    tasks: [], // 後から起きる出来事（戻る・進む・hashchange）
    timers: [],
    now: 0,
    nextTimer: 1,
    listeners: { hashchange: [], popstate: [] },
    outside: false,
    blockTraversal: false, // true の間、戻る・進むが効かない（待ちきれなかったときの確かめ用）
  };
  const cur = () => b.entries[b.index];
  const hashOf = (url) => { const i = String(url).indexOf('#'); return i < 0 ? '' : String(url).slice(i); };
  const clone = (s) => (s == null ? null : JSON.parse(JSON.stringify(s)));
  const fire = (type) => { for (const fn of b.listeners[type].slice()) fn({ type }); };
  const cut = () => { b.entries.length = b.index + 1; }; // 履歴を足すと、先の履歴は消える
  const traverse = (n) => {
    if (b.blockTraversal || b.outside) return;
    const ni = b.index + n;
    if (ni < 0 || ni >= b.entries.length) return;
    const old = cur().hash;
    b.index = ni;
    if (cur().outside) { b.outside = true; b.tasks.length = 0; return; }
    fire('popstate');
    if (cur().hash !== old) fire('hashchange');
  };
  const pathname = '/g-kentei/index.html';
  const location = {
    get hash() { return cur().hash; },
    set hash(v) {
      if (v === cur().hash) return;
      cut();
      b.entries.push({ hash: v, state: null });
      b.index++;
      b.tasks.push(() => fire('hashchange'));
    },
    get pathname() { return pathname; },
    get search() { return ''; },
    get href() { return 'http://test.invalid' + pathname + cur().hash; },
    replace(url) {
      const old = cur().hash;
      b.entries[b.index] = { hash: hashOf(url), state: null };
      if (cur().hash !== old) b.tasks.push(() => fire('hashchange'));
    },
  };
  const history = {
    get state() { return clone(cur().state); },
    get length() { return b.entries.length; },
    pushState(state, _title, url) {
      const hash = url == null ? cur().hash : hashOf(url);
      cut();
      b.entries.push({ hash, state: clone(state) });
      b.index++;
    },
    replaceState(state, _title, url) {
      cur().state = clone(state);
      if (url != null) cur().hash = hashOf(url);
    },
    back() { history.go(-1); },
    forward() { history.go(1); },
    go(n) { b.tasks.push(() => traverse(n)); },
  };
  // ページを読み込む（読み込み直しも同じ）。履歴は残り、耳（listener）と待っている出来事は消える
  b.load = () => {
    b.listeners = { hashchange: [], popstate: [] };
    b.tasks = [];
    b.timers = [];
    b.outside = false;
    return {
      history,
      location,
      addEventListener(type, fn) { if (b.listeners[type]) b.listeners[type].push(fn); },
      setTimeout(fn, ms) { const id = b.nextTimer++; b.timers.push({ id, at: b.now + ms, fn }); return id; },
      clearTimeout(id) { b.timers = b.timers.filter((t) => t.id !== id); },
    };
  };
  // 待っている出来事を、無くなるまで起こす（Promise の続きも待つ）
  b.settle = async () => {
    for (let i = 0; i < 50; i++) {
      while (b.tasks.length) b.tasks.shift()();
      await new Promise((r) => setImmediate(r));
      if (!b.tasks.length) return;
    }
    throw new Error('出来事が終わらない（同じ所を回っている）');
  };
  b.advance = async (ms) => {
    b.now += ms;
    const due = b.timers.filter((t) => t.at <= b.now);
    b.timers = b.timers.filter((t) => t.at > b.now);
    for (const t of due) t.fn();
    await b.settle();
  };
  b.userBack = async () => { history.go(-1); await b.settle(); };
  b.userForward = async () => { history.go(1); await b.settle(); };
  // 履歴の並び。[ ] がいまいる所、* は見張りの履歴
  b.trail = () => b.entries.map((e, i) => {
    const name = e.outside ? '外' : e.hash + (e.state && e.state.cqGuard ? '*' : '');
    return i === b.index ? '[' + name + ']' : name;
  }).join(' ');
  return b;
}

// ---------- にせもののアプリ（app.js の render と同じ順で backNav を使う） ----------
// #/play … 出す問題（session）が無ければホームへ送り直す。あれば見張る / #/exam … いつも見張る / ほか … 見張らない
function startApp(b, opts = {}) {
  const win = b.load();
  const app = { session: !!opts.session, shown: null, asks: 0, reply: null, answer: opts.answer };
  const nav = createBackNav(win, { render: () => render() });
  const ask = () => {
    app.asks++;
    if (typeof app.answer === 'boolean') return app.answer; // 1問も答えていないときは、聞かずに出る（play.js と同じ）
    return new Promise((res) => { app.reply = (v) => { app.reply = null; res(v); }; });
  };
  function render() {
    nav.backGuard = null;
    nav.drawing = true;
    try {
      const h = win.location.hash;
      if (h === '#/play') {
        if (!app.session) { nav.go('#/home'); return; }
        nav.guardBack(ask);
      } else if (h === '#/exam') nav.guardBack(ask);
      app.shown = h;
    } finally {
      nav.drawing = false;
    }
  }
  win.addEventListener('hashchange', () => render()); // createBackNav の後に付ける（app.js と同じ順）
  render();
  const go = async (hash) => { nav.go(hash); await b.settle(); };
  // 「戻る」を、アプリの外へ出るまで押す。見えた画面を順に返す（最後は '外'）。10回押しても出られなければ、そこで止める
  const backsOut = async () => {
    const seen = [];
    for (let i = 0; i < 10 && !b.outside; i++) {
      await b.userBack();
      seen.push(b.outside ? '外' : app.shown);
    }
    return seen;
  };
  return { win, app, nav, go, backsOut };
}

// ホーム → 地図 → 章 → 問題 まで進める
async function toPlay(b, opts) {
  const a = startApp(b, opts);
  await a.go('#/map');
  await a.go(STAGE);
  a.app.session = true;
  await a.go('#/play');
  return a;
}

// ---------- 小さな関数 ----------
test('sameHash: 同じ画面なら、%E3… と日本語のままの違いは同じとみなす。壊れた % でも落ちない', () => {
  assert.equal(sameHash('#/home', '#/home'), true);
  assert.equal(sameHash('#/home', '#/map'), false);
  assert.equal(sameHash('#/stage/' + encodeURIComponent('技術分野|人工知能とは'), '#/stage/技術分野|人工知能とは'), true);
  assert.equal(sameHash('#/stage/%E6%8A%80', '#/stage/術'), false);
  assert.equal(sameHash('#/x%', '#/x%'), true);
  assert.equal(sameHash('#/x%', '#/y%'), false);
  assert.equal(sameHash(null, '#/home'), false);
  assert.equal(sameHash('#/home', undefined), false);
});

test('fromOf・isGuard: 履歴の印の読み方（書いていなければ null、最初の履歴は 空文字）', () => {
  assert.equal(fromOf(null), null);
  assert.equal(fromOf({}), null);
  assert.equal(fromOf({ cqFrom: 3 }), null);
  assert.equal(fromOf({ cqFrom: '' }), '');
  assert.equal(fromOf({ cqFrom: '#/map', cqGuard: true }), '#/map');
  assert.equal(isGuard(null), false);
  assert.equal(isGuard({ cqFrom: '#/map' }), false);
  assert.equal(isGuard({ cqGuard: true }), true);
});

test('leavePlan: 見張りの上・描いている最中・ふつう × 一つ下が行き先と同じ・違う・分からない、の全部', () => {
  const rows = [
    // onGuard, drawing, from, target → back, then
    [true, false, STAGE, STAGE, 2, 'check'], // × で章へ。問題の画面と見張りの2つを戻る
    [true, false, '#/more', '#/home', 1, 'replace'], // 一つ下が行き先と違う。見張りを抜けて、問題の画面の履歴を行き先に置き換える
    [true, false, '', '#/home', 1, 'replace'], // 一つ下が分からない（アプリの前のページ）。外へは戻らない
    [true, false, null, '#/home', 1, 'replace'],
    [true, true, STAGE, STAGE, 2, 'check'], // 見張りの上なら、描いている最中でも同じ
    [true, true, STAGE, '#/home', 1, 'replace'],
    [false, true, '#/home', '#/home', 1, 'check'], // 開けない画面からの送り直し。一つ下が行き先なら、戻るだけ
    [false, true, STAGE, '#/home', 0, 'replace'], // 違うなら、開けない画面の履歴を置き換える（足さない）
    [false, true, '', '#/home', 0, 'replace'],
    [false, true, null, '#/home', 0, 'replace'],
    [false, false, '#/home', '#/home', 0, 'push'], // ふつうの画面からは、いつも足す（地図 → ホームのボタンでも「戻る」で地図に戻れる）
    [false, false, '#/map', STAGE, 0, 'push'],
    [false, false, null, '#/map', 0, 'push'],
  ];
  for (const [onGuard, drawing, from, target, back, then] of rows) {
    assert.deepEqual(leavePlan({ onGuard, drawing, from, target }), { back, then }, JSON.stringify({ onGuard, drawing, from, target }));
  }
  // 一つ下の書き方が違っても（%E3… と日本語）、同じ画面なら2つ戻る
  assert.deepEqual(leavePlan({ onGuard: true, drawing: false, from: '#/stage/' + encodeURIComponent('あ|い'), target: '#/stage/あ|い' }), { back: 2, then: 'check' });
});

test('LEAVE_TIMEOUT_MS: 待つ長さは、場面転換より長く、押した人が待てる短さ（1〜3秒）', () => {
  assert.ok(LEAVE_TIMEOUT_MS >= 1000 && LEAVE_TIMEOUT_MS <= 3000, String(LEAVE_TIMEOUT_MS));
});

// ---------- 道すじ（にせものの履歴の上で） ----------
test('履歴に着くたびに「どこから来たか」を書く。見張りの履歴は、問題の画面と同じ印を持つ', async () => {
  const b = makeBrowser('#/home');
  await toPlay(b);
  assert.equal(b.trail(), '外 #/home #/map #/stage/a #/play [#/play*]');
  assert.deepEqual(b.entries.slice(1).map((e) => e.state), [
    { cqFrom: '' },
    { cqFrom: '#/home' },
    { cqFrom: '#/map' },
    { cqFrom: STAGE },
    { cqGuard: true, cqFrom: STAGE },
  ]);
});

test('決まり 2: 問題の画面を × で出たら、「戻る」は 地図 → ホーム → アプリの前のページ（2026-11-10 の不具合の形）', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  await a.go(STAGE); // 画面の中の × （1問も答えていない）
  assert.equal(a.app.shown, STAGE);
  assert.equal(a.app.asks, 0, 'ボタンで出るときは、ここでは聞かない（聞くのは画面の仕事）');
  assert.equal(b.index, 3, b.trail()); // 章の履歴そのものに戻っている（足していない）
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
});

test('決まり 2: 出たあとにもう一度入って出ても、履歴は増えない', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  for (let i = 0; i < 3; i++) {
    await a.go(STAGE);
    assert.equal(b.index, 3, b.trail());
    a.app.session = true;
    await a.go('#/play');
    assert.equal(b.trail(), '外 #/home #/map #/stage/a #/play [#/play*]');
  }
  await a.go(STAGE);
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
});

test('決まり 2: 一つ下が行き先と違うとき（その他 → 模擬試験 →「戻る」でホーム）は、模擬試験の履歴をホームに置き換える', async () => {
  const b = makeBrowser('#/home');
  const a = startApp(b);
  await a.go('#/more');
  await a.go('#/exam');
  assert.equal(b.trail(), '外 #/home #/more #/exam [#/exam*]');
  await a.go('#/home');
  assert.equal(a.app.shown, '#/home');
  assert.equal(b.trail(), '外 #/home #/more [#/home] #/exam*');
  assert.deepEqual(b.entries[3].state, { cqFrom: '#/more' }, '置き換えた履歴は、模擬試験の印（その他から来た）を引き継ぐ');
  assert.deepEqual(await a.backsOut(), ['#/more', '#/home', '外']);
});

test('決まり 2: ホームから直に入った模擬試験を「戻る」ボタンで出たら、次の「戻る」でアプリを出る', async () => {
  const b = makeBrowser('#/home');
  const a = startApp(b);
  await a.go('#/exam');
  await a.go('#/home');
  assert.equal(b.index, 1, b.trail());
  assert.deepEqual(await a.backsOut(), ['外']);
});

test('決まり 4: ホームで「戻る」を押したら、アプリの前のページへ出る', async () => {
  const b = makeBrowser('#/home');
  const a = startApp(b);
  assert.deepEqual(await a.backsOut(), ['外']);
});

test('決まり 1: 「戻る」で聞く。続けるなら残り、もう一度「戻る」でまた聞く。やめるなら一つ前の画面へ戻り、あとは決まり 2 と同じ', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  await b.userBack();
  assert.equal(a.app.asks, 1);
  assert.equal(a.app.shown, '#/play');
  assert.equal(b.trail(), '外 #/home #/map #/stage/a #/play [#/play*]', '聞いている間も、見張りの履歴の上に残る');
  a.app.reply(false); // 続ける
  await b.settle();
  assert.equal(a.app.shown, '#/play');
  assert.equal(b.trail(), '外 #/home #/map #/stage/a #/play [#/play*]');
  await b.userBack();
  assert.equal(a.app.asks, 2, '続けたあとの「戻る」でも、また聞く');
  a.app.reply(true); // やめる
  await b.settle();
  assert.equal(a.app.shown, STAGE);
  assert.equal(b.index, 3, b.trail());
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
  assert.equal(a.app.asks, 2, '出たあとは、もう聞かない');
});

test('決まり 1: 聞いている間に「戻る」を重ねて押しても、小窓は1つ。画面にも残る', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  await b.userBack();
  await b.userBack();
  await b.userBack();
  assert.equal(a.app.asks, 1);
  assert.equal(a.app.shown, '#/play');
  assert.equal(b.trail(), '外 #/home #/map #/stage/a #/play [#/play*]');
  a.app.reply(true);
  await b.settle();
  assert.equal(a.app.shown, STAGE);
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
});

test('決まり 1: 聞かずに出てよいとき（1問も答えていない）は、「戻る」1回で一つ前の画面へ', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b, { answer: true });
  await b.userBack();
  assert.equal(a.app.shown, STAGE);
  assert.equal(b.index, 3, b.trail());
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
});

test('決まり 5: 結果の画面（見張りを外したあと）は、ボタンで出ても「戻る」で出ても、あとの「戻る」は 地図 → ホーム → 外', async () => {
  for (const how of ['button', 'back']) {
    const b = makeBrowser('#/home');
    const a = await toPlay(b);
    a.nav.backGuard = null; // 結果の画面を描くとき、app.js の render が見張りを外す。履歴には見張りの分が残っている
    if (how === 'button') await a.go(STAGE);
    else await b.userBack();
    assert.equal(a.app.asks, 0, how);
    assert.equal(a.app.shown, STAGE, how);
    assert.equal(b.index, 3, how + ' ' + b.trail());
    assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外'], how);
  }
});

test('決まり 3: 出す問題が無い #/play を直に開いたら、ホームに置き換える（履歴を足さない）。「戻る」1回でアプリを出る', async () => {
  const b = makeBrowser('#/play');
  const a = startApp(b);
  await b.settle();
  assert.equal(a.app.shown, '#/home');
  assert.equal(b.trail(), '外 [#/home]');
  assert.deepEqual(await a.backsOut(), ['外']);
});

test('決まり 3: 問題の画面で読み込み直したら（出す問題が消える）ホームへ。履歴は増えず、「戻る」は 章 → 地図 → ホーム → 外', async () => {
  const b = makeBrowser('#/home');
  await toPlay(b);
  const len = b.entries.length;
  const a = startApp(b); // 読み込み直し。見張りの履歴の上で開く
  await b.settle();
  assert.equal(a.app.shown, '#/home');
  assert.equal(b.entries.length, len, b.trail());
  assert.equal(b.trail(), '外 #/home #/map #/stage/a [#/home] #/play*');
  assert.deepEqual(await a.backsOut(), [STAGE, '#/map', '#/home', '外']);
});

test('決まり 3: × で出たあと「進む」で古い問題の履歴に着いても、ホームを見せるだけ。何回くり返しても「戻る」で出られる', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  await a.go(STAGE);
  a.app.session = false; // 出たので、出す問題はもう無い
  const len = b.entries.length;
  for (let i = 0; i < 4; i++) {
    await b.userForward();
    assert.equal(a.app.shown, '#/home', i + ' ' + b.trail());
    assert.equal(b.entries.length, len, i + ' ' + b.trail());
  }
  assert.deepEqual(await a.backsOut(), [STAGE, '#/map', '#/home', '外']);
});

test('決まり 3: 一つ下がホームの開けない画面（ホーム → #/play）へ「進む」で着いたら、ホームへ戻るだけ', async () => {
  const b = makeBrowser('#/home');
  const a = startApp(b, { session: true });
  await a.go('#/play');
  await a.go('#/home'); // ボタンで出る（2つ戻る）
  assert.equal(b.trail(), '外 [#/home] #/play #/play*');
  a.app.session = false;
  await b.userForward(); // 問題の画面の履歴（見張りではない方）に着く
  assert.equal(a.app.shown, '#/home');
  assert.equal(b.trail(), '外 [#/home] #/play #/play*');
  assert.deepEqual(await a.backsOut(), ['外']);
});

test('一つ下が思っていた画面と違ったら（古い版が作った履歴など）、足して進む。行き先には必ず着く', async () => {
  const b = makeBrowser('#/home');
  b.entries = [
    { outside: true, hash: '', state: null },
    { hash: '#/home', state: null },
    { hash: '#/map', state: null },
    { hash: '#/exam', state: { cqFrom: '#/more' } }, // 印は「その他から来た」だが、下にあるのは地図
    { hash: '#/exam', state: { cqGuard: true, cqFrom: '#/more' } },
  ];
  b.index = 4;
  const a = startApp(b);
  await a.go('#/more');
  assert.equal(a.app.shown, '#/more');
  assert.equal(b.trail(), '外 #/home #/map [#/more]');
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
});

test('印の無い履歴（古い版で開いたままの画面）でも、ボタンで出られて、同じ所を回らない', async () => {
  const b = makeBrowser('#/home');
  b.entries = [
    { outside: true, hash: '', state: null },
    { hash: '#/home', state: null },
    { hash: STAGE, state: null },
    { hash: '#/exam', state: null },
    { hash: '#/exam', state: { cqGuard: true } }, // 古い版の見張り（cqFrom が無い）
  ];
  b.index = 4;
  const a = startApp(b);
  await a.go('#/home');
  assert.equal(a.app.shown, '#/home');
  const seen = await a.backsOut();
  assert.equal(seen[seen.length - 1], '外', seen.join(' → '));
  assert.equal(new Set(seen).size, seen.length, '同じ画面を2回見ない: ' + seen.join(' → '));
});

test('戻るのを待ちきれなかったら（' + LEAVE_TIMEOUT_MS + 'ms）、いまの履歴を行き先に置き換えて進む。ボタンが効かないままにしない', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  b.blockTraversal = true;
  await a.go(STAGE);
  assert.equal(a.app.shown, '#/play', 'まだ戻っていない');
  await b.advance(LEAVE_TIMEOUT_MS - 1);
  assert.equal(a.app.shown, '#/play');
  await b.advance(1);
  assert.equal(a.app.shown, STAGE);
  b.blockTraversal = false;
  // 次のボタンは、ふつうに効く（待ちの印が残っていない）
  await a.go('#/map');
  assert.equal(a.app.shown, '#/map');
  await b.userBack();
  assert.equal(a.app.shown, STAGE);
});

test('戻っている途中に行き先が変わったら、後の行き先へ着く', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  a.nav.go(STAGE);
  a.nav.go('#/home');
  await b.settle();
  assert.equal(a.app.shown, '#/home');
  const seen = await a.backsOut();
  assert.equal(seen[seen.length - 1], '外', seen.join(' → '));
});

test('行き先がいまの画面と同じなら、履歴を動かさずに描き直す', async () => {
  const b = makeBrowser('#/home');
  const a = startApp(b);
  await a.go('#/map');
  const before = b.trail();
  a.app.shown = null;
  await a.go('#/map');
  assert.equal(a.app.shown, '#/map');
  assert.equal(b.trail(), before);
});

test('見張っている画面を描き直しても（次の問題へ）、見張りの履歴は1つのまま', async () => {
  const b = makeBrowser('#/home');
  const a = await toPlay(b);
  const before = b.trail();
  for (let i = 0; i < 3; i++) await a.go('#/play');
  assert.equal(b.trail(), before);
  await b.userBack();
  assert.equal(a.app.asks, 1, '描き直したあとも、「戻る」で聞く');
  a.app.reply(true);
  await b.settle();
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
});

test('ふつうの画面どうしは、いつも履歴を足す（「戻る」で一つ前の画面に戻れる）', async () => {
  const b = makeBrowser('#/home');
  const a = startApp(b);
  await a.go('#/map');
  await a.go('#/home'); // 地図の「ホームへ」。一つ下がホームでも、戻らずに足す
  assert.equal(b.trail(), '外 #/home #/map [#/home]');
  assert.deepEqual(await a.backsOut(), ['#/map', '#/home', '外']);
});

// ---------- app.js の配線 ----------
test('app.js: 履歴をさわるのは backguard.js だけ（app.js に popstate・pushState・location.replace を残していない）', () => {
  assert.ok(appSrc.includes("import { createBackNav } from './lib/backguard.js';"));
  assert.ok(!appSrc.includes("addEventListener('popstate'"));
  assert.ok(!appSrc.includes('history.pushState'));
  assert.ok(!appSrc.includes('history.go('));
  assert.ok(!appSrc.includes('history.back('));
  assert.ok(!appSrc.includes('location.replace('));
  assert.ok(appSrc.includes('go(hash) { backNav.go(hash); },'));
  assert.ok(appSrc.includes('guardBack(ask) { backNav.guardBack(ask); },'));
});

test('app.js: createBackNav は、hash を補ったあと・hashchange の耳より先に作る（着いた履歴に印を書いてから描く）', () => {
  const fill = appSrc.indexOf("if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/home');");
  const make = appSrc.indexOf('const backNav = createBackNav(window, { render: () => render() });');
  const listen = appSrc.indexOf("window.addEventListener('hashchange'");
  assert.ok(fill > 0 && make > fill, 'hash を補うのが先');
  assert.ok(listen > make, 'hashchange の耳は後');
});

test('app.js: render は、見張りを画面ごとに外し、描いている間だけ drawing を立てる（途中で落ちても下ろす）', () => {
  const start = appSrc.indexOf('function render(');
  assert.ok(start > 0);
  const body = appSrc.slice(start, appSrc.indexOf("window.addEventListener('hashchange'", start));
  const off = body.indexOf('backNav.backGuard = null;');
  const up = body.indexOf('backNav.drawing = true;');
  const draw = body.indexOf('route[2](arg)');
  const fin = body.indexOf('finally', draw);
  const down = body.indexOf('backNav.drawing = false;', fin);
  assert.ok(off > 0, '見張りを外す');
  assert.ok(up > off && draw > up, 'drawing を立ててから描く');
  assert.ok(fin > draw && down > fin, 'finally で下ろす');
});
