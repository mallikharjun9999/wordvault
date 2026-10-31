# Data model, normalization, languages

## Collections (Mongoose) & indexes
| Collection | Key fields | Indexes |
|---|---|---|
| `users` | email (normalized), passwordHash (hidden), role=`user` (immutable enum), tokenVersion, preferences{explanationLanguage(default `te`), theme, timezone, dailyReviewLimit} | unique `email` |
| `vocabularies` | ownerId, word, **normalizedWord**, meanings[] (POS, simple/detailed English, Telugu meaning/explanation, examples[{en,te,context}]), synonyms/antonyms/collocations/phrases/sentencePatterns/usageSituations/commonMistakes/exercises, tags, categories, favorite, notes, source(`manual`\|`ai`), generation meta, learningStatus, progress counters, **srs** state | **unique `{ownerId:1, normalizedWord:1}`**; `{ownerId,createdAt:-1}`; `{ownerId,srs.dueAt}`; `{ownerId,favorite,createdAt}`; `{ownerId,learningStatus}`; `{ownerId,categories}`; `{ownerId,tags}`; `{ownerId,srs.lapses}` |
| `translations` (**legacy, read-only**) | ownerId, vocabularyId, language (plain string; may be a code the app no longer supports), meanings[] aligned by index, origin(`generated\|manual\|edited`), reviewed, generation meta | unique `{ownerId,vocabularyId,language}`; `{ownerId,language}` |
| `reviewlogs` | ownerId, vocabularyId, requestId, rating, reviewedAt, previous{…}, next{…} | unique `{ownerId,requestId}` (idempotency); `{ownerId,reviewedAt}`; `{ownerId,vocabularyId,reviewedAt}` |
| `quizattempts` | ownerId, questions[] (options, server-only correct answer, user answer, correct), score, total, status | `{ownerId,createdAt}`; `{ownerId,status,completedAt}` |
| `sentences` | ownerId, vocabularyId, text, selfAssessment, confidence | `{ownerId,createdAt}`; `{ownerId,vocabularyId,createdAt}` |

Design choices: SRS state is embedded in the vocabulary doc (the due queue is the hot query and needs no join); history is a separate append-only collection. The `translations` collection is a legacy archive from when other languages existed: nothing writes to it any more, but it is never dropped or migrated, so earlier data stays in exports and is deleted with its word/account. Preferences are embedded in the user. Categories/tags are plain arrays (no separate collection — distinct values are queried via `facets`). `ownerId` is never returned by the API.
Indexes are created by `npm run db:init` / server start via `createIndexes()` — additive only, never dropped. `autoIndex` is off in production.
No transactions are used (standalone-MongoDB friendly): review = insert unique log → conditional update (optimistic `reviewCount` check) → remove the log if the update fails; account deletion = children first → verify → user last.

## Normalization (`server/src/utils/normalize.js`)
1. Unicode **NFC**; 2. trim + collapse inner whitespace; 3. lowercase. The display word keeps the user's capitalization (whitespace-cleaned). Accents, hyphens and apostrophes are kept, so `café`≠`cafe`, `don't`≠`dont`. Emails: NFKC + trim + lowercase.

## Languages
Only **English (`en`)** and **Telugu (`te`)** are supported. The server definition lives in `server/src/utils/languages.js` (`SUPPORTED_LANGUAGES`) and is the single source for the model enum and the request validator; the client mirrors it in `client/src/utils/languages.js`. Telugu lives in the main vocabulary entry. `preferences.explanationLanguage` is `en` (English only) or `te` (English + Telugu, the default).

Backward compatibility: accounts created while more languages existed may still store another code in `preferences.explanationLanguage`. Nothing is rewritten; the API reports such values as `te` when serialising the user (`toSupportedLanguage`). Legacy `translations` documents are likewise left untouched.
