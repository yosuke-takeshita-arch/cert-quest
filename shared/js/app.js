// 起動・ルーティング。資格固有のことは config.json と data/ からだけ読む。
import { h, clear, icon, toast, celebrate, badgeBases } from './ui.js';
import { loadData } from './lib/data.js';
import { createStorage } from './lib/storage.js';
import { defaultState, recordAnswer } from './lib/progress.js';
import { badgeDefs, awardBadges, badgeArtName, badgeImageUrl } from './lib/badges.js';
import { dateKey } from './lib/srs.js';
import { STAR_THRESHOLDS, levelFromXp } from './lib/scoring.js';
import { awardDailyGoal, dailyProgress } from './lib/daily.js';
import { nextGoals } from './lib/goals.js';
import { suggestStage } from './lib/progress.js';
import { renderHome, renderMap, renderStage, renderReview, startGoal } from './views/home.js';
import { renderCardList, renderCard } from './views/cards.js';
import { renderPlay } from './views/play.js';
import { renderExam } from './views/exam.js';
import { renderMore, renderBadges, renderSettings } from './views/more.js';
import { initAudio, setBgmScene, syncBgm, unlockAudio, playSfx } from './audio.js';
import { createTitleScreen } from './views/title.js';
import { createLoadTracker } from './lib/loadprogress.js';
import { needsExamDateAsk, examStatus } from './lib/examdate.js';
import { createExamDateAsk } from './views/examdate.js';
import { renderAbout } from './views/about.js';
import { renderWeak } from './views/weak.js';
import { createIntro } from './views/intro.js';
import { needsIntro } from './lib/intro.js';

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
  document.title = config.name || document.title;

  // 配色は、タイトル画面から効かせる（設定は端末の記録から先に読む）
  const storage = createStorage('certquest:' + (config.id || 'app') + (sample ? ':sample' : '') + ':v1');
  const darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = (pref) => pref === 'dark' || (pref === 'auto' && !!darkMq && darkMq.matches);
  document.documentElement.dataset.theme = isDark(storage.load().settings.theme) ? 'dark' : 'light';

  // タイトル画面。データを読む間、ゲージを伸ばす。読み終わっても、ボタンを押すまでここで待つ
  // （そのボタンが「最初の操作」。押した瞬間に音を使える状態にする）。URL がホーム以外でも同じで、押したあとにその画面へ進む
  // タイトル画面の歯車（音の設定）が使う設定。ここで変えたら保存し、ホームに進むとき読み直す。
  // 音の部品（initAudio）は、歯車の試し聴きのため、タイトル画面を出す前に初期化する（ホームに進んだら app.state の設定に切り替わる）
  const titleState = storage.load();
  let live = null;
  initAudio(() => (live ? live.state.settings : titleState.settings));
  const title = createTitleScreen({ config, examDate: examStatus(titleState.settings).date, sound: { settings: titleState.settings, commit: () => storage.save(titleState) } });
  clear(root);
  root.appendChild(title.el);
  const dataBase = new URL(sample ? './data/_sample/' : './data/', location.href).href;
  const tracker = createLoadTracker((s) => title.setProgress(s));
  let data;
  try {
    data = await loadData({ dataBase, fetchFn: tracker.wrap((u) => fetch(u)) });
  } catch (e) {
    return title.fail('データの読み込みで予期しない問題が起きました。', String(e.message || e));
  }
  tracker.complete();
  // 押した瞬間に音を使える状態にし、開始のジングルを鳴らす（効果音がオンの人だけ）。演出が済んだらホームへ
  await title.ready(() => {
    unlockAudio(titleState.settings);
    playSfx(titleState.settings, 'start');
  });

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

  const defs = badgeDefs(data.tree, config);
  const app = {
    config,
    data,
    dataBase, // data/ のURL（図の SVG を取るのに使う）
    sample,
    storage,
    state: storage.load(),
    rng: Math.random,
    session: null,
    starThresholds: (config.stage && config.stage.stars) || STAR_THRESHOLDS,
    go(hash) {
      if (location.hash === hash) render();
      else location.hash = hash;
    },
    // お祝いの待ち行列。問題を解いている最中は出さず、結果画面かホームに戻ったとき flushCelebrations() で順に出す
    pending: [],
    lastLevel: levelFromXp(storage.load().xp).level,
    commit() {
      const key = dateKey(new Date());
      const lv = levelFromXp(app.state.xp).level;
      if (lv > app.lastLevel) app.pending.push({ kind: 'level', level: lv });
      app.lastLevel = lv;
      awardBadges(app.state, defs, key).forEach((b) => app.pending.push({ kind: 'badge', name: b.name, desc: b.desc, image: badgeImageUrl(badgeArtName(b), badgeBases()) }));
      if (awardDailyGoal(app.state, key)) app.pending.push({ kind: 'goal', goal: dailyProgress(app.state, key).goal });
      storage.save(app.state);
    },
    /** 星が増えたお祝いを待ち行列に足す（ステージ結果から）。 */
    queueStars(title, n) {
      app.pending.push({ kind: 'stars', title, stars: n });
    },
    flushCelebrations() {
      if (!app.pending.length) return;
      const events = app.pending.splice(0, app.pending.length);
      const next = nextGoals(data.tree, defs, app.state, dateKey(new Date()), 1)[0] || null;
      const startable = !next || next.action.kind !== 'study' || !!suggestStage(data.tree.stages, app.state.qstats);
      celebrate(events, { settings: app.state.settings, next, startable, onStart: (g) => startGoal(app, g) });
    },
    recordAnswer(q, opts) {
      const r = recordAnswer(app.state, q, { ...opts, now: new Date() });
      app.commit();
      return r;
    },
    /** 書き出したファイルの記録に置き換える（読み込み）。state は parseBackup が正規化したもの。 */
    replaceState(state) {
      storage.save(state);
      app.state = storage.load();
      app.applyScheme();
      app.pending = [];
      app.lastLevel = levelFromXp(app.state.xp).level;
      app.session = null;
      app.commit(); // 読み込んだ記録で、もう条件を満たしているバッジを付ける
      syncBgm();
      toast('学習記録を読み込みました');
      app.go('#/home');
    },
    resetAll() {
      storage.clear();
      app.state = defaultState();
      app.applyScheme();
      app.pending = [];
      app.lastLevel = 1;
      app.session = null;
      syncBgm();
      toast('学習記録を消しました');
      app.go('#/home');
    },
  };
  // 動作確認用に外から触れるようにする（テストが状態を調べる）
  window.__app = app;
  // 音。BGM は、問題を解いている画面（ステージ・復習・チャレンジ・模試）だけで流す。ホームなどは無音（initAudio はタイトル画面の前に済んでいる）
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
    ['review', 'review', () => renderReview(app)],
    ['more', 'more', () => renderMore(app)],
    ['badges', 'more', () => renderBadges(app)],
    ['weak', 'more', () => renderWeak(app)],
    ['settings', 'more', () => renderSettings(app)],
    ['about', 'more', () => renderAbout(app)],
    ['exam', 'more', () => renderExam(app), true],
    ['play', 'home', () => renderPlay(app), true],
  ];

  // 配色。設定（light / dark / auto）を data-theme="light"|"dark" に解決して付ける。auto はスマホの設定の変化にも追う
  app.applyScheme = () => {
    document.documentElement.dataset.theme = isDark(app.state.settings.theme) ? 'dark' : 'light';
  };
  app.applyScheme();
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
