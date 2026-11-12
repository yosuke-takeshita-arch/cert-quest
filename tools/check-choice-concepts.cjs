// 誤答の語のカードが、問題の「関連カード」（concepts）に入っていない（WARN のみ。2026-11-12 追加）。tools/check-data.js と tools/check-data-dx.js が呼ぶ（同じ判定にするため1つにまとめた）。
// 単独では動かさない。
//
// 2026-11-12、先生が DX の D-05-017（範囲の経済が正解、誤答にドミナント戦略・密度の経済・デジュールスタンダード）を解いて
// 「デジュールスタンダードのカードある？」と聞いた。誤答の語にもカードがあるのに concepts に入っておらず、解いた後に開けなかった。
// デジュールは単独のカードが無く、デファクトスタンダードのカードの取り違え欄（confusions）で説明している。
// 4アプリを全部探して concepts に足した（848件）。また作らないように見張る。
//
// 判定（CHOICE-CONCEPT）:
//   1. 誤答（answer 以外の選択肢）の文を見る。（ア）〜・ア：〜・①〜 で区切った組み合わせの選択肢は、区切った1つずつを見る
//   2. その文（空白・かぎ括弧・句読点を除き、全角半角をそろえたもの）が、カードの title の別名と完全に一致したら、そのカードを候補にする。
//      別名 = title そのもの・括弧の外・括弧の中（まるごと、と「：」で区切った前後）。例「RPA（Robotic Process Automation）」なら
//      「RPA」「Robotic Process Automation」も別名。「・」では区切らない（「アジャイル・ガバナンス」を「アジャイル」と読まないため）
//   3. title で一致するカードが無ければ、ほかのカードの取り違え欄（confusions）の title の別名と完全一致するカードを候補にする（デジュールの型）
//   4. 候補のどれかが concepts にあれば出さない。concepts のカードの title か取り違え欄の title がその語を含むときも出さない（もう説明が開ける）
//   5. それ以外は WARN（ID・語・候補のカード）。わざと足さなかったものは下の KEEP に「問題ID|語」と理由を書く
//
// 見ていないもの:
//   - 文章の選択肢の中に出てくる用語（完全一致しか見ない。「Q学習で行動価値を更新する」の Q学習 は見ない）
//   - 「AとB」のように2つの語を並べた選択肢の、片方ずつ（まるごとが title と一致するときだけ出る）
//   - カードの oneLine・why の中でだけ説明している語（title・取り違え欄の title に無い語）
//   - 正解の選択肢（正解のカードは作るときに入れる決まり。誤答を見る検査）
//   - 同じ別名のカードが複数あるとき、どれが問いに合うか（どれか1つが concepts にあれば出さない）
//   - 語の意味（同じ文字で別の意味の語。例「ロイヤルティ」の使用料と顧客の愛着）
'use strict';

const fs = require('fs');
const path = require('path');

const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s「」『』"'。．、,，]/g, '');

// わざと足さなかったもの（問題ID|語 → 理由）
const KEEP = new Map([
  ['G-10-007|透明性', 'AI事業者ガイドラインの共通の指針の「透明性」を問う。C-06-083（説明可能AI）の取り違え欄の透明性はモデルの中身の見えやすさの話で、別の意味'],
  ['AP-01-032|推論', '誤答の「推論」は学習済みモデルに答えを出させる工程の意味（whyWrong）。C-AP-01-060 は第一次AIブームの記号の推論で、別の意味'],
  ['AP-04-061|学習データ', '誤答の「学習データ」はデータポイズニングとの取り違え（whyWrong）。C-AP-02-025 は LLM の学習データの規模の話で、問いと別。データポイズニングのカードは生成AIパスポートに無い'],
]);

function aliases(title) {
  const t = String(title);
  const out = new Set([t]);
  const outer = t.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (outer) out.add(outer);
  for (const m of t.matchAll(/[（(]([^）)]*)[）)]/g)) {
    out.add(m[1]);
    for (const p of m[1].split(/[：:]/)) if (p.trim()) out.add(p.trim());
  }
  return [...out].map(norm).filter((a) => a.length >= 2);
}

function choiceTerms(c) {
  const s = String(c);
  const parts = s.split(/（[ア-ン]）|[ア-ン][：:]|[①-⑩]/).map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [s];
}

// conceptDirs: data/concepts のディレクトリの一覧（各検査が読むものと同じ）
function makeChoiceConceptChecker(warn, conceptDirs) {
  const cards = new Map(); // id -> { title, conf: [title] }
  for (const d of conceptDirs) {
    if (!fs.existsSync(d)) continue;
    for (const fn of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(d, fn), 'utf8'));
        if (Array.isArray(arr)) for (const c of arr) if (c && c.id && c.title) cards.set(c.id, { title: c.title, conf: (c.confusions || []).map((x) => x && x.title).filter(Boolean) });
      } catch (_) { /* 読めないファイルは自分の検査で NG になる */ }
    }
  }
  const byTitle = new Map(); // 別名 -> [id]
  const byConf = new Map();
  const put = (m, k, id) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(id)) m.get(k).push(id); };
  for (const [id, c] of cards) {
    for (const a of aliases(c.title)) put(byTitle, a, id);
    for (const t of c.conf) for (const a of aliases(t)) put(byConf, a, id);
  }
  const stats = { n: 0, flagged: 0, kept: 0 };
  function check(f, id, o) {
    if (!Array.isArray(o.choices) || !Array.isArray(o.concepts) || !Number.isInteger(o.answer)) return;
    stats.n++;
    const have = new Set(o.concepts);
    const haveText = o.concepts.filter((c) => cards.has(c)).map((c) => [cards.get(c).title].concat(cards.get(c).conf).map(norm).join('|')).join('|');
    const miss = [];
    o.choices.forEach((ch, i) => {
      if (i === o.answer) return;
      for (const t of choiceTerms(ch)) {
        const n = norm(t);
        if (n.length < 2) continue;
        const cand = byTitle.get(n) || byConf.get(n);
        if (!cand) continue;
        if (cand.some((c) => have.has(c)) || haveText.includes(n)) continue;
        if (KEEP.has(id + '|' + t.trim())) { stats.kept++; continue; }
        if (!miss.some((m) => m.t === t.trim())) miss.push({ t: t.trim(), cand });
      }
    });
    if (!miss.length) return;
    stats.flagged++;
    warn(f, id, `CHOICE-CONCEPT: 誤答の語のカードが concepts に無い（${miss.map((m) => `「${m.t}」→ ${m.cand.join('／')}`).join('、')}。concepts の末尾に足すか、足さない理由を tools/check-choice-concepts.cjs の KEEP に書く）`);
  }
  function summary() {
    if (!stats.n) return [];
    return [`CHOICE-CONCEPT 全体: 誤答の語のカードが concepts に無い ${stats.flagged}/${stats.n}（わざと残した ${stats.kept}）`];
  }
  return { check, summary, stats };
}

module.exports = { makeChoiceConceptChecker, aliases, choiceTerms };
