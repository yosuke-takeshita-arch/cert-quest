// 選択肢の「出典の名乗り」と「控えめな言い方」の偏り（WARN のみ。2026-11-12 追加）。tools/check-data.js と tools/check-data-dx.js が呼ぶ（同じ判定にするため1つにまとめた）。
// 単独では動かさない。
//
// 2026-11-12、4アプリ（G検定・DX・生成AIパスポート・ガードの砦）の問題を担当が手で直した型を、また作らないように見張る。
//   SOURCE-CUE（出典の名乗りの偏り）: 一部の選択肢だけが「白書は、…としている」「〇〇の論文は、…と述べた」のように出典を名乗り、
//     名乗る側がいつも正しい文（または、いつも誤った文）になっている。学習者は名乗る選択肢を消せば答えが絞れる。
//     直し方は、出典を問題文に移して、選択肢は中身だけにする（実例 AP-02-009・AP-02-021・AP-02-129・D-01-026・G-07-043 の直す前）
//   HEDGE-CUE（控えめな言い方の偏り）: 「とされる・としている・と考えられている・指摘されている」などが、正しい文か誤った文の片側だけに付いている
//
// 判定（2つとも同じ）:
//   1. 選択肢ごとに、印（出典の名乗り／控えめな言い方）があるかを見る（下の SOURCE_RE・HEDGE_RE）
//   2. 選択肢ごとに、その文が正しい文か誤った文かを決める。ふつうの問題は正解だけが正しい文、
//      適切でないものを選ぶ問題（format が not か negative が true）は正解だけが誤った文
//   3. 印のある選択肢が1つ以上あり、印の無い選択肢も1つ以上あり、印のある選択肢がみな同じ側（みな正しい文か、みな誤った文）なら WARN。
//      「印があれば正しい文」と覚えた学習者は、印で選択肢を消して答えを絞れる（4択で印が1つだけでも1つ消せる）
//   答えの側にも同じ印がある問題（印が正しい文と誤った文の両方にある）は、印で絞れないので出さない。
//   反対の側に似た言い方（印より広く取る SOURCE_LOOSE・HEDGE_LOOSE。文の途中の「とされ」や「〜とする」「〜と指摘している」）がある問題も出さない
//
// 見ていないもの:
//   - 一覧に無い出典の名前（SOURCE_NOUN に無い名前。「OpenAIは、…を勧めている」「Googleの用語集は」のような会社・人・ページの名前は見ない）
//   - 文の途中の名乗り（「〜だが、Sカーブの考え方では」）と、終わりが REPORT_END に無い言い方の名乗り（「論文は、…を扱った」）
//   - 一覧に無い控えめな言い方（「らしい」「ようだ」「〜と見る向きがある」など）と、文の途中の控えめな言い方（「〜とされるので」）
//   - 言い方の意味（「としている」が出典の言い分か、中身の「〜とする」かは、HEDGE_RE の前の語だけで見分ける）
//   - 印の強さの違い（「白書は」と「白書によると」は同じに数える）。1つの選択肢に印がいくつあっても1つと数える
//   - combo の問題（選択肢が語の組で、名乗りが出ない）・選択肢が2つ以下の問題
//   - 問題文・解説（選択肢以外の欄）
'use strict';

// 出典の名乗り = 文の頭（選択肢の頭か「。」の後）で出典の名前を主語にし（SOURCE_HEAD）、選択肢の終わりが出典の言い分を伝える言い方（REPORT_END）。
//   出典の名前は SOURCE_NOUN の語で終わる名前（「令和6年版情報通信白書」「GPT-4の技術報告」「CutMix の論文」）。名前の後ろの（令和元年版）のような括弧は読み飛ばす
//   文の途中の「Sカーブの考え方では、」（「〜が、」の後）は、出典ではなく理屈の一部なので数えない
//   終わりを見るのは、出典の名前が話の中身そのものの文（「調査は、…を把握するために行われた」「委員会への報告は、…行わなければならない」
//   「国際指針は、11の原則…を含む」）を外すため。法律・条文（「著作権法は」「第30条の4では」）は SOURCE_NOUN に入れない。
//   「統合報告書」「有価証券報告書」は、企業が出す書類の名前（中身の語）なので外す
const SOURCE_NOUN = '(?:白書|(?<!統合|有価証券)報告書|技術報告|レポート[0-9０-９.．]*|論文|ガイドライン|ガイドブック|ハンドブック|手引き|調査|考え方|指針|提言)';
const SOURCE_HEAD = new RegExp('(?:^|。)[^、。]{0,40}?' + SOURCE_NOUN + '(?:（[^）]{0,20}）)?(?:は、|では、|によると、?|によれば、?|が紹介する)');
const REPORT_END = /(?:と(?:して|し)?(?:いる|いた|した|する)|(?:挙げ|紹介し|述べ|指摘し|示し|求め|勧め|提案し|報告し|位置づけ|呼ん|整理し|強調し|説明し)(?:て(?:いる|いた)|た)|(?:挙げる|求める|勧める|述べる|示す|呼ぶ)|とされ(?:る|て(?:いる|いた)|た)|と考えられ(?:る|ている))[。．]?$/;
const SOURCE_RE = { test: (s) => SOURCE_HEAD.test(s) && REPORT_END.test(s) };
// 控えめな言い方 = 文の終わり（「。」の前か選択肢の終わり）の「とされる・としている・と考えられる・指摘されている」など。
//   文の途中の「〜とされるので」「〜と考えられるが」は、理屈の前提を言う中身の一部（DX の「つながり」の問題に多い）なので数えない
//   「見落としている」「盗もうとしている」（落の後と、「もう」「よう」などの意志の形の後。「行うとしている」は数える）と、「〜を対象としている」「〜を前提としている」「〜を目的としている」のような
//   『AをBとする』の言い方は、控えめな言い方ではなく中身なので外す
const HEDGE_RE = /(?:とされ(?:る|ます|た|て(?:いる|いた|います))|(?<!落|[おこごそぞとどのぼぽもよろ]う|対象|前提|目的|基本|中心|原則|主眼|基盤|範囲)と(?:して(?:いる|いた|います))|と考えられ(?:る|ます|て(?:いる|います))|指摘されて(?:いる|います)|と(?:み|見)られ(?:る|て(?:いる|います))|と(?:言|い)われ(?:る|て(?:いる|います)))(?:[。．]|$)/;

