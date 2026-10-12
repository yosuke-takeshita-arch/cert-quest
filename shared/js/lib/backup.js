// 学習記録の書き出し・読み込み（引き継ぎ）。純粋な処理だけ。ファイルの読み書きは画面側（views/backup.js）。
// ファイルには、このアプリの学習記録と設定だけを入れる。名前・メール・電話などは、もともと記録に無い。
import { defaultState, mergeState } from './progress.js';
import { COMMON_KEYS, joinState, subjectKeys } from './subjects.js';

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
  layout: 'このアプリの形の学習記録のファイルではありません（科目別の記録かどうかが合っていません）。',
};

/**
 * 読み込むファイルの中身（文字列）を調べる。
 * 戻り値: { ok: true, state, exportedAt } または { ok: false, reason: 'broken'|'notBackup'|'otherApp'|'newer'|'tooBig' }
 * state は mergeState を通した、このアプリの形の保存データ。
 */
function parseBackupHeader(text, appId) {
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
  return { ok: true, o };
}

export function parseBackup(text, appId) {
  const head = parseBackupHeader(text, appId);
  if (!head.ok) return head;
  const o = head.o;
  if (o.layout === BACKUP_LAYOUT_SUBJECTS) return { ok: false, reason: 'layout' };
  if (!o.state || typeof o.state !== 'object' || Array.isArray(o.state)) return { ok: false, reason: 'broken' };
  return { ok: true, state: knownOnly(o.state), exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : null };
}

// ---- 科目のあるアプリ（中小企業診断士など）の書き出し ----
// 科目ごとの記録が別々に保存されているので、ファイルには「共通の記録」と「科目ごとの記録」を全部入れる
// （1科目分だけだと、読み込んだとき他の科目の記録が失われる）。印は layout: 'subjects'。
// 科目の無いアプリのファイル（state が1つ）とは形が違うので、お互いには読み込めない。

export const BACKUP_LAYOUT_SUBJECTS = 'subjects';

const SUBJECT_ID_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 共通の部分と科目の部分に分けて、知っている項目だけにする。 */
function knownCommon(common) {
  const out = {};
  const merged = mergeState(joinState(common, null));
  for (const k of COMMON_KEYS) out[k] = merged[k];
  return out;
}
function knownSubject(part) {
  const merged = joinState(null, part);
  const out = {};
  for (const k of subjectKeys()) out[k] = merged[k];
  return out;
}

/** 書き出す中身（科目あり）。data は createSubjectStore の exportAll() の戻り値 { common, subjects }。 */
export function buildSubjectsBackup(appId, data, now = new Date()) {
  const subjects = {};
  for (const [id, part] of Object.entries((data && data.subjects) || {})) if (SUBJECT_ID_OK.test(id)) subjects[id] = knownSubject(part);
  return {
    kind: BACKUP_KIND,
    app: String(appId),
    version: BACKUP_VERSION,
    layout: BACKUP_LAYOUT_SUBJECTS,
    exportedAt: now.toISOString(),
    common: knownCommon(data && data.common),
    subjects,
  };
}

export function serializeSubjectsBackup(appId, data, now = new Date()) {
  return JSON.stringify(buildSubjectsBackup(appId, data, now), null, 1);
}

/**
 * 科目ありのファイルを調べる。戻り値は parseBackup と同じ形で、ok のとき { ok, common, subjects, exportedAt }。
 * 科目なしのファイル（state が1つ）は reason: 'layout'。
 */
export function parseSubjectsBackup(text, appId) {
  const base = parseBackupHeader(text, appId);
  if (!base.ok) return base;
  const o = base.o;
  if (o.layout !== BACKUP_LAYOUT_SUBJECTS) return { ok: false, reason: 'layout' };
  if (!o.common || typeof o.common !== 'object' || Array.isArray(o.common)) return { ok: false, reason: 'broken' };
  if (!o.subjects || typeof o.subjects !== 'object' || Array.isArray(o.subjects)) return { ok: false, reason: 'broken' };
  const subjects = {};
  for (const [id, part] of Object.entries(o.subjects)) {
    if (!SUBJECT_ID_OK.test(id) || !part || typeof part !== 'object' || Array.isArray(part)) continue;
    subjects[id] = knownSubject(part);
  }
  return { ok: true, common: knownCommon(o.common), subjects, exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : null };
}

/** 確認画面に出す、科目ありのファイルの要約（全科目の合計）。 */
export function subjectsBackupSummary(parsed) {
  let answered = 0;
  for (const part of Object.values(parsed.subjects || {})) answered += (part.totals && part.totals.answered) || 0;
  return { answered, xp: parsed.common && Number.isFinite(parsed.common.xp) ? parsed.common.xp : 0, subjects: Object.keys(parsed.subjects || {}).length };
}

/** 確認画面に出す、書き出し元の記録の要約（答えた問題数など）。 */
export function backupSummary(state) {
  const s = mergeState(state);
  return { answered: s.totals.answered, xp: s.xp, streakBest: s.streak.best, badges: Object.keys(s.badges).length };
}
