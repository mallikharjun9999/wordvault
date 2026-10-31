# WordVault REST API

Base: `/api`. JSON in/out. **Response shape:** success `{ "success": true, "data": …, "meta"?: … }`; error `{ "success": false, "error": { "code", "message", "details"? } }`.
**Auth:** HttpOnly cookie `wv_token` set by register/login. Every non-GET request must also send header `X-WordVault-Client: 1` (CSRF guard) and, if an `Origin` is present, it must be in `CLIENT_URL`. User identity is *only* taken from the cookie — never from body/params. 🔒 = requires login.
Common errors: 400 `VALIDATION_ERROR`/`INVALID_ID`/`INVALID_JSON` · 401 `UNAUTHORIZED` · 403 `FORBIDDEN` (CSRF) · 404 `NOT_FOUND` (also returned for other users' records) · 409 conflicts · 413 `PAYLOAD_TOO_LARGE` · 429 `RATE_LIMITED` · 503 `DATABASE_UNAVAILABLE`/`AI_NOT_CONFIGURED`.

## Health
`GET /health` → 200 `{status:"ok", db:{ok,latencyMs,database}}` or 503.

## Auth & account
| Method & path | Body | Notes |
|---|---|---|
| `POST /auth/register` | `{email, password(≥10, letters+digits), displayName?, timezone?}` | 201 `{user}` + cookie. 409 `EMAIL_TAKEN`. Unknown fields (e.g. `role`) → 400 |
| `POST /auth/login` | `{email, password}` | 200 `{user}`; 401 `INVALID_CREDENTIALS` (same message for unknown email) |
| `POST /auth/logout` | – | clears cookie |
| 🔒 `GET /auth/me` | – | `{user}` |
| 🔒 `PATCH /auth/me` | `{displayName?, explanationLanguage?, theme?, timezone?, dailyReviewLimit?}` | |
| 🔒 `POST /auth/change-password` | `{currentPassword, newPassword}` | revokes other sessions; re-issues this cookie |
| 🔒 `POST /auth/logout-everywhere` | – | |
| 🔒 `POST /auth/delete-account` | `{password, confirm:"DELETE"}` | deletes all owned data, verifies, then the user. 200 `{deleted:{vocabulary,translations,…}}` |

## Vocabulary 🔒
| | |
|---|---|
| `GET /vocabulary?q&category&tag&status&favorite&difficult&sort(newest\|oldest\|alpha\|due)&page&limit(≤100)` | `{items}` + `meta{page,limit,total,pages}` |
| `GET /vocabulary/facets` | `{categories, tags}` |
| `POST /vocabulary` | manual create (see schema in `validators/schemas.js`; `ownerId`, `learningStatus`, `srs` rejected). 409 `DUPLICATE_WORD` with `details.existingId` |
| `POST /vocabulary/generate` `{word}` | existing → **200** `{entry, existing:true}` and **no provider call**; new → **201**. Errors: 503 `AI_NOT_CONFIGURED`, 502 `PROVIDER_INVALID_JSON/INVALID_CONTENT/EMPTY/AUTH_FAILED/RATE_LIMITED/ERROR`, 504 `PROVIDER_TIMEOUT`. Nothing is saved on failure. Rate limit: `AI_GENERATIONS_PER_HOUR` per user |
| `GET/PATCH/DELETE /vocabulary/:id` | delete also removes translations, reviews, sentences |
| `POST /vocabulary/:id/recognize` `{recognized?}` | explicit "I recognize this" |

Example:
```http
POST /api/vocabulary  X-WordVault-Client: 1
{"word":"Candid","meanings":[{"partOfSpeech":"adjective","simpleExplanation":"Honest.","teluguMeaning":"నిష్కపటమైన","examples":[{"en":"A candid answer.","te":"నిష్కపటమైన సమాధానం.","context":"general"}]}]}
→ 201 {"success":true,"data":{"entry":{"id":"…","word":"Candid","normalizedWord":"candid","learningStatus":"documented",…}}}
```

## Languages 🔒
WordVault supports **English (`en`) and Telugu (`te`) only**. `GET /languages` → `{languages:[{code:"en",…},{code:"te",…}]}`. The only request field that carries a language is `explanationLanguage` on `PATCH /auth/me`; any value other than `en` or `te` is rejected with **400 `VALIDATION_ERROR`** (`details[0] = {path:"explanationLanguage", message:"Unsupported language. Supported languages: en, te."}`). Telugu is part of every vocabulary entry (`teluguMeaning`, `teluguExplanation`, `examples[].te`), so there are no per-language translation endpoints any more: the former `/vocabulary/:id/translations…` and `/languages/translations` routes now return 404, and `hasTranslation` is ignored.

## Learning 🔒
- `GET /reviews/queue` → due items (limit = user's `dailyReviewLimit`), `meta.dueTotal`.
- `POST /reviews {vocabularyId, rating: again|hard|good|easy, requestId(≥8 chars)}` → 201 `{review, entry}`; replaying the same `requestId` → 200 `duplicate:true`, no second record.
- `POST /quizzes {count≤20, types?}` → 201 quiz **without answers**; 422 `NOT_ENOUGH_DATA`. `POST /quizzes/:id/submit {answers:[{qid,optionId}]}` → graded quiz with `correctOptionId`, `explanation`, `correct`; 409 if already submitted. `GET /quizzes` history.
- `POST /sentences {vocabularyId,text,selfAssessment: correct|unsure|incorrect, confidence?1-5}`; `GET /sentences?vocabularyId=`; `DELETE /sentences/:id`.
- `GET /progress` → totals, due, reviews, quiz accuracy, streak, status counts, 30-day series, difficult words, recent activity.

## Export 🔒
`GET /export/vocabulary?format=json|csv|md` · `GET /export/account` (everything you own; no hashes/secrets). UTF-8; CSV has BOM; cells starting with `= + - @` are prefixed with `'`.
`GET /ai/status` → whether AI generation is configured (never exposes keys).
