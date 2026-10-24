// 用語カードの一覧・1枚の表示・つながりをたどる表示。
import { h, clear, externalLink } from '../ui.js';
import { resolveRef } from '../lib/data.js';
import { figureBlock } from './figure.js';
import { richEl } from './richtext.js';
import { basicIdsOfTitle } from '../lib/basics.js';
import { reportButton } from './report.js';
import { statsByKey, questionsToJudge, WEAK_BELOW } from '../lib/weakness.js';
import { CARD_VIEWS, normalizeCardView, cardSections } from '../lib/cardtree.js';

const RELATION_LABEL = {
  cause: '原因', causes: '原因', effect: '結果', result: '結果', leads_to: '次につながる', 'leads-to': '次につながる',
  solves: '解決する', solved_by: '解決される', 'solved-by': '解決される', improves: '改良する', improved_by: '改良される',
  part_of: '一部', 'part-of': '一部', has_part: '構成要素', example: '例', example_of: '例の上位', prerequisite: '前提',
  related: '関連', see_also: '関連', contrast: '対比', opposite: '対比', type_of: '種類', 'is-a': '種類',
};
export const relationLabel = (r) => (r ? RELATION_LABEL[r] || r : '関連');

export function statusChip(status) {
  return status === 'verified' ? null : h('span', { class: 'chip unverified', title: '出典での確認がまだ済んでいません' }, '未確認');
}

/** 用語カードへの参照。解決できればボタン、できなければ文字だけ。 */
export function refChip(app, ref, open) {
  const r = resolveRef(ref, app.data.conceptIndex);
  if (r.concept && open) {
    return h('button', { class: 'chip link', type: 'button', onClick: () => open(r.concept.id) }, r.label);
  }
  return h('span', { class: 'chip plain' }, r.label);
}

export function sourcesList(sources) {
  if (!sources || !sources.length) return null;
  return h('p', { class: 'sources small muted' }, '出典: ', sources.map((s, i) => [i ? ' / ' : '', externalLink(s.url, s.title || s.url)]));
}

/** カード1枚ぶんの中身。open(id) でほかのカードへ移る。 */
export function cardBody(app, c, open) {
  const d = app.data;
  const back = d.backlinks.get(c.id) || [];
  const incoming = back.filter((b) => b.kind === 'link');
  const wrap = h('article', { class: 'card concept' });
  wrap.appendChild(h('p', { class: 'crumb small muted', text: c.syllabus.join(' › ') }));
  wrap.appendChild(h('h2', {}, c.title, ' ', statusChip(c.status)));
  const own = () => basicIdsOfTitle(d.basicsMatcher, c.title); // このカード自身の題名と同じ基礎のことば（最初から『印を付けた』ことにして、自分の語には付けない）
  const seen = own(); // 基礎のことばの印。一言と『背景とポイント』は続けて読むので1区画（同じ語に印を付けるのは最初の1回だけ）
  if (c.oneLine) wrap.appendChild(richEl(app, 'p', { class: 'one-line' }, c.oneLine, seen));
  const fig = figureBlock(app, c.figures);
  if (fig) wrap.appendChild(fig);
  if (c.why) wrap.appendChild(h('div', { class: 'why' }, h('h3', { text: '背景とポイント' }), richEl(app, 'p', {}, c.why, seen)));

  if (c.links.length || incoming.length) {
    const g = h('div', { class: 'tie' }, h('h3', { text: 'つながり' }));
    if (incoming.length) {
      g.appendChild(h('p', { class: 'small muted', text: 'このカードに来るもの' }));
      const ul = h('ul', { class: 'tie-list' });
      for (const b of incoming) {
        ul.appendChild(h('li', {}, refChip(app, { id: b.from.id }, open), h('span', { class: 'rel', text: '─（' + relationLabel(b.relation) + '）→' }), h('strong', { text: c.title })));
      }
      g.appendChild(ul);
    }
    if (c.links.length) {
      g.appendChild(h('p', { class: 'small muted', text: 'ここから先へたどる' }));
      const ul = h('ul', { class: 'tie-list' });
      for (const l of c.links) {
        const r = resolveRef(l, d.conceptIndex);
        ul.appendChild(h('li', {}, h('strong', { text: c.title }), h('span', { class: 'rel', text: '─（' + relationLabel(r.relation) + '）→' }), refChip(app, l, open)));
      }
      g.appendChild(ul);
    }
    wrap.appendChild(g);
  }

  if (c.confusions.length) {
    const g = h('div', { class: 'confuse' }, h('h3', { text: 'よくある混同' }));
    const ul = h('ul', { class: 'conf-list' });
    const confSeen = own(); // 『よくある混同』も1区画
    for (const f of c.confusions) {
      const r = resolveRef(f, d.conceptIndex);
      ul.appendChild(h('li', {}, refChip(app, f, open), r.point ? richEl(app, 'p', { class: 'point' }, '違い: ' + r.point, confSeen) : null));
    }
    g.appendChild(ul);
    wrap.appendChild(g);
  }

  const qs = d.questions.filter((q) => q.concepts.some((x) => resolveRef(x, d.conceptIndex).concept === c));
  if (qs.length) wrap.appendChild(h('p', { class: 'small muted', text: 'このカードに関する問題: ' + qs.length + '問' }));
  const src = sourcesList(c.sources);
  if (src) wrap.appendChild(src);
  const rep = reportButton(app, { kind: 'card', id: c.id, text: c.title + (c.oneLine ? '：' + c.oneLine : '') });
  if (rep) wrap.appendChild(rep);
  return wrap;
}

