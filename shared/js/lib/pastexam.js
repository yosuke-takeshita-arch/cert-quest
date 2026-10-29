// 過去問題の出典（問題データの任意の欄 pastExam。要件定義書 §7・§12）。純粋な関数だけ。
// IPA の「よくある質問」は、過去問題を問題集などに使うとき、年度・期・試験区分・時間区分・問番号を明記し、
// 改変したら改変したことを明記するよう求めている（https://www.ipa.go.jp/shiken/faq.html 。著作権は放棄されていない）。
// 期の名前（春期・秋期・10月 など）は年度によって違うので、計算せずデータの文字をそのまま出す。

/** 問番号の範囲。科目A-2 は午前Ⅱの25問と同じ形（要件定義書 §12） */
export const PAST_EXAM_NO_MAX = 25;

const text = (v) => typeof v === 'string' && v.trim() !== '' && !/[\r\n]/.test(v);

/** 欄の形が正しければ整えた値、崩れていれば null（問題そのものは捨てず、出典の行だけ出さない） */
export function normalizePastExam(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  if (!text(x.year) || !text(x.period) || !text(x.exam) || !text(x.part)) return null;
  if (!Number.isInteger(x.no) || x.no < 1 || x.no > PAST_EXAM_NO_MAX) return null;
  if (typeof x.modified !== 'boolean') return null;
  return { year: x.year.trim(), period: x.period.trim(), exam: x.exam.trim(), part: x.part.trim(), no: x.no, modified: x.modified };
}

/** 画面に出す1行。例: 出典：令和7年度 秋期 情報処理安全確保支援士試験 午前Ⅱ 問1　／改変があれば末尾に（一部改変）。無ければ空文字 */
export function pastExamCitation(pe) {
  const p = normalizePastExam(pe);
  if (!p) return '';
  return '出典：' + [p.year, p.period, p.exam, p.part, '問' + p.no].join(' ') + (p.modified ? '（一部改変）' : '');
}
