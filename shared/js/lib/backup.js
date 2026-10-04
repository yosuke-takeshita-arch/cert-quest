// 学習記録の書き出し・読み込み（引き継ぎ）。純粋な処理だけ。ファイルの読み書きは画面側（views/backup.js）。
// ファイルには、このアプリの学習記録と設定だけを入れる。名前・メール・電話などは、もともと記録に無い。
import { defaultState, mergeState } from './progress.js';

export const BACKUP_KIND = 'cert-quest-backup';
/** 書き出しの形の版。形を変えたら上げる。読み込みは、これ以下の版を受け付ける。 */
export const BACKUP_VERSION = 1;
/** 読み込みを受け付けるファイルの大きさ（バイト）。普通の記録は数百KB以下。 */
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD'（端末の日付）。 */
function ymd(now) {
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

/** 書き出すファイル名。例: g-kentei-record-2026-10-04.json */
export function backupFileName(appId, now = new Date()) {
  const id = String(appId || 'app').replace(/[^a-z0-9-]/gi, '') || 'app';
  return id + '-record-' + ymd(now) + '.json';
}

/** 保存データのうち、このアプリが知っている項目だけを取り出す（知らない項目は書き出さない）。 */
function knownOnly(state) {
  const merged = mergeState(state);
  const out = {};
  for (const k of Object.keys(defaultState())) out[k] = merged[k];
  return out;
}

/** 書き出す中身（オブジェクト）。 */
export function buildBackup(appId, state, now = new Date()) {
  return {
    kind: BACKUP_KIND,
    app: String(appId),
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    state: knownOnly(state),
  };
}

/** 書き出す文字列。 */
export function serializeBackup(appId, state, now = new Date()) {
  return JSON.stringify(buildBackup(appId, state, now), null, 1);
}

export const BACKUP_REASONS = {
  broken: 'このファイルは読めませんでした。学習記録のファイルではないか、壊れています。',
  notBackup: 'このアプリの学習記録のファイルではありません。',
  otherApp: '別の資格の学習記録のファイルです。このアプリでは読み込めません。',
  newer: '新しい版のアプリで書き出されたファイルです。アプリを更新してから、もう一度お試しください。',
  tooBig: 'ファイルが大きすぎます。学習記録のファイルではありません。',
};

/**
 * 読み込むファイルの中身（文字列）を調べる。
 * 戻り値: { ok: true, state, exportedAt } または { ok: false, reason: 'broken'|'notBackup'|'otherApp'|'newer'|'tooBig' }
 * state は mergeState を通した、このアプリの形の保存データ。
 */
export function parseBackup(text, appId) {
  if (typeof text !== 'string') return { ok: false, reason: 'broken' };
  if (text.length > BACKUP_MAX_BYTES) return { ok: false, reason: 'tooBig' };
  let o;
  try {
    o = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: 'broken' };
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, reason: 'broken' };
  if (o.kind !== BACKUP_KIND) return { ok: false, reason: 'notBackup' };
  if (typeof o.app !== 'string' || !o.app) return { ok: false, reason: 'broken' };
  if (o.app !== appId) return { ok: false, reason: 'otherApp' };
  if (!Number.isInteger(o.version) || o.version < 1) return { ok: false, reason: 'broken' };
  if (o.version > BACKUP_VERSION) return { ok: false, reason: 'newer' };
  if (!o.state || typeof o.state !== 'object' || Array.isArray(o.state)) return { ok: false, reason: 'broken' };
  return { ok: true, state: knownOnly(o.state), exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : null };
}

/** 確認画面に出す、書き出し元の記録の要約（答えた問題数など）。 */
export function backupSummary(state) {
  const s = mergeState(state);
  return { answered: s.totals.answered, xp: s.xp, streakBest: s.streak.best, badges: Object.keys(s.badges).length };
}