// ---- 一覧 ----
// 「分野で見る」（シラバスの分け方で開いていく）と「一覧・検索」（全部を並べて検索）を切り替える。選んだほうは settings.cardView に保存する。
// 分野で見るときに開いた節と、最後に開いたカードは覚えておき、カードから戻ったときに同じ場所を出す（この画面を開いている間だけ）。
const openKeys = new Set();
let lastCardId = null;

function cardRow(c, open) {
  return h('button', { class: 'row-btn', type: 'button', 'data-card': c.id, onClick: () => open(c.id) },
    h('span', { class: 'row-main' }, h('strong', { text: c.title }), c.oneLine ? h('span', { class: 'small muted', text: c.oneLine }) : null),
    statusChip(c.status));
}

/**
 * 分野の見出しの下に出す、その分野の問題の正答率。押すと「苦手の分析」の「すべての分野」のその行へ行ける（そこで解ける）。
 * 計算は lib/weakness.js（苦手の分析と同じ数）。問題の無い分野・カードだけの節（stat が無い）には出さない。
 */
function rateLink(app, stat) {
  if (!stat) return null;
  const left = questionsToJudge(stat);
  const label = stat.qualified
    ? '正答率 ' + stat.percent + '%'
    : '正答率 —（あと' + left + '問で出ます）';
  const parts = [h('span', { class: 'card-rate-text', text: label })];
  if (stat.qualified) {
    parts.push(h('span', { class: 'progress card-rate-bar' + (stat.rate >= WEAK_BELOW ? ' ok' : ''), 'aria-hidden': 'true' }, h('span', { class: 'progress-fill', style: { width: stat.percent + '%' } })));
  }
  parts.push(h('span', { class: 'card-rate-go small', 'aria-hidden': 'true', text: '分野の一覧 ›' }));
  return h('button', {
    class: 'card-rate' + (stat.qualified ? (stat.rate < WEAK_BELOW ? ' weak' : ' strong') : ''), type: 'button', 'data-card-rate': stat.unit.key,
    'aria-label': stat.unit.name + ' の問題の' + (stat.qualified ? '正答率 ' + stat.percent + '%' : '正答率はあと' + left + '問で出ます') + '。苦手の分析の「すべての分野」で見る',
    onClick: () => app.go('#/weak/' + encodeURIComponent(stat.unit.key)),
  }, ...parts);
}

function cardTreeView(app, open) {
  const box = h('div', { class: 'card-tree' });
  const rates = statsByKey(app.data.tree, app.state.qstats);
  const section = (s, depth) => {
    const det = h('details', { class: depth === 0 ? 'major card-major' : 'card-sub', open: openKeys.has(s.key) ? true : null },
      h('summary', {}, h('span', { class: 'sum-name', text: s.name }), h('span', { class: 'small muted', text: s.count + '枚' })));
    det.addEventListener('toggle', () => (det.open ? openKeys.add(s.key) : openKeys.delete(s.key)));
    const inner = h('div', { class: 'card-tree-inner' });
    const own = depth >= 1 ? rateLink(app, rates.get(s.key)) : null; // 中項目（小項目を持たない章）の正答率
    if (own) inner.appendChild(own);
    for (const c of s.cards) inner.appendChild(cardRow(c, open));
    for (const ch of s.children) {
      // 小項目（3段目）は開け閉めせず、見出しの下にカードを並べる
      if (depth >= 1) {
        inner.appendChild(h('h3', { class: 'card-small-title', text: ch.name + '（' + ch.count + '）' }));
        const sub = rateLink(app, rates.get(ch.key));
        if (sub) inner.appendChild(sub);
        for (const c of ch.cards) inner.appendChild(cardRow(c, open));
      } else inner.appendChild(section(ch, depth + 1));
    }
    det.appendChild(inner);
    return det;
  };
  for (const s of cardSections(app.data.tree, app.data.concepts)) box.appendChild(section(s, 0));
  return box;
}

