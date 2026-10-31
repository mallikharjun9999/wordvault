# Learning system

## Spaced repetition (`server/src/services/srs.js`, unit-tested)
State: repetitions *r*, intervalDays *I*, easeFactor *EF* (start 2.5, floor 1.3), lapses. New words are due immediately. Intervals are clamped to **1–365 days**; due = review time + *I* days (UTC).
| Rating | Effect |
|---|---|
| **Again** | *r*=0, lapses+1, EF−0.20, *I*=0, due in **10 minutes** |
| **Hard** | EF−0.15, *r*+1, *I* = 1 day on first success else max(1, round(*I*×1.2)) |
| **Good** | *r*+1, *I* = 1 (r=1), 3 (r=2), else round(*I*×EF) |
| **Easy** | EF+0.15, *r*+1, *I* = 4 (r=1), 7 (r=2), else round(*I*×EF×1.3) |
Difficult word = lapses ≥ 2 or EF < 2.0. Each review is logged with previous/next state; a client `requestId` makes submissions idempotent (unique index + conditional update). In the UI an *Again* card returns later in the same session.

## Learning states (`services/status.js`) — highest satisfied wins
- **Documented** – entry saved.
- **Recognized** – you pressed “I recognize this word”, **or** ≥2 correct quiz answers with ≥60% accuracy on it, **or** a Good/Easy review. Opening or viewing never counts.
- **Active use** – at least one sentence you wrote and self-assessed as “used correctly”.
- **Mastered** – ≥5 consecutive successful reviews (*r*≥5), interval ≥21 days, last rating Good/Easy. Forgetting (*Again*) removes it.

## Quizzes
Generated only from your saved data. 8 types: meaning, fill-in-the-blank, correct sentence (needs a saved common mistake), synonym, antonym, situation→word, English→Telugu, Telugu→English. Types lacking data are skipped; if nothing can be built the API returns `NOT_ENOUGH_DATA` rather than inventing content. Options are de-duplicated case-insensitively and exactly one is correct; answers never leave the server until submission; submission is graded server-side exactly once.

## Progress & streaks
Everything on the dashboard is computed from stored records. **Streak** = consecutive calendar days (in your timezone) with ≥1 review, completed quiz, or written sentence; today may still be empty without breaking it. **Quiz accuracy** = correct ÷ questions across completed quizzes. 30-day charts count words created and reviews logged per local day.
