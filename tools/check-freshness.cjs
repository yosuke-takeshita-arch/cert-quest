// 最新事例の鮮度と引退の検査（2026-11-14 先生決定。要件定義書 §7-6）。tools/check-data.js と tools/check-data-dx.js が呼ぶ（同じ判定にするため1つにまとめた）。
// 単独では動かさない。
//
// 先生の問い（逐語）「古いトレンドの問題は消して、新しいトレンドはどんどん採用していかないといけないよね」。門番の案に先生（逐語）「全部おすすめでいい」。
// 決まったこと:
//   - 最新事例の問題とカードに、いつの事実か（asOf）と見直す年月（reviewBy）を持たせる。見直す年月は、事実から1年後
//   - 見直す年月が来たものは、公開のたびに回すこの検査が1件ずつ出す
//   - 古いものは消さずに引退（status: "retired"）にする。引退した問題は出題から外すが、学習記録と問題 ID は残す（shared/js/lib/data.js の loadData）
//
// 判定（問題・カードの両方）:
//   NG  asOf・reviewBy の形が "YYYY-MM"（月は 01〜12）でない
//   NG  片方だけ書いてある（asOf だけでは見直しの月が分からず、この検査が永久に出さない。reviewBy だけでは何の事実の見直しか分からない）
//   NG  reviewBy が asOf と同じか前
//   WARN reviewBy が asOf の12か月後より先（決まりは1年後。2年後などにすると見直しが遅れる）
//   WARN（STALE）引退していない問題・カードで、reviewBy の月が今日の月と同じか前（見直しの月が来た）。件数は STALE 行に出す
//        「過ぎた」を月の単位で見るので、見直しの月に入った日から出す（月末まで待たない）
//   WARN 引退したカード（カードの引退の見せ方は先生の判断待ちで、いまの画面は引退したカードにも『未確認』の印を出す。決まるまでカードには付けない）
//   WARN（EXAM）模試に設計図（config.json の exam.blueprint）がある資格で、引退した問題を除くと設計図の枠を満たせなくなる
//        （型を満たせず別の型で補う数が増える、または模試の問題数が減る）。EXAM 行に、引退を除いた数と含めた数を出す
//        数は shared/js/lib/quiz.js の pickExamByBlueprint・blueprintCells をそのまま呼んで出す（アプリと同じ選び方。足りない数は乱数に依らない）
//
// 今日の月: 既定はこのパソコンの日付。テストでは --today YYYY-MM で決める（check-data.js・check-data-dx.js の引数）
//
// 見ていないもの:
//   - asOf が本当にその事実の年月か・事実がいまも正しいか（人が出典を開いて確かめる）
//   - asOf・reviewBy を書くべき問題に書いてあるか（最新事例の区分で書いていない数は FRESH 行に数だけ出す。NG にはしない）
//   - 引退した問題を、出題中の問題・カードの説明が前提にしていないか
//   - 模試の枠は、設計図を持つ資格だけ（いまは DX）。設計図の無い資格は、引退で問題数が本番より少なくなっても見ない（模試は縮小版になる）
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const isMonth = (s) => typeof s === 'string' && MONTH_RE.test(s);
const monthIndex = (s) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
const REVIEW_MONTHS = 12; // 見直すのは事実から1年後（先生決定 2026-11-14）

