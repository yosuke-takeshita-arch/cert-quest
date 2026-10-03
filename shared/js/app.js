// 起動・ルーティング。資格固有のことは config.json と data/ からだけ読む。
import { h, clear, icon, toast, celebrate } from './ui.js';
import { loadData } from './lib/data.js';
import { createStorage } from './lib/storage.js';
import { defaultState, recordAnswer } from './lib/progress.js';
import { badgeDefs, awardBadges } from './lib/badges.js';
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
  if (vars(d)) css.push('@media (prefers-color-scheme: dark){:root{' + vars(d) + '}}');
  if (css.length) document.head.appendChild(h('style', { id: 'theme' }, css.join('\n')));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && l.accent) meta.setAttribute('content', l.accent);
}

function showFatal(root, message, detail) {
  clear(root);
  root.appendChild(h('div', { class: 'view' }, h('div', { class: 'card empty' }, h('h1', { text: '開けませんでした' }), h('p', { text: message }), detail ? h('p', { class: 'small muted', text: detail }) : null, h('button', { class: 'btn primary', type: 'button', onClick: () => location.reload() }, '再読み込み'))));
}

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

  const dataBase = new URL(sample ? './data/_sample/' : './data/', location.href).href;
  let data;
  try {
    data = await loadData({ dataBase });
  } catch (e) {
    return showFatal(root, 'データの読み込みで予期しない問題が起きました。', String(e.message || e));
  }

  const storage = createStorage('certquest:' + (config.id || 'app') + (sample ? ':sample' : '') + ':v1');
  const defs = badgeDefs(data.tree, config);
  const app = {
    config,
    data,
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
      awardBadges(app.state, defs, key).forEach((b) => app.pending.push({ kind: 'badge', name: b.name, desc: b.desc }));
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
    resetAll() {
      storage.clear();
      app.state = defaultState();
      app.pending = [];
      app.lastLevel = 1;
      app.session = null;
      toast('学習記録を消しました');
      app.go('#/home');
    },
  };
  // 動作確認用に外から触れるようにする（テストが状態を調べる）
  window.__app = app;

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
    ['settings', 'more', () => renderSettings(app)],
    ['exam', 'more', () => renderExam(app), true],
    ['play', 'home', () => renderPlay(app), true],
  ];

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
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    app.installPrompt = e;
    if (location.hash === '#/home') render();
  });
  window.addEventListener('appinstalled', () => {
    app.installPrompt = null;
    if (location.hash === '#/home') render();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker', e));
  }
}
