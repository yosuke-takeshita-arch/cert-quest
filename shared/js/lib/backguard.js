// スマホの「戻る」（ブラウザの戻る）の決まり。履歴（history）をさわるのは、このファイルだけ。
// 決まり（2026-10-15 先生決定 A・2026-11-10 の直し）:
//   1. 問題を解いている画面で「戻る」が押されたら「やめますか？」と聞く（app.guardBack）。やめないなら画面に残り、やめるなら一つ前の画面へ戻る
//   2. 見張っている画面を、画面の中のボタン（×・「戻る」・「ホームへ」）で出たら、その画面は履歴から消えたものとして扱う
//      （ホーム → 地図 → 章 → 問題 → × で章へ、のあとの「戻る」は 地図 → ホーム → アプリの前のページ）
//   3. 開けない画面（出す問題が無い #/play）から別の画面へ送り直すときは、履歴を足さずに置き換える（「戻る」で同じ所へ戻されない）
// 2026-11-10 までは、2 で見張りの履歴だけを置き換えていたので、下に #/play が残った。「戻る」で #/play に戻ると、出す問題が無いので
// ホームへ送り直され（履歴を1つ足す）、次の「戻る」でまた #/play へ…となり、「戻る」でアプリを抜けられなかった。
//
// しくみ:
//   ・見張り … 同じ URL の履歴を1つ足す（state.cqGuard）。「戻る」でそれが抜けたら（popstate）、足し直して画面に残り、答えを待つ
//   ・一つ下の画面 … 履歴の中身は読めないので、履歴に着くたびに「どの画面から来たか」を state.cqFrom に書いておく（読み込み直しても残る）。
//     最初の履歴は ''（アプリの前のページ。分からない、の意味）
//   ・ボタンで出る … 一つ下が行き先と同じなら、2つ戻るだけ。違うなら、1つ戻って（見張りを抜けて）その画面の履歴を行き先に置き換える
// 見ていないもの: 履歴を「進む」で先へ行った先に残る古い履歴（次に画面を進めたときに消える）

/** 2つの hash が同じ画面を指すか（%E3… と日本語のままの書き方の違いは同じとみなす）。 */
export function sameHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a === b) return true;
  const plain = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  return plain(a) === plain(b);
}

/** 履歴の state から「どの画面から来たか」を読む。書いていなければ null、分からない（最初の履歴）なら ''。 */
export function fromOf(state) {
  return state && typeof state === 'object' && typeof state.cqFrom === 'string' ? state.cqFrom : null;
}

/** 履歴の state が見張りのものか。 */
export function isGuard(state) {
  return !!(state && typeof state === 'object' && state.cqGuard);
}

/**
 * 画面を変えるとき、履歴をどう動かすか。
 * @param {{onGuard: boolean, drawing: boolean, from: string|null, target: string}} at
 *   onGuard … いま見張りの履歴の上にいる / drawing … 画面を描いている最中に呼ばれた（開けない画面からの送り直し）
 *   from … いまの画面の一つ下の画面（分からなければ null か ''） / target … 行き先
 * @returns {{back: number, then: 'push'|'replace'|'check'}}
 *   back … 先に戻る数 / then … push: 履歴を足す、replace: いまの履歴を行き先に置き換える、check: 戻った先が行き先のはず（違えば足す）
 */
export function leavePlan({ onGuard, drawing, from, target }) {
  const under = typeof from === 'string' && from !== '' && sameHash(from, target);
  if (onGuard) return under ? { back: 2, then: 'check' } : { back: 1, then: 'replace' };
  if (drawing) return under ? { back: 1, then: 'check' } : { back: 0, then: 'replace' };
  return { back: 0, then: 'push' };
}

/** 戻り終わるのを待つ長さ（ms）。これを過ぎても戻っていなければ、いまの履歴を行き先に置き換えて進む（ボタンが効かないままにしない） */
export const LEAVE_TIMEOUT_MS = 1500;

/**
 * 画面の行き来と「戻る」の見張り。
 * @param {Window} win
 * @param {{render: () => void}} opts render … 同じ画面をもう一度描く（行き先がいまの画面と同じとき）
 * @returns {{backGuard: {ask: () => (boolean|Promise<boolean>)}|null, drawing: boolean, go: (hash: string) => void, guardBack: (ask: () => (boolean|Promise<boolean>)) => void}}
 *   backGuard … 見張っている画面の { ask }。画面を描き直すたびに null に戻す（app.js の render）
 *   drawing … 画面を描いている最中か（app.js の render が立てる）
 */