/** このパソコンの今日の年月（"YYYY-MM"）。 */
function thisMonth(now = new Date()) {
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

/** 引数の並びから --today YYYY-MM を取り出す（取り出した2つは args から消す）。無ければ今日。形が違えば null。 */
function takeTodayArg(args) {
  const i = args.indexOf('--today');
  if (i < 0) return thisMonth();
  const v = args[i + 1];
  args.splice(i, 2);
  return isMonth(v) ? v : null;
}

/**
 * err(f, id, msg)・warn(f, id, msg) は呼ぶ側の検査の関数。today は "YYYY-MM"。
 * isLatest(o, kind) を渡すと、その区分（DX の『最新事例＆トレンド』）で asOf の無い数を FRESH 行に出す。
 */
function makeFreshnessChecker({ err, warn, today, isLatest = null }) {
  const st = {
    stale: { questions: 0, concepts: 0 },
    retired: { questions: 0, concepts: 0 },
    dated: { questions: 0, concepts: 0 },
    latest: { questions: 0, concepts: 0 },
    latestUndated: { questions: 0, concepts: 0 },
  };
  const kindKey = (kind) => (kind === 'questions' ? 'questions' : 'concepts');

  function check(f, id, o, kind) {
    if (!o || typeof o !== 'object') return;
    const k = kindKey(kind);
    const hasA = 'asOf' in o;
    const hasR = 'reviewBy' in o;
    const okA = hasA && isMonth(o.asOf);
    const okR = hasR && isMonth(o.reviewBy);
    if (hasA && !okA) err(f, id, `asOf の形が "YYYY-MM" でない: ${JSON.stringify(o.asOf)}（いつの事実かを年と月で書く。例 "2026-10"）`);
    if (hasR && !okR) err(f, id, `reviewBy の形が "YYYY-MM" でない: ${JSON.stringify(o.reviewBy)}（見直す年月。asOf の1年後）`);
    if (hasA !== hasR) err(f, id, `asOf と reviewBy は2つそろえて書く（${hasA ? 'reviewBy' : 'asOf'} が無い）`);
    if (okA && okR) {
      const gap = monthIndex(o.reviewBy) - monthIndex(o.asOf);
      if (gap <= 0) err(f, id, `reviewBy（${o.reviewBy}）が asOf（${o.asOf}）より後でない`);
      else if (gap > REVIEW_MONTHS) warn(f, id, `reviewBy（${o.reviewBy}）が asOf（${o.asOf}）の${REVIEW_MONTHS}か月後より先（決まりは事実から1年後）`);
    }
    if (okA) st.dated[k]++;
    if (isLatest && isLatest(o, kind)) {
      st.latest[k]++;
      if (!hasA) st.latestUndated[k]++;
    }
    if (o.status === 'retired') {
      st.retired[k]++;
      if (k === 'concepts') warn(f, id, 'カードの引退（status: "retired"）は、画面での見せ方がまだ決まっていない（いまは『未確認』の印が出る）。決まるまでカードには付けない');
      return; // 引退したものは見直しの対象にしない
    }
    if (okR && today && monthIndex(o.reviewBy) <= monthIndex(today)) {
      st.stale[k]++;
      warn(f, id, `STALE: 見直す月（reviewBy ${o.reviewBy}）が来た（事実 ${okA ? o.asOf : '?'}・今日 ${today}）。出典を開き、新しい事実に直して asOf・reviewBy を書き直すか、引退（status: "retired"）にする`);
    }
  }

  function summary() {
    const s = st;
    const lines = [];
    lines.push(`STALE 全体: 見直す月が来た ${s.stale.questions + s.stale.concepts}件（問題 ${s.stale.questions}・カード ${s.stale.concepts}。今日 ${today}）`);
    lines.push(`RETIRED 全体: 引退 問題 ${s.retired.questions}・カード ${s.retired.concepts}（問題は出題に出ない）／asOf あり 問題 ${s.dated.questions}・カード ${s.dated.concepts}`);
    if (isLatest) lines.push(`FRESH 最新事例: 問題 ${s.latest.questions}問のうち asOf なし ${s.latestUndated.questions}・カード ${s.latest.concepts}枚のうち asOf なし ${s.latestUndated.concepts}`);
    return lines;
  }

  /**
   * 引退で模試の設計図の枠が割り込まないか。dataRoots は検査したファイルの data/ ディレクトリ。
   * アプリが読む問題（data/index.json に載っているファイル）を全部読んで見る（引数に一部の章しか渡さなくても全体で見る）。
   * 戻り値は EXAM 行の配列。readJson は呼ぶ側の読み方（BOM で止める）。
   */
  async function checkExam(dataRoots, readJson) {
    const lines = [];
    const quizUrl = pathToFileURL(path.join(__dirname, '..', 'shared', 'js', 'lib', 'quiz.js')).href;
    let quiz = null;
    for (const dataRoot of [...new Set(dataRoots)]) {
      const appDir = path.dirname(dataRoot);
      const cfgPath = path.join(appDir, 'config.json');
      const idxPath = path.join(dataRoot, 'index.json');
      if (!fs.existsSync(cfgPath) || !fs.existsSync(idxPath)) continue;
      let cfg, idx;
      try { cfg = readJson(cfgPath); idx = readJson(idxPath); } catch (e) { warn(cfgPath, null, `EXAM: config.json か index.json を読めない（模試の枠を見ない）: ${e.message}`); continue; }
      if (!cfg || !cfg.exam || !cfg.exam.blueprint) continue;
      if (!quiz) quiz = await import(quizUrl);
      const bp = quiz.readBlueprint(cfg.exam);
      if (!bp) continue;
      const app = path.basename(appDir);
      let syl = [];
      try { syl = readJson(path.join(dataRoot, typeof idx.syllabus === 'string' ? idx.syllabus : 'syllabus.json')); } catch (e) { /* 木が読めなければ領域が無いので下で出す */ }
      const nameOf = (x) => (typeof x === 'string' ? x : x && (x.name || x.title || x.label)) || null;
      const roots = (Array.isArray(syl) ? syl : []).filter((x) => !(x && x.supplement === true)).map(nameOf).filter(Boolean);
      const all = [];
      for (const rel of Array.isArray(idx.questions) ? idx.questions : []) {
        const p = path.join(dataRoot, rel);
        if (!fs.existsSync(p)) continue;
        try { const arr = readJson(p); if (Array.isArray(arr)) all.push(...arr.filter((q) => q && Array.isArray(q.syllabus) && q.syllabus.length)); } catch (e) { /* 形の誤りはふつうの検査が出す */ }
      }
      const active = all.filter((q) => q.status !== 'retired');
      const nRetired = all.length - active.length;
      const pick = (qs) => quiz.pickExamByBlueprint(qs, bp, roots, () => 0, null);
      const a = pick(active);
      const b = pick(all);
      lines.push(`EXAM ${app}: 模試の枠 ${roots.length}領域×${bp.perRoot}問。型を満たせず別の型で補う問題 引退を除くと ${a.filled}問・模試 ${a.items.length}問（引退 ${nRetired}問を含めると ${b.filled}問・${b.items.length}問）`);
      if (a.filled > b.filled || a.items.length < b.items.length) {
        const cells = quiz.blueprintCells(bp, roots.length);
        const groupOf = new Map();
        bp.qtypeGroups.forEach((g, i) => g.types.forEach((t) => groupOf.set(t, i)));
        const count = (qs, r, g) => qs.filter((q) => q.syllabus[0] === roots[r] && groupOf.get(q.qtype) === g).length;
        const short = [];
        roots.forEach((root, r) => bp.qtypeGroups.forEach((g, gi) => {
          const need = cells[r][gi];
          const na = count(active, r, gi);
          if (na < need && count(all, r, gi) > na) short.push(`${root}・${g.types.join('/')}（要る ${need}・引退を除くと ${na}）`);
        }));
        warn(path.join(appDir, 'config.json'), app, `EXAM: 引退した問題を除くと、模試の決まった配分を満たせない（補う問題 ${b.filled}→${a.filled}問・模試 ${b.items.length}→${a.items.length}問）。足りない枠: ${short.join('／') || '（枠ごとには足りるが全体で足りない）'}。引退の前に、同じ領域・同じ型の問題を足す`);
      }
    }
    return lines;
  }

  return { check, summary, checkExam };
}

module.exports = { makeFreshnessChecker, takeTodayArg, thisMonth, isMonth };
