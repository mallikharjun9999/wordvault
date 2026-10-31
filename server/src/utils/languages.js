// Single source of truth for the languages WordVault supports: English ("en") and Telugu ("te").
// Every language check in the server (validators, models, routes) derives from this file.
export const SUPPORTED_LANGUAGES = Object.freeze({
  ENGLISH: 'en',
  TELUGU: 'te',
});

export const LANGUAGE_CODES = Object.freeze(Object.values(SUPPORTED_LANGUAGES));
export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES.TELUGU;

export const LANGUAGES = Object.freeze([
  Object.freeze({ code: SUPPORTED_LANGUAGES.ENGLISH, name: 'English', native: 'English' }),
  Object.freeze({ code: SUPPORTED_LANGUAGES.TELUGU, name: 'Telugu', native: 'తెలుగు' }),
]);

export const isSupportedLanguage = (code) => LANGUAGE_CODES.includes(code);

/**
 * Read-time normalisation for values written before the app was narrowed to English + Telugu
 * (e.g. an old `explanationLanguage: "hi"`). The stored document is never rewritten; callers just
 * see a supported value instead.
 */
export const toSupportedLanguage = (code) => (isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE);

export default SUPPORTED_LANGUAGES;