export function createBackNav(win, opts) {
  const { history, location } = win;
  const render = opts.render;
  let onGuardEntry = isGuard(history.state); // いま見張りの履歴の上にいるか
  let lastHash = ''; // 一つ前にいた履歴の hash（新しい履歴に着いたとき「どこから来たか」として書く）
  let carry = null; // 置き換えた履歴に引き継ぐ { hash, from }（置き換えると state が消えるため）
  let skipPop = 0; // こちらから戻したときの popstate を数えて無視する
  let asking = null; // 答えを待っている見張り（小窓を2つ出さない）
  let leaving = null; // ボタンで出るために戻っている途中 { target, then, from, timer }

  // いまの履歴に「どこから来たか」を書く。もう書いてあれば（戻る・進むで着いた）そのまま
  function tagHere() {
    const here = location.hash;
    try {
      const st = history.state;
      if (carry && sameHash(carry.hash, here)) {
        history.replaceState({ cqFrom: carry.from }, '');
        onGuardEntry = false;
      } else if (fromOf(st) == null) {
        history.replaceState({ ...(st && typeof st === 'object' ? st : {}), cqFrom: sameHash(lastHash, here) ? '' : lastHash }, '');
      }
      onGuardEntry = isGuard(history.state); // hash が変わって着いた先に合わせ直す（popstate が来ないブラウザでもずれない）
    } catch (e) { /* 履歴に書けなくても画面は止めない（一つ下が分からない扱いになるだけ） */ }
    carry = null;
    lastHash = here;
  }

  // いまの履歴を行き先に置き換える（履歴は増えない）。from は置き換える前の履歴の「どこから来たか」
  function replaceTo(target, from) {
    carry = { hash: target, from: typeof from === 'string' ? from : '' };
    onGuardEntry = false;
    location.replace(location.pathname + location.search + target);
  }

  // 戻り終わった（または待ちきれなかった）ので、行き先へ進む
  function land() {
    const p = leaving;
    leaving = null;
    win.clearTimeout(p.timer);
    if (sameHash(location.hash, p.target)) {
      // 戻った先が行き先。hash が変わって着いたなら hashchange が描く。変わっていない（行き先が元の画面に変わった）ときだけ、ここで描く
      if (p.then !== 'check') render();
      return;
    }
    if (p.then === 'check') { location.hash = p.target; return; } // 一つ下が思っていた画面と違った。履歴を足して進む
    const here = fromOf(history.state);
    replaceTo(p.target, here != null ? here : p.from);
  }

  const nav = {
    backGuard: null,
    drawing: false,
    go(hash) {
      if (location.hash === hash) { render(); return; }
      if (leaving) { leaving.target = hash; return; } // 戻っている途中に行き先が変わったら、後のものへ進む
      const from = fromOf(history.state);
      const plan = leavePlan({ onGuard: onGuardEntry, drawing: nav.drawing, from, target: hash });
      if (!plan.back) {
        if (plan.then === 'replace') replaceTo(hash, from);
        else location.hash = hash;
        return;
      }
      nav.backGuard = null; // ここから先は見張らない（こちらから戻すので、聞き直さない）
      leaving = { target: hash, then: plan.then, from };
      leaving.timer = win.setTimeout(() => {
        if (!leaving) return;
        if (skipPop) skipPop--;
        leaving.then = 'replace';
        land();
      }, LEAVE_TIMEOUT_MS);
      skipPop++;
      history.go(-plan.back);
    },
    guardBack(ask) {
      nav.backGuard = { ask };
      if (onGuardEntry) return;
      if (fromOf(history.state) == null) tagHere();
      const from = fromOf(history.state);
      history.pushState({ cqGuard: true, cqFrom: from != null ? from : '' }, '', location.href);
      onGuardEntry = true;
    },
  };

  // 履歴に着くたびに「どこから来たか」を書く。app.js の hashchange（画面を描く）より先に動くよう、app.js はこの関数を先に呼ぶ
  win.addEventListener('hashchange', tagHere);
  // 見張りの履歴から戻った（URL は同じなので hashchange は来ない）。見張りを足し直して画面に残り、ask の答え（アプリの小窓）を待つ。
  // やめるなら、足し直した見張りと元の履歴の2つ分戻る。見張りが無ければ（結果の画面など）すぐもう一つ戻る
  win.addEventListener('popstate', () => {
    const was = onGuardEntry;
    onGuardEntry = isGuard(history.state);
    if (skipPop) {
      skipPop--;
      if (leaving) land();
      return;
    }
    if (!was || onGuardEntry) return;
    const g = nav.backGuard;
    if (!g) { skipPop++; history.back(); return; }
    const from = fromOf(history.state);
    history.pushState({ cqGuard: true, cqFrom: from != null ? from : '' }, '', location.href);
    onGuardEntry = true;
    if (asking === g) return;
    asking = g;
    Promise.resolve(g.ask()).then((leave) => {
      if (asking === g) asking = null;
      if (!leave || nav.backGuard !== g || !onGuardEntry) return;
      nav.backGuard = null;
      skipPop++;
      history.go(-2);
    });
  });
  tagHere(); // 開いたときの履歴
  return nav;
}
