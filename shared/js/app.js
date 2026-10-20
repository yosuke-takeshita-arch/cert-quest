// 起動・ルーティング。資格固有のことは config.json と data/ からだけ読む。
import { h, clear, icon, toast, celebrate, badgeBases, setTapHost, setImagesBase } from './ui.js';
import { appTitle } from './lib/appname.js';
import { normalizeSubjects, hasSubjects, createSubjectStore, singleKey, subjectConfig, subjectDataBase, subjectImagesBase } from './lib/subjects.js';
import { renderSubjectPicker } from './views/subjects.js';
import { installStudyClock } from './studyclock.js';
import { loadData } from './lib/data.js';
import { loadBosses } from './lib/bossdata.js';
import { loadBasics, buildMatcher } from './lib/basics.js';
import { createStorage } from './lib/storage.js';
import { defaultState, recordAnswer } from './lib/progress.js';
import { badgeDefs, awardBadges, badgeArtName, badgeImageUrl, badgeTier, SECRET_BADGE_TEXT } from './lib/badges.js';
import { dateKey } from './lib/srs.js';
import { forecast as calcForecast, recordForecast } from './lib/forecast.js';
import { STAR_THRESHOLDS, levelFromXp } from './lib/scoring.js';
import { awardDailyGoal, dailyProgress } from './lib/daily.js';
import { nextGoals } from './lib/goals.js';
import { suggestStage } from './lib/progress.js';
import { renderHome, renderMap, renderStage, renderReview, startGoal } from './views/home.js';
import { renderCardList, renderCard } from './views/cards.js';
import { renderBasicList, renderBasic } from './views/basics.js';
import { renderPlay } from './views/play.js';
import { renderExam } from './views/exam.js';
import { renderMore, renderBadges, renderSettings } from './views/more.js';
import { initAudio, setBgmScene, setBgmTitle, syncBgm, unlockAudio, playSfx } from './audio.js';
import { createTitleScreen } from './views/title.js';
import { createLoadTracker } from './lib/loadprogress.js';
import { needsExamDateAsk, examStatus } from './lib/examdate.js';
import { createExamDateAsk } from './views/examdate.js';
import { renderAbout } from './views/about.js';
import { renderCharacters } from './views/characters.js';
import { markTapBadge } from './lib/characters.js';
import { renderWeak } from './views/weak.js';
import { renderLater } from './views/later.js';
import { renderStudyReport } from './views/studyreport.js';
import { renderDochi } from './views/dochi.js';
import { renderBoss } from './views/boss.js';
import { createIntro } from './views/intro.js';
import { needsIntro } from './lib/intro.js';
import { normalizeTextSize } from './lib/textsize.js';

const NAV = [
  { id: 'home', label: 'ホーム', icon: 'home', hash: '#/home' },
  { id: 'map', label: '地図', icon: 'map', hash: '#/map' },
  { id: 'review', label: '復習', icon: 'review', hash: '#/review' },
  { id: 'cards', label: 'カード', icon: 'cards', hash: '#/cards' },
  { id: 'more', label: 'もっと', icon: 'more', hash: '#/more' },
];

function applyTheme(config) {
  const t = config.theme || {};
  const l = t.light || {};
  const d = t.dark || {};
  const css = [];
  const vars = (o) => Object.entries({ '--accent': o.accent, '--on-accent': o.onAccent, '--accent-soft': o.accentSoft }).filter(([, v]) => v).map(([k, v]) => k + ':' + v + ';').join('');
  if (vars(l)) css.push(':root{' + vars(l) + '}');
  if (vars(d)) css.push(':root[data-theme="dark"]{' + vars(d) + '}');
  if (css.length) document.head.appendChild(h('style', { id: 'theme' }, css.join('\n')));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && l.accent) meta.setAttribute('content', l.accent);
}

function showFatal(root, message, detail) {
  clear(root);
  root.appendChild(h('div', { class: 'view' }, h('div', { class: 'card empty' }, h('h1', { text: '開けませんでした' }), h('p', { text: message }), detail ? h('p', { class: 'small muted', text: detail }) : null, h('button', { class: 'btn primary', type: 'button', onClick: () => location.reload() }, '再読み込み'))));
}

