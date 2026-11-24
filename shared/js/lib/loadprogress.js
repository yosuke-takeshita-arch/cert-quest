// 読み込みの進み具合（タイトル画面のゲージ用）。ブラウザは使わない。
// loadData の fetchFn を包んで、「何個中何個終わったか」を数える。最初の呼び出しが index.json で、
// それが読めたら全部の個数（index + syllabus + questions + concepts）が分かる。分かるまでは割合0。

/** index.json の中身から、読むファイルの総数（index.json 自身を含む）。読めない形なら1。 */
export function countDataFiles(indexJson) {
  if (!indexJson || typeof indexJson !== 'object') return 1;
  const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').length : 0);
  return 1 + (typeof indexJson.syllabus === 'string' ? 1 : 0) + strs(indexJson.questions) + strs(indexJson.concepts);
}

/** 割合(0〜1)。総数が分からない・0以下のときは0。範囲外は丸める。 */
export function fraction(done, total) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(done) || done <= 0) return 0;
  return Math.min(1, done / total);
}

/**
 * onChange({ done, total, fraction }) を、進むたびに呼ぶ。
 * wrap(fetchFn) が返す関数を loadData に渡す。失敗（404・通信エラー）も「終わった」と数える（失敗でゲージが止まらないように）。
 */
export function createLoadTracker(onChange) {
  const s = { done: 0, total: null, fraction: 0 };
  let calls = 0;
  const emit = () => {
    s.fraction = fraction(s.done, s.total);
    if (onChange) onChange({ done: s.done, total: s.total, fraction: s.fraction });
  };
  return {
    state: () => ({ done: s.done, total: s.total, fraction: s.fraction }),
    /** 最後に呼ぶ。数え間違い・読み込み失敗があっても、ゲージを満たす。 */
    complete() {
      if (s.total == null) s.total = Math.max(s.done, 1);
      s.done = s.total;
      emit();
    },
    wrap(fetchFn) {
      return async (url) => {
        const isIndex = calls++ === 0;
        let res;
        try {
          res = await fetchFn(url);
        } catch (e) {
          s.done += 1;
          if (isIndex) s.total = 1;
          emit();
          throw e;
        }
        if (isIndex) {
          let n = 1;
          if (res && res.ok) {
            try { n = countDataFiles(await res.clone().json()); } catch (e) { n = 1; }
          }
          s.total = n;
        }
        s.done += 1;
        emit();
        return res;
      };
    },
  };
}