export function renderCardList(app) {
  const d = app.data;
  const { state } = app;
  const root = h('section', { class: 'view' });
  root.appendChild(h('h1', { text: '用語カード' }));
  // 基礎のことば（次元・パラメータなど、試験範囲の外の土台の言葉。要件定義書 §7-5）の入口。無いアプリ・空のファイルでは何も出さない
  const nBasics = Array.isArray(d.basics) ? d.basics.length : 0;
  if (nBasics) {
    root.appendChild(h('button', { class: 'basics-entry', type: 'button', 'data-basics-entry': '', onClick: () => app.go('#/basics') },
      h('span', { class: 'row-main' },
        h('strong', { text: '基礎のことば（' + nBasics + '語）' }),
        h('span', { class: 'small', text: '次元・パラメータなど、カードを読む前に知っておきたい土台の言葉' })),
      h('span', { class: 'basics-entry-arrow', 'aria-hidden': 'true', text: '›' })));
  }
  if (!d.concepts.length) {
    root.appendChild(h('div', { class: 'empty' }, h('p', { text: '用語カードは準備中です。' }), h('p', { class: 'small muted', text: 'できあがり次第、ここに並びます。' })));
    return root;
  }
  const btns = {};
  const choose = (mode) => {
    state.settings.cardView = mode;
    app.commit();
    show(true);
  };
  root.appendChild(h('div', { class: 'map-switch', role: 'group', 'aria-label': 'カードの表示' },
    btns.tree = h('button', { class: 'map-switch-btn', type: 'button', onClick: () => choose('tree') }, '分野で見る'),
    btns.all = h('button', { class: 'map-switch-btn', type: 'button', onClick: () => choose('all') }, '一覧・検索')));
  const body = h('div', {});
  root.appendChild(body);
  const open = (id) => {
    lastCardId = id;
    app.go('#/card/' + encodeURIComponent(id));
  };
  function show(toggled) {
    const mode = normalizeCardView(state.settings.cardView);
    for (const k of CARD_VIEWS) {
      btns[k].setAttribute('aria-pressed', k === mode ? 'true' : 'false');
      btns[k].classList.toggle('on', k === mode);
    }
    clear(body);
    if (toggled) window.scrollTo(0, 0);
    if (mode === 'tree') {
      const tree = cardTreeView(app, open);
      body.appendChild(tree);
      // カードから戻ったときは、さっき開いたカードが見える位置へ動かす（app.js が先頭へ戻したあとに）
      const target = !toggled && lastCardId ? [...tree.querySelectorAll('[data-card]')].find((b) => b.dataset.card === lastCardId) : null;
      if (target && target.closest('details[open]') && !target.closest('details:not([open])')) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (target.isConnected) target.scrollIntoView({ block: 'center' });
        }));
      }
    } else body.appendChild(searchList(app, open));
  }
  show(false);
  return root;
}

function searchList(app, open) {
  const d = app.data;
  const wrap = h('div', {});
  const input = h('input', { type: 'search', class: 'search', placeholder: 'カードを検索（例: 活性化関数）', 'aria-label': 'カードを検索' });
  const list = h('div', { class: 'card-groups' });
  wrap.appendChild(input);
  wrap.appendChild(list);
  const draw = () => {
    clear(list);
    const kw = input.value.normalize('NFKC').trim().toLowerCase();
    const hit = d.concepts.filter((c) => !kw || (c.title + c.oneLine).normalize('NFKC').toLowerCase().includes(kw));
    if (!hit.length) {
      list.appendChild(h('p', { class: 'empty small', text: '「' + input.value + '」に合うカードはありません。' }));
      return;
    }
    const groups = new Map();
    for (const c of hit) {
      const g = c.syllabus[0] || 'その他';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    }
    for (const [g, cs] of groups) {
      list.appendChild(h('h2', { class: 'group-title', text: g + '（' + cs.length + '）' }));
      for (const c of cs) list.appendChild(cardRow(c, open));
    }
  };
  input.addEventListener('input', draw);
  draw();
  return wrap;
}

// ---- 1枚 ----
export function renderCard(app, id) {
  const c = app.data.conceptIndex.byId.get(id);
  const root = h('section', { class: 'view' });
  root.appendChild(h('button', { class: 'btn ghost back', type: 'button', onClick: () => history.back() }, '← 戻る'));
  if (!c) {
    root.appendChild(h('div', { class: 'empty' }, h('p', { text: 'このカードは見つかりません。' })));
    return root;
  }
  root.appendChild(cardBody(app, c, (nid) => app.go('#/card/' + encodeURIComponent(nid))));
  return root;
}

// ---- 問題の途中で開く（下から出るシート。閉じれば問題に戻る） ----
import { openSheet } from '../ui.js';
export function openCardSheet(app, id) {
  openSheet((body) => {
    const show = (cid) => {
      clear(body);
      const c = app.data.conceptIndex.byId.get(cid);
      body.appendChild(c ? cardBody(app, c, show) : h('p', { text: 'このカードは見つかりません。' }));
      body.scrollTop = 0;
    };
    show(id);
  });
}
