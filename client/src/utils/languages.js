// WordVault supports English and Telugu only (mirrors server/src/utils/languages.js). Both are left-to-right.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
];
export const DEFAULT_LANGUAGE = 'te';
export const languageLabel = (l) => (l.native && l.native !== l.name ? `${l.name} — ${l.native}` : l.name);
// Old accounts may still carry a retired code (e.g. "hi"); treat anything unsupported as the default.
export const normalizeLanguage = (code) => (SUPPORTED_LANGUAGES.some((l) => l.code === code) ? code : DEFAULT_LANGUAGE);
export const POS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'idiom', 'phrasal verb', 'expression', 'other'];
export const CONTEXTS = ['general', 'everyday', 'professional', 'educational'];
export const STATUS_LABEL = { documented: 'Documented', recognized: 'Recognized', active: 'Active use', mastered: 'Mastered' };
export const fmtDate = (d, tz) => { try { return new Date(d).toLocaleDateString(undefined, { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };
export const fmtDateTime = (d, tz) => { try { return new Date(d).toLocaleString(undefined, { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; } };
export const newRequestId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`);
