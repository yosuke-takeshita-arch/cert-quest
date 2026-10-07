// 聞き流し: 耳だけで学ぶ画面。用語カードや問題を、スマホに入っている日本語の読み上げの声（speechSynthesis）で順に読む。
// 要件定義書 §3-3。読み上げる文の整形・並びは lib/listen.js、再生は listen-player.js。
import { h, clear, icon } from '../ui.js';
import { createListenPlayer } from '../listen-player.js';
import { setBgmSuppressed } from '../audio.js';
import { buildPlaylist, listenChapters, normalizeListenRate, normalizeListenPause, LISTEN_PAUSE_CHOICES } from '../lib/listen.js';

const RATES = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];

// 選んだ種類・範囲・シャッフルは、この画面を開いている間だけ覚える（保存しない）
const pick = { kind: 'card', chapters: new Set(), shuffle: false };

export function renderListen(app) {
  const root = h('section', { class: 'view listen' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => app.go('#/more') }, '← もっと'));
  root.appendChild(h('h1', { text: '聞き流し' }));
  root.appendChild(h('p', { class: 'small muted', text: '画面を見ずに、耳だけで学べます。スマホの読み上げの声で、用語カードや問題を順に読みます。' }));

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const Utt = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null;
  if (!synth || !Utt) {
    root.appendChild(h('div', { class: 'card empty', 'data-listen': 'unsupported' }, h('p', { text: 'この端末（ブラウザ）では読み上げが使えません。' }), h('p', { class: 'small muted', text: 'Chrome など、読み上げに対応したブラウザで開いてください。' })));
    return root;
  }

  const s = app.state.settings;
  const d = app.data;
  const hasCards = d.concepts.length > 0;
  const hasQs = d.questions.length > 0;
  if (!hasCards && !hasQs) {
    root.appendChild(h('div', { class: 'card empty' }, h('p', { text: '読むものを準備中です。' })));
    return root;
  }
  if (pick.kind === 'card' && !hasCards) pick.kind = 'question';
  if (pick.kind === 'question' && !hasQs) pick.kind = 'card';

  // ---- 再生のカード ----
  const nowTitle = h('p', { class: 'listen-title', 'data-listen': 'title', 'aria-live': 'polite', text: '' });
  const nowCount = h('p', { class: 'small muted', 'data-listen': 'count', text: '' });
  const nowPhase = h('p', { class: 'small', 'data-listen': 'phase', 'aria-live': 'polite', text: '' });
  const bar = h('div', { class: 'progress', role: 'progressbar', 'aria-label': '読んだ件数', 'aria-valuemin': '0', 'aria-valuemax': '1', 'aria-valuenow': '0' }, h('div', { class: 'progress-fill listen-fill' }));
  const note = h('p', { class: 'small warn-text', 'data-listen': 'note', 'aria-live': 'polite', text: '' });
  const btnPrev = h('button', { class: 'btn icon-only', type: 'button', 'aria-label': '前へ', 'data-listen': 'prev' }, icon('prev'));
  const btnPlay = h('button', { class: 'btn primary icon-only listen-play', type: 'button', 'aria-label': '再生', 'data-listen': 'play' }, icon('play'));
  const btnNext = h('button', { class: 'btn icon-only', type: 'button', 'aria-label': '次へ', 'data-listen': 'next' }, icon('next'));
  const btnStop = h('button', { class: 'btn icon-only', type: 'button', 'aria-label': '停止', 'data-listen': 'stop' }, icon('stop'));
  const playCard = h('div', { class: 'card listen-player' }, nowTitle, nowCount, nowPhase, bar,
    h('div', { class: 'listen-controls' }, btnPrev, btnPlay, btnNext, btnStop), note);
  root.appendChild(playCard);

  const player = createListenPlayer({
    synth,
    Utterance: Utt,
    getSettings: () => app.state.settings,
    appName: app.config.name || '',
    onChange: (st) => paint(st),
  });

  let lastStatus = 'idle';
  function paint(st) {
    const active = st.status === 'playing' || st.status === 'paused';
    if (active !== (lastStatus === 'playing' || lastStatus === 'paused')) setBgmSuppressed(active); // 声と重ならないよう、BGM は止める
    lastStatus = st.status;
    nowTitle.textContent = st.total ? (st.title || '') : '読むものがありません';
    nowCount.textContent = st.total ? (st.status === 'idle' ? '全 ' + st.total + ' 件' : (st.idx + 1) + ' 件目 / 全 ' + st.total + ' 件') + (st.chapter ? '（' + st.chapter + '）' : '') : '';
    nowPhase.textContent = st.status === 'playing' ? (st.phase === 'thinking' ? '考える時間です…' : '読んでいます') : st.status === 'paused' ? '一時停止中' : st.status === 'done' ? '最後まで読みました' : '';
    const pct = st.total && st.status !== 'idle' ? (st.status === 'done' ? 100 : Math.round((st.idx / st.total) * 100)) : 0;
    bar.setAttribute('aria-valuemax', String(st.total || 1));
    bar.setAttribute('aria-valuenow', String(st.status === 'done' ? st.total : st.idx));
    bar.firstChild.style.width = pct + '%';
    const playing = st.status === 'playing';
    btnPlay.replaceChildren(icon(playing ? 'pause' : 'play'));
    btnPlay.setAttribute('aria-label', playing ? '一時停止' : st.status === 'paused' ? '再開' : '再生');
    btnPlay.disabled = !st.total;
    btnPrev.disabled = !st.total || st.idx <= 0;
    btnNext.disabled = !st.total || st.idx >= st.total - 1;
    btnStop.disabled = st.status === 'idle';
    // 日本語の声が無いとき
    if (st.error) note.textContent = st.error;
    else if (st.voiceCount > 0 && !st.voice) note.textContent = '日本語の声が見つかりません。スマホの設定の「ユーザー補助」→「テキスト読み上げ」で、日本語の音声データを入れてください（機種によって名前や場所が違います）。';
    else note.textContent = '';
  }

  btnPlay.addEventListener('click', () => player.toggle());
  btnNext.addEventListener('click', () => player.next());
  btnPrev.addEventListener('click', () => player.prev());
  btnStop.addEventListener('click', () => player.stop());

  // ---- 読むもの・範囲 ----
  const pickCard = h('div', { class: 'card listen-pick' });
  root.appendChild(pickCard);
  const rebuild = () => {
    const entries = buildPlaylist({ kind: pick.kind, tree: d.tree, concepts: d.concepts, questions: d.questions, chapters: [...pick.chapters], shuffle: pick.shuffle, rng: app.rng });
    player.load(pick.kind, entries);
  };
  const drawPick = () => {
    clear(pickCard);
    pickCard.appendChild(h('h2', { text: '読むもの' }));
    const kinds = h('div', { class: 'btn-row listen-kinds' });
    for (const [k, label, ok] of [['card', '用語カード', hasCards], ['question', '問題', hasQs]]) {
      if (!ok) continue;
      kinds.appendChild(h('button', { class: 'btn' + (pick.kind === k ? ' primary' : ''), type: 'button', 'aria-pressed': String(pick.kind === k), 'data-listen-kind': k, onClick: () => { pick.kind = k; pick.chapters = new Set(); drawPick(); rebuild(); } }, label));
    }
    pickCard.appendChild(kinds);
    pickCard.appendChild(h('p', { class: 'small muted', text: pick.kind === 'card' ? '題名 → 一言で言うと → 背景とポイント の順に読みます。' : '問題文 → 選択肢（A〜D）→ 考える時間 → 正解 → 解説 の順に読みます。' }));
    pickCard.appendChild(h('h2', { text: '範囲' }));
    const chapters = listenChapters(d.tree, pick.kind);
    const allId = 'listen-all';
    const all = h('input', { type: 'checkbox', id: allId, class: 'switch', 'data-listen-all': '1' });
    all.checked = pick.chapters.size === 0;
    all.addEventListener('change', () => { pick.chapters = new Set(); drawPick(); rebuild(); });
    pickCard.appendChild(h('label', { class: 'row-btn', for: allId }, h('span', { class: 'row-main' }, h('strong', { text: '全部' }), h('span', { class: 'small muted', text: '章の順に読みます' })), all));
    for (const c of chapters) {
      const id = 'listen-ch-' + c.key.replace(/[^A-Za-z0-9]+/g, '-') + '-' + chapters.indexOf(c);
      const cb = h('input', { type: 'checkbox', id, class: 'switch', 'data-listen-chapter': c.key });
      cb.checked = pick.chapters.has(c.key);
      cb.addEventListener('change', () => {
        if (cb.checked) pick.chapters.add(c.key); else pick.chapters.delete(c.key);
        drawPick();
        rebuild();
      });
      pickCard.appendChild(h('label', { class: 'row-btn', for: id }, h('span', { class: 'row-main' }, h('strong', { text: c.name }), h('span', { class: 'small muted', text: c.major + '・' + c.count + (pick.kind === 'card' ? '枚' : '問') })), cb));
    }
    const shId = 'listen-shuffle';
    const sh = h('input', { type: 'checkbox', id: shId, class: 'switch', 'data-listen-shuffle': '1' });
    sh.checked = pick.shuffle;
    sh.addEventListener('change', () => { pick.shuffle = sh.checked; rebuild(); });
    pickCard.appendChild(h('label', { class: 'row-btn', for: shId }, h('span', { class: 'row-main' }, h('strong', { text: 'シャッフル' }), h('span', { class: 'small muted', text: '順番をばらばらにします（初期は章の順）' })), sh));
  };
  drawPick();

  // ---- 設定 ----
  const rateSel = h('select', { id: 'set-listenRate', class: 'select', 'data-listen-set': 'rate' }, RATES.map((r) => h('option', { value: String(r), text: r.toFixed(1) + '倍' })));
  rateSel.value = String(normalizeListenRate(s.listenRate));
  rateSel.addEventListener('change', () => { s.listenRate = normalizeListenRate(rateSel.value); app.commit(); });
  const pauseSel = h('select', { id: 'set-listenPause', class: 'select', 'data-listen-set': 'pause' }, LISTEN_PAUSE_CHOICES.map((n) => h('option', { value: String(n), text: n + '秒' })));
  pauseSel.value = String(normalizeListenPause(s.listenPause));
  pauseSel.addEventListener('change', () => { s.listenPause = normalizeListenPause(pauseSel.value); app.commit(); });
  const setCard = h('div', { class: 'card' }, h('h2', { text: '設定' }),
    h('label', { class: 'row-btn', for: 'set-listenRate' }, h('span', { class: 'row-main' }, h('strong', { text: '読む速さ' }), h('span', { class: 'small muted', text: '次の1文から変わります' })), rateSel),
    h('label', { class: 'row-btn', for: 'set-listenPause' }, h('span', { class: 'row-main' }, h('strong', { text: '問題の考える時間' }), h('span', { class: 'small muted', text: '選択肢を読んだあと、正解を言うまでの間（次に読む問題から）' })), pauseSel));
  if (navigator.wakeLock) {
    const id = 'set-listenKeepAwake';
    const input = h('input', { type: 'checkbox', id, class: 'switch', 'data-listen-set': 'awake' });
    input.checked = !!s.listenKeepAwake;
    input.addEventListener('change', () => { s.listenKeepAwake = input.checked; app.commit(); player.refreshAwake(); });
    setCard.appendChild(h('label', { class: 'row-btn', for: id }, h('span', { class: 'row-main' }, h('strong', { text: '再生中は画面を消さない' }), h('span', { class: 'small muted', text: 'ポケットに入れて聞くとき向け。電池は減ります。画面が消えると読み上げが止まる端末では、これをオンに' })), input));
  }
  root.appendChild(setCard);
  root.appendChild(h('p', { class: 'small muted', text: '読み上げの声は、お使いのスマホに入っているものです。声の聞こえ方は端末によって違います。' }));

  rebuild();
  return {
    el: root,
    cleanup: () => {
      player.dispose();
      setBgmSuppressed(false);
    },
  };
}