// beforeinstallprompt はタイトル画面でボタンを待っている間にも届く。start() の後半で登録すると取りこぼすので、
// 読み込んだ時点で受け取っておき、アプリができたら渡す。
let earlyInstallPrompt = null;
let onInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  earlyInstallPrompt = e;
  if (onInstallPrompt) onInstallPrompt(e);
});

export async function start() {
  const root = document.getElementById('app');
  root.textContent = '読み込み中…';
  const params = new URLSearchParams(location.search);
  const sample = params.get('sample') === '1';

  let config;
  try {
    const res = await fetch('./config.json');
    if (!res.ok) throw new Error('config.json ' + res.status);
    config = await res.json();
  } catch (e) {
    return showFatal(root, '設定ファイル(config.json)を読めませんでした。', String(e.message || e));
  }
  applyTheme(config);
  document.title = appTitle(config) || document.title;

  // 科目のあるアプリ（config.json に subjects。中小企業診断士など）は、記録とデータを科目ごとに分ける（lib/subjects.js）。
  // 科目の無いアプリ（G検定・DX）は、これまでと同じ1つの記録（保存キーも同じ）
  const subjects = normalizeSubjects(config);
  if (hasSubjects(config) && !subjects.length) return showFatal(root, '設定ファイル(config.json)の科目の一覧が読めませんでした。');
  const store = subjects.length ? createSubjectStore({ appId: config.id || 'app', subjects, sample }) : null;
  const baseConfig = config; // 科目を開くと config は科目の分を重ねたものに替わる。アプリ全体の config はこちら
  // 配色は、タイトル画面から効かせる（設定は端末の記録から先に読む）。科目を選ぶ前は、共通の記録（XP・連続日数・設定）だけ使う
  let storage = store ? store.common() : createStorage(singleKey(config.id, sample));
  const commonStorage = storage;
  const darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = (pref) => pref === 'dark' || (pref === 'auto' && !!darkMq && darkMq.matches);
  document.documentElement.dataset.theme = isDark(storage.load().settings.theme) ? 'dark' : 'light';
  // 文字の大きさも同じ。タイトル画面から効かせる
  document.documentElement.dataset.text = normalizeTextSize(storage.load().settings.textSize);

  // タイトル画面。データを読む間、ゲージを伸ばす。読み終わっても、ボタンを押すまでここで待つ
  // （そのボタンが「最初の操作」。押した瞬間に音を使える状態にする）。URL がホーム以外でも同じで、押したあとにその画面へ進む
  // タイトル画面の歯車（音の設定）が使う設定。ここで変えたら保存し、ホームに進むとき読み直す。
  // 音の部品（initAudio）は、歯車の試し聴きのため、タイトル画面を出す前に初期化する（ホームに進んだら app.state の設定に切り替わる）
  const titleState = storage.load();
  let live = null;
  initAudio(() => (live ? live.state.settings : titleState.settings));
  // 『それ以外』の BGM（タイトル・ホームなど）は initAudio の中で流れ始める（オンの人だけ。『タップしてはじめる』でも止めず、ホームでも続く）
  // 歯車の音の設定は、科目を選ぶ前でも変えられるので、共通の記録に保存する（科目の無いアプリでは、これまでと同じ1つの記録）
  const title = createTitleScreen({ config, examDate: examStatus(titleState.settings).date, sound: { settings: titleState.settings, commit: () => commonStorage.save(titleState) } });
  clear(root);
  root.appendChild(title.el);
  // 科目の無いアプリは ./data/ 、科目のあるアプリは科目のフォルダ（./01_economics/ など）。サンプル表示（?sample=1）は ./data/_sample/ ／ ./_sample/<科目のフォルダ>/
  const dataBaseOf = (sub) => (sub ? subjectDataBase(sub, location.href, sample) : new URL(sample ? './data/_sample/' : './data/', location.href).href);
  const loadFor = async (sub, fetchFn) => {
    const base = dataBaseOf(sub);
    const d = await loadData({ dataBase: base, fetchFn });
    return { data: d, dataBase: base };
  };
  const loadExtras = async (loaded) => {
    // 章のボスの名前・せりふ。無い・壊れているときは空（ボスは汎用の名前とせりふで動く）。読み込みの進み具合には数えない
    loaded.data.bosses = (await loadBosses(new URL(loaded.data.bossesFile, loaded.dataBase).href)).bosses;
    // 基礎のことば（要件定義書 §7-5）。無い・空・壊れているときは、基礎のことばの無いアプリとして動く。進み具合には数えない。
    // 文中で見つける道具は、試験範囲のカードの title も知っている（「次元削減」というカードがあれば、その中の「次元」には印を付けない）
    loaded.data.basics = (await loadBasics(new URL(loaded.data.basicsFile, loaded.dataBase).href)).items;
    loaded.data.basicsMatcher = buildMatcher(loaded.data.basics, loaded.data.concepts);
    return loaded;
  };
  const tracker = createLoadTracker((s) => title.setProgress(s));
  // 科目のあるアプリは、前回選んだ科目があればそのデータを読む。初めてなら、タイトルのあとで科目を選んでもらうので、ここでは読まない
  let curSub = store ? subjects.find((s) => s.id === store.selected()) || null : null;
  let loaded = null;
  if (!store || curSub) {
    try {
      loaded = await loadFor(curSub, tracker.wrap((u) => fetch(u)));
    } catch (e) {
      return title.fail('データの読み込みで予期しない問題が起きました。', String(e.message || e));
    }
    tracker.complete();
    await loadExtras(loaded);
  } else {
    tracker.complete();
  }
  // 押した瞬間に音を使える状態にし、開始のジングルを鳴らす（効果音がオンの人だけ）。演出が済んだらホームへ
  await title.ready(() => {
    unlockAudio(titleState.settings);
    playSfx(titleState.settings, 'start');
  });
  setBgmTitle(false); // タイトル画面を出た。ここから『それ以外』で選んだ曲（タイトル曲を選んでいれば、切らずに続く）

  // 科目のあるアプリで、まだ科目を選んでいない（初回）: 科目を選んでもらい、そのデータを読む
  while (store && !loaded) {
    const id = await new Promise((resolve) => {
      clear(root);
      root.appendChild(renderSubjectPicker({ config, subjects, peek: (sid) => store.peek(sid), standalone: true, onPick: resolve }));
    });
    const sub = subjects.find((s) => s.id === id);
    if (!sub) continue;
    clear(root);
    root.appendChild(h('div', { class: 'view' }, h('p', { class: 'muted', role: 'status', text: '読み込み中…' })));
    try {
      loaded = await loadExtras(await loadFor(sub, (u) => fetch(u)));
      curSub = sub;
      store.select(sub.id);
    } catch (e) {
      loaded = null;
      clear(root);
      root.appendChild(h('div', { class: 'view' }, h('div', { class: 'card empty' }, h('p', { text: 'この科目のデータを読み込めませんでした。' }), h('p', { class: 'small muted', text: String(e.message || e) }), h('button', { class: 'btn primary', type: 'button', onClick: () => location.reload() }, 'もう一度'))));
      await new Promise(() => {}); // 「もう一度」は再読み込み。ここでは進めない
    }
  }
  // 以降は、開いた科目の記録（科目の無いアプリでは、これまでと同じ1つの記録）。共通の項目はどちらも同じ記録から読む
  if (store) {
    storage = store.open(curSub.id);
    Object.assign(titleState, storage.load());
  }
  let data = loaded.data;
  let dataBase = loaded.dataBase;

  // 受験日がまだ決まっていない（初回・古い記録）なら、ここで1回だけ聞く
  if (needsExamDateAsk(titleState.settings)) {
    const ask = createExamDateAsk({ config });
    clear(root);
    root.appendChild(ask.el);
    const answer = await ask.done;
    titleState.settings.examDate = answer.examDate;
    titleState.settings.examAsked = true;
    storage.save(titleState);
  }

  // 初めて使う人（まだ案内を見ていなくて、学習記録が空）には、使い方の案内を出す。見たら（とばしても）もう出さない。
  // すでに記録がある人には出さない。あとで「もっと」の「使い方」から見直せる
  if (needsIntro(titleState)) {
    const intro = createIntro();
    clear(root);
    root.appendChild(intro.el);
    await intro.done;
    titleState.settings.introSeen = true;
    storage.save(titleState);
  }

  const openConfig = curSub ? subjectConfig(baseConfig, curSub) : config; // 科目を開いているときは、科目の名前・試験時間などを重ねたもの
  setImagesBase(curSub ? subjectImagesBase(curSub, location.href) : null); // ボス・章のバッジの絵は科目ごとの images/<科目id>/
  if (curSub) document.title = openConfig.name;
  // スマホの「戻る」の見張り（app.guardBack）。backGuard … 見張っている画面の { ask }。onGuardEntry … いま見張りの履歴の上にいるか
  let backGuard = null;
  let onGuardEntry = !!(history.state && history.state.cqGuard);
  const app = {
    config: openConfig,
    baseConfig, // アプリ全体の config（科目の一覧 subjects を含む）
    subject: curSub, // 開いている科目（科目の無いアプリでは null）
    subjects, // 科目の一覧（科目の無いアプリでは空）
    store, // 科目ごとの記録の置き場（科目の無いアプリでは null）
    defs: badgeDefs(data.tree, openConfig),
    data,
    dataBase, // データの置き場のURL（図の SVG を取るのに使う）
    sample,
    storage,
    state: storage.load(),
    rng: Math.random,
    session: null,
    starThresholds: (config.stage && config.stage.stars) || STAR_THRESHOLDS,
    go(hash) {
      if (location.hash === hash) render();
      // 見張りの履歴（guardBack）の上にいるなら、それを置き換えて進む（戻ったときに同じ画面が2回出ないように）
      else if (onGuardEntry) { onGuardEntry = false; location.replace(location.pathname + location.search + hash); }
      else location.hash = hash;
    },
    /**
     * スマホの「戻る」（ブラウザの戻る）を見張る。問題を解いている画面が開いたときに呼ぶ。
     * 戻るが押されたら ask() を呼び、true なら一つ前の画面へ戻り、false なら今の画面に残る（ask の中で confirm を出す）。
     * 見張りは画面が変わると外れる（render のたびに外す。見張りたい画面は描くたびに呼ぶ）。
     * 2026-10-15 先生「ブラウザバックはアプリでは無効化したい」→ A（問題の途中だけ「やめますか？」と聞く）。
     * 戻るを止めきることはブラウザが許さない。同じ URL の履歴を1つ足して、戻るでそれが抜けたときに聞き直す
     */
    guardBack(ask) {
      backGuard = { ask };
      if (!onGuardEntry) {
        history.pushState({ cqGuard: true }, '', location.href);
        onGuardEntry = true;
      }
    },
    // お祝いの待ち行列。問題を解いている最中は出さず、結果画面かホームに戻ったとき flushCelebrations() で順に出す
    pending: [],
    lastLevel: levelFromXp(storage.load().xp).level,
    commit() {
      const key = dateKey(new Date());
      const lv = levelFromXp(app.state.xp).level;
      if (lv > app.lastLevel) app.pending.push({ kind: 'level', level: lv });
      app.lastLevel = lv;
      // 合格予想の推移。今日 1問でも答えていれば、その日の予想を記録する（1日1件、同じ日は上書き）
      if (app.state.daily[key]) recordForecast(app.state, key, calcForecast(app.data.questions, app.state.qstats).score);
      awardBadges(app.state, app.defs, key).forEach((b) => app.pending.push({ kind: 'badge', name: b.name, desc: b.desc, image: badgeImageUrl(badgeArtName(b), badgeBases()), note: badgeTier(b) === 'secret' ? SECRET_BADGE_TEXT.found : null }));
      if (awardDailyGoal(app.state, key)) app.pending.push({ kind: 'goal', goal: dailyProgress(app.state, key).goal });
      app.storage.save(app.state);
    },
    /** 星が増えたお祝いを待ち行列に足す（ステージ結果から）。 */
    queueStars(title, n) {
      app.pending.push({ kind: 'stars', title, stars: n });
    },
    flushCelebrations() {
      if (!app.pending.length) return;
      const events = app.pending.splice(0, app.pending.length);
      const next = nextGoals(app.data.tree, app.defs, app.state, dateKey(new Date()), 1)[0] || null;
      const startable = !next || next.action.kind !== 'study' || !!suggestStage(app.data.tree.stages, app.state.qstats);
      celebrate(events, { settings: app.state.settings, next, startable, onStart: (g) => startGoal(app, g) });
    },
    recordAnswer(q, opts) {
      const r = recordAnswer(app.state, q, { ...opts, now: new Date() });
      app.commit();
      return r;
    },
    /** 書き出したファイルの記録に置き換える（読み込み）。state は parseBackup が正規化したもの。 */
    replaceState(state) {
      app.storage.save(state);
      app.state = app.storage.load();
      app.applyScheme();
      app.applyTextSize();
      app.pending = [];
      app.lastLevel = levelFromXp(app.state.xp).level;
      app.session = null;
      app.commit(); // 読み込んだ記録で、もう条件を満たしているバッジを付ける
      syncBgm();
      toast('学習記録を読み込みました');
      app.go('#/home');
    },
    /** 科目ありのファイルの読み込み。共通の記録と、ファイルに有る科目の記録を置き換える（無い科目はそのまま）。x は parseSubjectsBackup の common / subjects。 */
    replaceSubjects(x) {
      app.store.importAll(x);
      app.state = app.storage.load();
      app.applyScheme();
      app.applyTextSize();
      app.pending = [];
      app.lastLevel = levelFromXp(app.state.xp).level;
      app.session = null;
      app.commit();
      syncBgm();
      toast('学習記録を読み込みました');
      app.go('#/home');
    },
    /** 科目をかえる（科目のあるアプリだけ）。いまの科目の記録は保存してから、その科目のデータを読んで、ホームへ。 */
    async switchSubject(id) {
      const sub = app.subjects.find((s) => s.id === id);
      if (!app.store || !sub) return false;
      if (app.subject && app.subject.id === id) { app.go('#/home'); return true; }
      app.storage.save(app.state); // 共通の記録（XP・設定）を含めて、替える前に確実に書く
      clear(main);
      main.appendChild(h('div', { class: 'view' }, h('p', { class: 'muted', role: 'status', text: '「' + sub.name + '」を読み込み中…' })));
      let next;
      try {
        next = await loadExtras(await loadFor(sub, (u) => fetch(u)));
      } catch (e) {
        toast('この科目のデータを読み込めませんでした');
        render();
        return false;
      }
      app.store.select(sub.id);
      const nextConfig = subjectConfig(baseConfig, sub);
      app.subject = sub;
      app.config = nextConfig;
      app.data = next.data;
      app.dataBase = next.dataBase;
      app.defs = badgeDefs(next.data.tree, nextConfig);
      app.storage = app.store.open(sub.id);
      app.state = app.storage.load();
      app.pending = [];
      app.session = null;
      app.lastLevel = levelFromXp(app.state.xp).level;
      setImagesBase(subjectImagesBase(sub, location.href));
      document.title = nextConfig.name;
      app.applyScheme();
      app.applyTextSize();
      app.commit(); // この科目の記録で、もう条件を満たしているバッジを付ける
      syncBgm();
      app.go('#/home');
      return true;
    },
    resetAll() {
      app.storage.clear();
      // 科目のあるアプリは、その科目の分だけ消える。XP・連続日数・設定（共通）は残す
      app.state = app.subject ? app.storage.load() : defaultState();
      app.applyScheme();
      app.applyTextSize();
      app.pending = [];
      app.lastLevel = app.subject ? levelFromXp(app.state.xp).level : 1;
      app.session = null;
      syncBgm();
      toast(app.subject ? 'この科目の学習記録を消しました' : '学習記録を消しました');
      app.go('#/home');
    },
  };
  // キャラクターをタップする遊び: 回数はこの起動の間だけ数える（保存しない。起動ごとに0から）と、効果音（音の設定に従う）
  const tapSession = { charTaps: { shiba: 0, sensei: 0 } };
  // 100回に達したら、その事実だけを（いま開いている）学習記録に残してバッジを判定する（お祝いは結果画面かホームに戻ったときに出る）
  setTapHost({ state: () => tapSession, save: () => {}, sfx: (name) => playSfx(app.state.settings, name), reached: (who, count) => { if (markTapBadge(app.state, who, count)) app.commit(); } });
  // 動作確認用に外から触れるようにする（テストが状態を調べる）
  window.__app = app;
  // 総学習時間（§6-1）。画面が前に出ていて、操作が2分以内の間だけ app.state.studySeconds に足す
  installStudyClock(app);
  // 音。BGM は、問題を解いている画面（ステージ・復習・チャレンジ・模試）では問題中の曲、それ以外（ホームなど）では『それ以外』の曲（initAudio はタイトル画面の前に済んでいる）
  live = app;

  const shell = h('div', { class: 'shell' });
  const main = h('main', { id: 'main', class: 'main', tabindex: '-1' });
  const nav = h('nav', { class: 'bottom-nav', 'aria-label': 'メインメニュー' });
  const navBtns = NAV.map((n) => {
    const a = h('a', { class: 'nav-item', href: n.hash, 'data-nav': n.id }, icon(n.icon), h('span', { text: n.label }));
    nav.appendChild(a);
    return a;
  });
  shell.appendChild(main);
  shell.appendChild(nav);
  clear(root);
  root.appendChild(shell);

  const ROUTES = [
    ['home', 'home', () => renderHome(app)],
    ['map', 'map', () => renderMap(app)],
    ['stage', 'map', (k) => renderStage(app, k)],
    ['cards', 'cards', () => renderCardList(app)],
    ['card', 'cards', (k) => renderCard(app, k)],
    ['basics', 'cards', () => renderBasicList(app)], // 基礎のことば（試験範囲の外の土台の言葉）の一覧
    ['basic', 'cards', (k) => renderBasic(app, k)],
    ['review', 'review', () => renderReview(app)],
    ['subjects', 'home', () => renderSubjects()], // 科目をかえる（科目のあるアプリだけ。科目の無いアプリはホームに戻る）
    ['more', 'more', () => renderMore(app)],
    ['badges', 'more', () => renderBadges(app)],
    ['weak', 'more', () => renderWeak(app)],
    ['later', 'more', (k) => renderLater(app, k)],
    ['study', 'home', () => renderStudyReport(app)], // 学習時間の振り返り（ホームの総学習時間から開く）
    ['settings', 'more', () => renderSettings(app)],
    ['about', 'more', () => renderAbout(app)],
    ['characters', 'more', (k) => renderCharacters(app, k)],
    ['exam', 'more', () => renderExam(app), true],
    ['play', 'home', () => renderPlay(app), true],
    ['dochi', 'home', () => renderDochi(app), true], // 出題の遊びなので、下のメニューを隠し、BGM も問題中の設定に従う
    ['boss', 'map', (k) => renderBoss(app, k), true], // 章のボス戦。問題を解く画面なので同じく下のメニューを隠す
  ];

  function renderSubjects() {
    if (!app.store) return renderHome(app);
    return renderSubjectPicker({
      config: app.baseConfig,
      subjects: app.subjects,
      peek: (id) => app.store.peek(id),
      currentId: app.subject ? app.subject.id : null,
      onBack: () => app.go('#/home'),
      onPick: (id) => { app.switchSubject(id); },
    });
  }

  // 配色。設定（light / dark / auto）を data-theme="light"|"dark" に解決して付ける。auto はスマホの設定の変化にも追う
  app.applyScheme = () => {
    document.documentElement.dataset.theme = isDark(app.state.settings.theme) ? 'dark' : 'light';
  };
  app.applyScheme();
  // 文字の大きさ。設定（small / normal / large / xlarge）を data-text に付ける。CSS が html の font-size を切り替える
  app.applyTextSize = () => {
    document.documentElement.dataset.text = normalizeTextSize(app.state.settings.textSize);
  };
  app.applyTextSize();
  // 起動時にもバッジの条件を見直す。付与は答えを保存するとき（commit）だけだったため、
  // バッジを後から足した版に更新したとき、すでに条件を満たしている人（例: 星3の章）が、
  // 次に1問答えるまで「未取得」のままになっていた（2026-10-04 先生の指摘）。お祝いはホームで出る
  app.commit();
  if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', app.applyScheme);

  let cleanup = null;
  function render() {
    if (cleanup) {
      try { cleanup(); } catch (e) { /* 後始末の失敗で画面遷移を止めない */ }
      cleanup = null;
    }
    backGuard = null; // 見張りは描いた画面ごと。見張りたい画面は描くときに app.guardBack を呼び直す
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const name = parts[0] || 'home';
    const arg = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : '';
    const route = ROUTES.find((r) => r[0] === name) || ROUTES[0];
    if (name !== 'play' && name !== 'exam') app.session = null;
    clear(main);
    try {
      const res = route[2](arg);
      const el = res && res.el ? res.el : res;
      cleanup = res && res.cleanup ? res.cleanup : null;
      main.appendChild(el);
    } catch (e) {
      console.error(e);
      main.appendChild(h('div', { class: 'view' }, h('div', { class: 'card empty' }, h('p', { text: 'この画面を表示できませんでした。' }), h('button', { class: 'btn', type: 'button', onClick: () => app.go('#/home') }, 'ホームへ'))));
    }
    const full = route[3] === true;
    setBgmScene(full);
    nav.classList.toggle('hidden', full);
    document.body.classList.toggle('no-nav', full);
    navBtns.forEach((a) => {
      if (a.dataset.nav === route[1] && !full) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    // 問題の途中でない画面に来たら、たまっていたお祝いを出す
    if (!full) app.flushCelebrations();
  }
  window.addEventListener('hashchange', render);
  // 見張りの履歴から戻った（URL は同じなので hashchange は来ない）。見張りを足し直して画面に残り、ask の答え（アプリの小窓）を待つ。
  // やめるなら、足し直した見張りと元の履歴の2つ分戻る。見張りが無ければ（結果の画面など）すぐもう一つ戻る
  let skipPop = 0; // こちらから戻したときの popstate を数えて無視する
  let asking = null; // 答えを待っている見張り（小窓を2つ出さない）
  window.addEventListener('popstate', () => {
    const was = onGuardEntry;
    onGuardEntry = !!(history.state && history.state.cqGuard);
    if (skipPop) { skipPop--; return; }
    if (!was || onGuardEntry) return;
    const g = backGuard;
    if (!g) { skipPop++; history.back(); return; }
    history.pushState({ cqGuard: true }, '', location.href);
    onGuardEntry = true;
    if (asking === g) return;
    asking = g;
    Promise.resolve(g.ask()).then((leave) => {
      if (asking === g) asking = null;
      if (!leave || backGuard !== g || !onGuardEntry) return;
      backGuard = null;
      skipPop++;
      history.go(-2);
    });
  });
  if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/home');
  render();

  // アプリ内の「インストール」ボタン用。Android の Chrome はメニューの「ホーム画面に追加」で、
  // 同じオリジンにアプリが1つでも入っていると「インストール済み」と判定する（WebappRegistry.isAppInstalledForUrl）。
  // github.io の同じオリジンに資格アプリが複数あるため、2つ目以降はメニューから入れられない。
  // ページ側の案内（beforeinstallprompt）は start_url の範囲で判定するので、こちらからなら入れられる。
  if (earlyInstallPrompt) app.installPrompt = earlyInstallPrompt;
  onInstallPrompt = (e) => {
    app.installPrompt = e;
    if (location.hash === '#/home') render();
  };
  if (app.installPrompt && location.hash === '#/home') render();
  window.addEventListener('appinstalled', () => {
    app.installPrompt = null;
    earlyInstallPrompt = null;
    if (location.hash === '#/home') render();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker', e));
  }
}
