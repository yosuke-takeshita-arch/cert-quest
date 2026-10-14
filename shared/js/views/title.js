// タイトル画面（ブラウザ専用）。アプリを開いて最初に出す。背景・アプリ名・受験日までの日数・読み込みのゲージ、
// 読み込みが終わったら「タップしてはじめる」。資格固有のことは config.json（name / titleImage）からだけ読む。受験日は利用者の設定（examDate 引数）。
import { h, icon } from '../ui.js';
import { daysUntil } from '../lib/scoring.js';
import { unlockAudio, titleAudioLocked } from '../audio.js';
import { buildSoundCard } from './sound-settings.js';
import { appTitle } from '../lib/appname.js';
import { outlinePath } from '../lib/outline.js';
import { validTrace, partPath, lineLength, traceSchedule } from '../lib/logotrace.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TRACE_W = 240; // 輪郭を取るときの絵の幅（画素）。小さいほど速く、輪郭は粗くなる
const STAR_D = 'M0 -7L1.4 -1.4L7 0L1.4 1.4L0 7L-1.4 1.4L-7 0L-1.4 -1.4Z'; // 四つ角の星
const setAttrs = (el, attrs) => { for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
const svgEl = (parent, tag, attrs) => parent.appendChild(setAttrs(document.createElementNS(SVG_NS, tag), attrs));
const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// config.titleLogoTrace の線だけを、順に光の粒がたどり、最後に flash の場所を強く光らせる（lib/logotrace.js）。
// 長さ・太さは viewBox（絵の幅240）の単位。動きは JS（Web Animations と SMIL）で付けるので、動きを減らす設定では何も足さない
// 2026-10-15 先生「光の進むスピードはもっと早く。倍速でいい。間隔は今のでいい」: 速さを 170→340 にし、縮んだ分を休みに足して、くり返しの間隔（G検定で約6秒）を変えない
const PART = { speed: 340, lead: 0.05, gap: 0.12, flash: 0.75, rest: 3.6, delay: 1.2 };
const PART_LAYERS = [['tail', 22], ['mid', 9], ['head', 2.5]]; // 粒の3本と、それぞれの長さ
function traceParts(img, wrap, cfg) {
  if (reducedMotion()) return;
  const k = TRACE_W / img.naturalWidth;
  const hgt = Math.max(1, Math.round(img.naturalHeight * k));
  const lines = cfg.parts.map((pts) => pts.map(([x, y]) => [x * k, y * k]));
  const lens = lines.map(lineLength);
  const s = traceSchedule(lens, PART);
  const T = s.cycle, at = (t) => Math.min(1, t / T), e = 0.004;
  const svg = setAttrs(document.createElementNS(SVG_NS, 'svg'), { class: 'title-logo-trace is-parts', viewBox: '0 0 ' + TRACE_W + ' ' + hgt, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const timing = { duration: T * 1000, delay: PART.delay * 1000, iterations: Infinity, easing: 'linear' };
  const smil = { dur: T + 's', begin: PART.delay + 's', repeatCount: 'indefinite' };
  lines.forEach((pts, i) => {
    const d = partPath(pts), len = lens[i], { start, end } = s.parts[i];
    // 粒は「ずらし＝長さ D」（線の始めの手前に隠れている）から「−線の長さ」（終わりの先に抜けた）まで、同じ速さで動かす
    for (const [cls, D] of PART_LAYERS) {
      const p = svgEl(svg, 'path', { d, class: 'trace-' + cls });
      p.style.strokeDasharray = D + ' ' + (len + D + 10);
      const fin = at(start + (len + D) / PART.speed);
      p.animate([
        { offset: 0, strokeDashoffset: D, opacity: 0 },
        { offset: at(start), strokeDashoffset: D, opacity: 0 },
        { offset: at(start) + e, strokeDashoffset: D - PART.speed * e * T, opacity: 1 },
        { offset: fin, strokeDashoffset: -len, opacity: 1 },
        { offset: Math.min(1, fin + e), strokeDashoffset: -len, opacity: 0 },
        { offset: 1, strokeDashoffset: -len, opacity: 0 },
      ], timing);
    }
    // 頭に乗る星
    const a = at(start), b = at(end);
    const g = svgEl(svg, 'g', { class: 'trace-star', opacity: '0' });
    svgEl(svgEl(g, 'path', { d: STAR_D }), 'animateTransform', { attributeName: 'transform', type: 'rotate', values: '0;90', dur: '0.8s', repeatCount: 'indefinite' });
    svgEl(g, 'animateMotion', { path: d, ...smil, calcMode: 'linear', keyPoints: '0;0;1;1', keyTimes: `0;${a};${b};1` });
    svgEl(g, 'animate', { attributeName: 'opacity', ...smil, values: '0;0;1;1;0;0', keyTimes: `0;${a};${a + e};${b - e};${b};1` });
  });
  if (cfg.flash) svg.appendChild(flashBurst(cfg.flash[0] * k, cfg.flash[1] * k, at(s.flashAt), at(s.flashAt + 0.15), at(s.flashAt + PART.flash), smil));
  wrap.appendChild(svg);
}

// 最後の「キラッ」。光の玉がふくらみ、輪が広がり、大きな星が回りながら開いて消える。f0 始め・f1 いちばん強い・f2 消える（周期の中の割合）
function flashBurst(x, y, f0, f1, f2, smil) {
  const g = setAttrs(document.createElementNS(SVG_NS, 'g'), { class: 'trace-flash', transform: `translate(${x} ${y})` });
  const kt = `0;${f0};${f1};${f2};1`;
  const glow = svgEl(g, 'circle', { class: 'trace-flash-glow', r: '0', opacity: '0' });
  svgEl(glow, 'animate', { attributeName: 'r', ...smil, values: '0;0;9;14;14', keyTimes: kt });
  svgEl(glow, 'animate', { attributeName: 'opacity', ...smil, values: '0;0;0.95;0;0', keyTimes: kt });
  const ring = svgEl(g, 'circle', { class: 'trace-flash-ring', r: '0', opacity: '0' });
  svgEl(ring, 'animate', { attributeName: 'r', ...smil, values: '0;0;8;24;24', keyTimes: kt });
  svgEl(ring, 'animate', { attributeName: 'opacity', ...smil, values: '0;0;1;0;0', keyTimes: kt });
  const burst = svgEl(g, 'g', { class: 'trace-star', transform: 'scale(0)' });
  svgEl(burst, 'animateTransform', { attributeName: 'transform', type: 'scale', ...smil, values: '0;0;3.2;0;0', keyTimes: kt });
  const rays = svgEl(burst, 'g', {});
  svgEl(rays, 'path', { d: STAR_D });
  svgEl(rays, 'path', { d: STAR_D, transform: 'rotate(45) scale(0.55)' });
  svgEl(rays, 'animateTransform', { attributeName: 'transform', type: 'rotate', ...smil, values: '0;0;30;70;70', keyTimes: kt });
  return g;
}

// ロゴの上に、絵の外まわりをなぞる線を重ねる。線は CSS（.title-logo-trace）で、短い光の粒として一周させる。
// 粒は3本を重ねる（太く淡い尾・中くらい・細く白い頭）。長さと動きは CSS の .trace-tail / .trace-mid / .trace-head
function traceLogo(img, wrap) {
  const w = TRACE_W, hgt = Math.max(1, Math.round(img.naturalHeight * TRACE_W / img.naturalWidth));
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, hgt);
  const d = outlinePath(g.getImageData(0, 0, w, hgt).data, w, hgt);
  if (!d) return;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'title-logo-trace');
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const cls of ['tail', 'mid', 'head']) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '100');
    p.setAttribute('class', 'trace-' + cls);
    svg.appendChild(p);
  }
  // 粒の頭に、四つ角の星のきらめきを乗せて一緒に走らせる（キラッと見せるため）。SMIL の動きは CSS の「動きを減らす」規則では止まらないので、そのときは付けない
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) svg.appendChild(sparkle(d));
  wrap.appendChild(svg);
}

