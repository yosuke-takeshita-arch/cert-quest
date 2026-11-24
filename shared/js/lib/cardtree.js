// 用語カードを、シラバスの分け方（分野 › 中項目 › 小項目）で並べる。純粋な関数だけ（DOM・localStorage に触らない）。
// 2026-10-14 先生「カードのうえにある 技術分野→機械学習の概要→教師あり学習 の分け方で観れないのが残念」。
// 全カードを並べて検索できる一覧はそのまま残し、カードの画面で切り替える。どちらを選んだかは settings.cardView に保存する。

export const CARD_VIEWS = ['tree', 'all'];
export const DEFAULT_CARD_VIEW = 'tree';

export function normalizeCardView(v) {
  return typeof v === 'string' && CARD_VIEWS.includes(v) ? v : DEFAULT_CARD_VIEW;
}

/**
 * buildTree の結果から、カードのある節だけを、シラバスの順に入れ子で返す。
 * { key, name, count（その下の全部のカード）, cards（ちょうどその節に付いたカード）, children }
 * シラバスの分け方を持たないカードは、最後の「その他」にまとめる（どのカードも1回だけ出る）。
 */
export function cardSections(tree, concepts) {
  const sec = (n) => ({
    key: n.key,
    name: n.name,
    count: n.concepts.length,
    cards: n.concepts.filter((c) => Array.isArray(c._path) && c._path.length === n.depth + 1),
    children: n.children.map(sec).filter((s) => s.count > 0),
  });
  const out = tree.roots.map(sec).filter((s) => s.count > 0);
  const loose = concepts.filter((c) => !c.syllabus || !c.syllabus.length);
  if (loose.length) out.push({ key: '#loose', name: 'その他', count: loose.length, cards: loose, children: [] });
  return out;
}