function truthSides(o) {
  const neg = o.format === 'not' || o.negative === true;
  return o.choices.map((_, i) => (i === o.answer) !== neg); // true = 正しい文
}

// 印のある選択肢が一部だけにあり、みな同じ側なら、その側（'right'＝正しい文 / 'wrong'＝誤った文）を返す。手がかりでなければ null
// 反対の側にも「似た言い方」があれば手がかりにしない（担当が残した形。例: 誤った文2つが「〜としている」で終わり、正解が「〜を目指すとする」で終わる AP-04-294、
// 正しい文1つが「〜と考えられている」で終わり、正解が「〜と指摘している」で終わる D-02-030）。似た言い方は、印より広く取る（文の途中・『AをBとする』も含む）
const SOURCE_LOOSE = SOURCE_HEAD;
const HEDGE_LOOSE = /とされ|と(?:して(?:いる|いた|います)|する|した)(?:[。．、]|$)|と考えられ|と考え(?:て|る)|指摘(?:され|し)|と(?:み|見)られ|と(?:言|い)われ|と述べ|と(?:報告|説明|強調)し/;

// 印のある選択肢が一部だけにあり、みな同じ側で、反対の側に似た言い方も無ければ、その側（'right'＝正しい文 / 'wrong'＝誤った文）を返す。手がかりでなければ null
function leakSide(o, re, loose) {
  const marked = o.choices.map((c) => re.test(String(c)));
  const n = marked.filter(Boolean).length;
  if (n === 0 || n === o.choices.length) return null;
  const truth = truthSides(o);
  const sides = new Set(marked.map((m, i) => (m ? truth[i] : null)).filter((x) => x !== null));
  if (sides.size !== 1) return null;
  const side = [...sides][0];
  if (loose && o.choices.some((c, i) => truth[i] !== side && loose.test(String(c)))) return null;
  return side ? 'right' : 'wrong';
}

const KINDS = [
  { key: 'SOURCE-CUE', stat: 'source', re: SOURCE_RE, loose: SOURCE_LOOSE, label: '出典を名乗る', fix: '出典は問題文に移し、選択肢は中身だけにする' },
  { key: 'HEDGE-CUE', stat: 'hedge', re: HEDGE_RE, loose: HEDGE_LOOSE, label: '文の終わりが控えめな言い方（とされる・としている 等）の', fix: '同じ言い方を正しい文と誤った文の両方に使うか、どちらからも外す' },
];

// warn は check-data.js・check-data-dx.js の warn(f, id, msg)。check を問題ごとに呼び、summary の行を集計に出す
function makeVoiceCueChecker(warn) {
  const stats = { n: 0, source: 0, hedge: 0 };
  function check(f, id, o) {
    if (o.format === 'combo') return;
    if (!Array.isArray(o.choices) || o.choices.length < 3 || !Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.choices.length) return;
    stats.n++;
    for (const k of KINDS) {
      const side = leakSide(o, k.re, k.loose);
      if (!side) continue;
      const cnt = o.choices.filter((c) => k.re.test(String(c))).length;
      stats[k.stat]++;
      warn(f, id, `${k.key}: ${k.label}選択肢が ${o.choices.length}つ中 ${cnt}つだけで、みな${side === 'right' ? '正しい文' : '誤った文'}（印で選択肢を消すと答えが絞れる。${k.fix}）`);
    }
  }
  function summary() {
    if (!stats.n) return [];
    return [`SOURCE 全体: 出典の名乗りで答えが絞れる ${stats.source}/${stats.n}`, `HEDGE 全体: 控えめな言い方で答えが絞れる ${stats.hedge}/${stats.n}`];
  }
  return { check, summary, stats };
}

module.exports = { makeVoiceCueChecker, SOURCE_RE, HEDGE_RE, leakSide };