// 時間は CSS の logo-trace-*（4.5秒ごと・1.2秒待ってから・36%で一周）とそろえる
function sparkle(d) {
  const set = (el, attrs) => { for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
  const g = set(document.createElementNS(SVG_NS, 'g'), { class: 'trace-star', opacity: '0' });
  const star = set(document.createElementNS(SVG_NS, 'path'), { d: 'M0 -7L1.4 -1.4L7 0L1.4 1.4L0 7L-1.4 1.4L-7 0L-1.4 -1.4Z' });
  set(star.appendChild(document.createElementNS(SVG_NS, 'animateTransform')), { attributeName: 'transform', type: 'rotate', values: '0;90', dur: '0.8s', repeatCount: 'indefinite' });
  g.appendChild(star);
  set(g.appendChild(document.createElementNS(SVG_NS, 'animateMotion')), { path: d, dur: '4.5s', begin: '1.2s', repeatCount: 'indefinite', calcMode: 'linear', keyPoints: '0;1;1', keyTimes: '0;0.36;1' });
  set(g.appendChild(document.createElementNS(SVG_NS, 'animate')), { attributeName: 'opacity', values: '0;1;1;0;0', keyTimes: '0;0.04;0.32;0.36;1', dur: '4.5s', begin: '1.2s', repeatCount: 'indefinite' });
  return g;
}

/**
 * 返すもの:
 *   el            … 画面の要素（#app に入れる）
 *   setProgress(s) … s = { done, total, fraction }。ゲージを伸ばす
 *   ready(onTap)  … ゲージをボタンに替える。押されたら onTap() を同期的に呼ぶ（押した操作の中で音を使えるようにするため）。
 *                   返す Promise は、開始の演出（約0.6秒。動きを減らす設定では待たない）が済んで、ホームへ切り替えてよくなったときに解ける
 *   fail(message, detail) … 読み込みに失敗したとき。ゲージ・ボタンの上に、原因と「再読み込み」を出す
 */
// sound … { settings, commit }。あれば右上に歯車を出し、押すと音の設定のポップアップを開く（変えたら commit() で保存する）
export function createTitleScreen({ config, examDate = null, now = new Date(), sound = null }) {
  const name = config.name || '';
  // 受験日は利用者が決めた日（決めていなければ null＝日数を出さない）
  const left = daysUntil(examDate, now);
  const countdown = left == null || left < 0 ? null : left === 0 ? '受験日は今日です' : '受験日まで あと ' + left + ' 日';

  const bg = typeof config.titleImage === 'string' && config.titleImage
    ? h('img', { class: 'title-bg', src: config.titleImage, alt: '', decoding: 'async', draggable: 'false' })
    : null;
  // 画像が読めないときは、テーマ色の背景に戻る
  if (bg) bg.addEventListener('error', () => bg.remove());

  // タイトルの文字の絵（config.titleLogo）。あれば文字の代わりに出し、読めなければ文字に戻る。読み上げは alt の名前
  const nameEl = h('h1', { class: 'title-name', text: name });
  // シリーズ名（CertQuest）。文字の絵には CertQuest も描いてあるので、絵を出している間は隠す
  const seriesEl = config.series ? h('p', { class: 'title-series', text: config.series }) : null;
  if (typeof config.titleLogo === 'string' && config.titleLogo) {
    const logo = h('img', { class: 'title-logo', src: config.titleLogo, alt: appTitle(config), decoding: 'async', draggable: 'false' });
    logo.addEventListener('error', () => { nameEl.textContent = name; nameEl.classList.remove('has-logo'); if (seriesEl) seriesEl.hidden = false; });
    if (seriesEl) seriesEl.hidden = true;
    nameEl.textContent = '';
    nameEl.classList.add('has-logo');
    const wrap = h('span', { class: 'title-logo-wrap' }, logo);
    nameEl.appendChild(wrap);
    // 縁を光の粒が一周する（2026-10-14 先生「キラッと光ってほしい。できれば縁を辿るように」）。輪郭は絵の透明度から作る
    // config.titleLogoTrace があれば、そこに書いた部分だけをたどって最後に光らせる（2026-10-15 先生「塔、羽、剣の周囲だけ…剣のところで最後強めに光って」）
    const addTrace = () => {
      try { if (validTrace(config.titleLogoTrace)) traceParts(logo, wrap, config.titleLogoTrace); else traceLogo(logo, wrap); } catch { /* 輪郭が作れなくてもロゴはそのまま出す */ }
    };
    if (logo.complete && logo.naturalWidth) addTrace(); else logo.addEventListener('load', addTrace, { once: true });
  }

  const fill = h('div', { class: 'title-gauge-fill' });
  const gauge = h('div', { class: 'title-gauge', role: 'progressbar', 'aria-label': '読み込み', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill);
  const status = h('p', { class: 'title-status', 'aria-live': 'polite', text: '読み込み中…' });
  const loading = h('div', { class: 'title-loading' }, gauge, status);
  const startBtn = h('button', { class: 'title-start hidden', type: 'button' }, 'タップしてはじめる');
  // BGM がオンで、まだ画面をさわっていなくて曲を鳴らせないあいだだけ出す一言（鳴り始めたら消える）
  const soundHint = h('p', { class: 'title-unofficial title-sound-hint hidden', 'aria-live': 'polite', text: '画面をさわると音楽が流れます' });
  // 輪はボタンを包む枠の中に出す（枠の大きさ＝ボタンの大きさなので、位置・形がボタンに必ず重なる）
  const startWrap = h('div', { class: 'title-start-wrap' }, startBtn);
  const bottom = h('div', { class: 'title-bottom' }, loading, startWrap, soundHint, h('p', { class: 'title-unofficial', text: '非公式アプリ' }));

  const el = h('div', { class: 'title-screen', 'data-title': '1' },
    bg,
    h('div', { class: 'title-scrim' }),
    h('div', { class: 'title-top' },
      // シリーズ名（CertQuest）は名前の上に小さく、試験名は副題として下に小さく（試験名は登録商標のことがあるので、名前やロゴにしない）
      seriesEl,
      nameEl,
      config.subtitle ? h('p', { class: 'title-subtitle', text: config.subtitle }) : null,
      countdown ? h('p', { class: 'title-exam', text: countdown }) : null),
    bottom,
    sound ? h('button', { class: 'title-gear', type: 'button', 'aria-label': '音の設定', 'aria-haspopup': 'dialog', onClick: (e) => openSoundPopup(e.currentTarget) }, icon('gear')) : null);

  const hintTimer = setInterval(() => {
    if (!el.isConnected && Date.now() - shownAt > 2000) { clearInterval(hintTimer); return; }
    soundHint.classList.toggle('hidden', !titleAudioLocked());
  }, 300);

  // 音の設定のポップアップ。閉じる（ボタン・背景・Esc）。開いている間は Tab がポップアップの中だけを回り、うしろの画面は触れない
  const FOCUSABLE = 'button, input, select, [tabindex]:not([tabindex="-1"])';
  let popupOpen = false;
  function openSoundPopup(trigger) {
    if (popupOpen) return;
    popupOpen = true;
    // 歯車を押すことも「最初の操作」。ここで音を使える状態にして、ポップアップの中の効果音・試し聴きがすぐ鳴るようにする
    unlockAudio({ sound: true, bgm: true });
    const card = buildSoundCard(sound.settings, sound.commit, { heading: false, inTitle: true });
    const closeBtn = h('button', { class: 'btn ghost icon-only title-pop-close', type: 'button', 'aria-label': '閉じる' }, icon('close'));
    const panel = h('div', { class: 'title-pop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title-pop-h' },
      closeBtn, h('h2', { id: 'title-pop-h', class: 'title-pop-title', text: '音の設定' }), card.el);
    const back = h('div', { class: 'title-pop-back' }, panel);
    const close = () => {
      card.dispose(); // 試し聴きは、閉じたら止める
      back.remove();
      document.removeEventListener('keydown', onKey);
      el.inert = false;
      popupOpen = false;
      if (trigger && trigger.focus) trigger.focus({ preventScroll: true });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    closeBtn.addEventListener('click', close);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    el.inert = true;
    document.body.appendChild(back);
    closeBtn.focus({ preventScroll: true });
  }

  // 2回目以降はデータがキャッシュから一瞬で読めて、ゲージが見えないまま終わる（2026-10-04 先生「読み込み中のバーもなかった」）。
  // 出してから最低 MIN_SHOW_MS はゲージを見せ、満タンまで伸びてからボタンに替える。
  const MIN_SHOW_MS = 1200;
  // 開始の演出の長さ（app.css の title-flash と合わせる）。白が最も強くなる少し後でホームに切り替える
  const FLASH_MS = 1000;
  const SWITCH_MS = 600;
  const shownAt = Date.now();
  let failed = false;
  return {
    el,
    setProgress(s) {
      if (failed) return;
      // 一瞬で読めたときに一気に満タンにならないよう、出してからの時間でも頭打ちにする（残りは ready で伸ばす）
      const byTime = Math.min(1, (Date.now() - shownAt) / MIN_SHOW_MS);
      const pct = Math.round(Math.max(0, Math.min(1, s.fraction || 0, byTime)) * 100);
      fill.style.width = pct + '%';
      gauge.setAttribute('aria-valuenow', String(pct));
      status.textContent = s.total ? '読み込み中… ' + Math.min(s.done, s.total) + ' / ' + s.total : '読み込み中…';
    },
    ready(onTap) {
      if (failed) return Promise.resolve();
      const rest = Math.max(350, MIN_SHOW_MS - (Date.now() - shownAt));
      fill.style.transition = 'width ' + rest + 'ms ease-out';
      fill.style.width = '100%';
      gauge.setAttribute('aria-valuenow', '100');
      status.textContent = '読み込み完了';
      setTimeout(() => {
        if (failed) return;
        loading.classList.add('hidden');
        startBtn.classList.remove('hidden');
        startBtn.focus({ preventScroll: true });
      }, rest + 200);
      let used = false;
      return new Promise((resolve) => {
        startBtn.addEventListener('click', () => {
          if (used) return;
          used = true;
          startBtn.disabled = true;
          onTap();
          // 開始の演出: ボタンが光って輪がはじけ、画面が白く明るく抜ける。白がいちばん強いところでホームに切り替え、白は切り替えたあとで消える。
          // 動きを減らす設定では、演出なしで、すぐ切り替える
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { resolve(); return; }
          el.classList.add('starting');
          startBtn.classList.add('go');
          startWrap.appendChild(h('span', { class: 'title-ring', 'aria-hidden': 'true' }));
          const flash = h('div', { class: 'title-flash', 'aria-hidden': 'true' });
          document.body.appendChild(flash);
          setTimeout(() => flash.remove(), FLASH_MS + 200);
          setTimeout(resolve, SWITCH_MS);
        });
      });
    },
    fail(message, detail) {
      failed = true;
      loading.classList.add('hidden');
      startBtn.classList.add('hidden');
      const box = h('div', { class: 'title-error', role: 'alert' },
        h('div', { class: 'card empty' },
          h('h2', { text: '開けませんでした' }),
          h('p', { text: message }),
          detail ? h('p', { class: 'small muted', text: detail }) : null,
          h('button', { class: 'btn primary', type: 'button', onClick: () => location.reload() }, '再読み込み')));
      el.appendChild(box);
      box.querySelector('button').focus({ preventScroll: true });
    },
  };
}
