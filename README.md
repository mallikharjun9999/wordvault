# WordVault

A local-first, Telugu-first vocabulary learning app: save English words with rich entries, review them with spaced repetition, take quizzes built from your own words, and track real progress. React + Vite + Tailwind frontend, Express + Mongoose backend, **MongoDB only**.

> **Status:** built and tested locally. **Nothing has been deployed.** See [Verification status](#verification-status) for exactly what was and wasn't tested.

## Features
Accounts (all users have the same `user` role; no admin) · vocabulary CRUD with 30+ structured fields and multiple meanings · AI generation (optional, provider-agnostic) · Telugu built into every entry (English and Telugu are the only supported languages) · duplicate prevention (per-user unique index) · SM-2-style spaced repetition (Again/Hard/Good/Easy) · 8 quiz question types graded server-side · sentence practice with honest self-assessment · learning states (documented → recognized → active → mastered) · dashboard/progress from real records · JSON/CSV/Markdown export · print view · dark mode · account export & deletion.

## Requirements
| Tool | Version |
|---|---|
| Node.js | **22.9+** (developed on 22.22) - the scripts use `node --env-file-if-exists` |
| npm | 10+ |
| MongoDB | 6.0+ (developed/tested on 8.0.23) |
| MongoDB Database Tools | only for backup/restore scripts |

RAM: the whole stack (Node API + Vite dev server + `mongod` with a small cache) fits comfortably in an 8 GB laptop. Setting `--wiredTigerCacheSizeGB 0.5` keeps MongoDB lean.

## 1. MongoDB setup (Fedora)

> I could not test on Fedora (my sandbox was Ubuntu), so the Fedora steps below are **unverified** — check the current MongoDB docs if a step fails. MongoDB does not officially support Fedora; the supported route is the RHEL-compatible repo.

**Option A — native install (RHEL 9-compatible repo)**
```bash
sudo tee /etc/yum.repos.d/mongodb-org-8.0.repo <<'REPO'
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/8.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
REPO
sudo dnf install -y mongodb-org          # server, mongosh, database tools
sudo systemctl start mongod              # start
sudo systemctl enable mongod             # optional: start at boot
sudo systemctl status mongod             # verify
mongosh --eval 'db.runCommand({ping:1})' # verify connectivity -> { ok: 1 }
```
Stop: `sudo systemctl stop mongod` · Logs: `sudo journalctl -u mongod` or `/var/log/mongodb/mongod.log`.
If `mongod` won't start on Fedora (OpenSSL/library or SELinux errors), use Option B or C.

**Option B — Podman container (optional, not required by the app)**
```bash
podman run -d --name wordvault-mongo -p 127.0.0.1:27017:27017 -v wordvault-data:/data/db docker.io/library/mongo:8 --wiredTigerCacheSizeGB 0.5
podman stop wordvault-mongo   # stop;  podman start wordvault-mongo  # start again
```
**Option C — MongoDB Atlas (remote):** put the `mongodb+srv://…` string in `MONGODB_URI`. Note the app is then *not* fully local.

**Troubleshooting:** `ECONNREFUSED 127.0.0.1:27017` → mongod isn't running (`systemctl status mongod`). `Authentication failed` → URI credentials/`authSource`. Atlas timeouts → add your IP to the Atlas network access list. The API prints the (credential-masked) URI and exits with a clear message if it can't connect.

## 2. Install & configure
```bash
git clone <your-repo> wordvault && cd wordvault   # or unpack the folder
npm install                      # installs root, server and client (npm workspaces)
cp .env.example .env
# set a real JWT_SECRET (>=32 chars):
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")|" .env
npm run db:check                 # verifies MongoDB connectivity
npm run db:init                  # creates indexes (safe to rerun; never drops anything)
```
### Environment variables (all in `.env`; see `.env.example`)
| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT`, `CLIENT_URL` | mode, API port (5000), **exact** allowed browser origin(s) for CORS/CSRF |
| `MONGODB_URI` | dev/prod database. `MONGODB_URI_TEST` is used by tests only; its DB name **must end in `_test`** or tests refuse to run |
| `JWT_SECRET` | required, ≥32 chars. `SESSION_DAYS`, `BCRYPT_ROUNDS` (10–15, default 12), `COOKIE_SECURE` (true under HTTPS) |
| `AI_PROVIDER` (`anthropic` \| `openai`), `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_MS` | optional AI generation. `openai` = any OpenAI-compatible chat endpoint (OpenAI, Gemini-compat, Groq, local Ollama at `http://127.0.0.1:11434/v1` with no key) |
| `AI_GENERATIONS_PER_HOUR` | per-user cap on AI calls (cost control; default 20) |
| `TRUST_PROXY` | set (e.g. `1`) when behind a reverse proxy so rate-limits see real IPs |

**No AI key is needed to run the app.** Without one, generation returns a clear `AI_NOT_CONFIGURED` message and everything else (manual entries, editing, review, quizzes, progress, export) works. There is no fake "test-mode" AI: nothing is ever presented as AI output unless a real provider produced it.

## 3. Run
```bash
npm run dev            # API on :5000 + Vite on :5173 (one terminal)
# or two terminals:
npm run dev:server
npm run dev:client
```
Open http://localhost:5173 and register. Stop with Ctrl-C.
Optional dev data: `npm run db:seed` creates `demo@wordvault.local` / `demo-password-123` with 3 hand-written entries (refuses to run in production, never touches real accounts).

## 4. Test & build
```bash
npm test               # server (Vitest+Supertest, real MongoDB `wordvault_test`) then client (Vitest+RTL)
npm run test:server
npm run test:client
npm run build          # production frontend -> client/dist
```
Tests need a running MongoDB. They only ever clean the `*_test` database.

## 5. Backup & restore
```bash
scripts/backup.sh                                   # -> backups/wordvault-<timestamp>.archive.gz (gzip archive via mongodump)
scripts/restore.sh backups/<file>.archive.gz        # non-destructive merge (skips existing _ids)
scripts/restore.sh backups/<file>.archive.gz --drop # full replace, asks you to type YES
npm run db:init                                     # re-ensure indexes afterwards
```
`backups/` is git-ignored. Users can also self-export from **Settings → Data & account**.

## Project layout
`server/src/{config,middleware,models,routes,services,validators,utils}` · `server/tests` · `server/scripts` · `client/src/{api,components,contexts,hooks,layouts,pages,routes,utils}` · `client/tests` · `docs/`.
Docs: [API](docs/API.md) · [Data model, normalization & languages](docs/DATA_MODEL.md) · [Learning algorithms](docs/LEARNING.md) · [Deployment readiness](docs/DEPLOYMENT.md).

## Security design (summary)
bcrypt hashes · JWT in an **HttpOnly, SameSite=Lax** cookie (token never visible to JS; `Secure` in production) with a `tokenVersion` so password change / "log out everywhere" revokes sessions · CSRF: custom `X-WordVault-Client` header required on writes + `Origin` allow-list + strict CORS (no `*`) · ownership derived only from the verified cookie, every query scoped by `ownerId` · strict zod schemas (unknown fields rejected → no mass assignment, no operator injection) · rate limits (global, auth, per-user AI) · 100 KB body limit · helmet · masked 500s/DB errors · CSV formula-injection guard · no secrets in logs.

## Known limitations
- AI generation is **untested against any real provider** (no key in my environment); only injected fake providers were used. Telugu in generated entries is machine-written — review it.
- Quiz feedback (correct answer + explanation) is shown when you submit the quiz, not after each question.
- Sentence practice is self-assessed; there is no automatic grading.
- Search uses escaped regex over personal-sized collections (no full-text index; fine for thousands of words, not millions).
- No PWA/offline mode. No email verification or password reset (needs an email service).
- Account-deletion is multi-step without a transaction (standalone MongoDB); it deletes children first, verifies zero remain, then deletes the user, so a failure leaves a retry-able account.
- Dates are UTC in the DB; streaks/charts use each user's timezone.

## Verification status
See the table at the end of the final report in the build conversation; summary: server 71/71 and client 17/17 automated tests pass; production build succeeds; backup→drop→restore round-trip verified on MongoDB 8.0.23. **Not verified:** Fedora-specific install steps, real AI providers, real-browser responsive layouts (no browser available in the build sandbox), keyboard/screen-reader behaviour beyond semantic markup, `npm run dev` under Fedora.
