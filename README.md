# Janki — Japanese SRS

Janki is a local-first Japanese spaced-repetition web app with an original
classic SM-2-style scheduler, responsive mobile UI, offline PWA support, and
portable JSON backups. It uses no Anki source code, branding, or proprietary
assets.

## What is implemented

- New → learning → review → relearning states
- Again / Hard / Good / Easy scheduling with configurable learning steps
- Ease-factor changes, interval modifiers, easy bonus, hard factor and caps
- Interval fuzz with deterministic previews and injectable randomness in tests
- Lapses, relearning, leech tagging and optional automatic suspension
- Daily new/review limits enforced from the review log across sessions
- Learning-card priority and configurable learn-ahead
- Device-local day rollover (default 4 AM) with DST-aware local Date behavior
- Starter Japanese decks plus custom cards
- Add and edit cards, tags, search, suspend/unsuspend
- Japanese speech synthesis
- Keyboard study controls: Space to reveal, 1–4 to grade
- Statistics and answer distribution
- JSON export/import with validation and normalization
- Legacy v3/v4 migration into the v5 collection format
- Offline service worker with stale-cache cleanup and network fallback
- Responsive iPhone-first layout and safe-area-aware navigation

## Architecture

The project deliberately keeps pure domain logic outside the DOM layer:

```text
app.js       UI, navigation, study flow, import/export
scheduler.js Scheduling state machine and interval math
queue.js     Daily limits and study queue selection
storage.js   Persistence, migration, backup validation
 data.js     Seed content
 tests/      Scheduler, queue, timezone and persistence tests
```

This separation makes the scheduling engine and persistence layer testable in
Node without a browser.

## Test and syntax checks

Requires Node 22+.

```bash
npm test
npm run check
```

The test suite covers scheduling transitions, ease/lapses/leeches, interval
fuzzing and caps, local/UTC day cutoffs, queue priority, daily limits,
suspension, learn-ahead, backup validation, migration, and persistence.

## Run locally

Serve the directory over HTTP(S):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Service workers require a secure context in
production (HTTPS; localhost is allowed for development).

## iPhone

Deploy the folder to an HTTPS host, open it in Safari, then use **Share → Add
to Home Screen**. Janki stores the collection in the browser's local storage;
use **Export backup** before clearing browser data or changing devices.

## Scheduling scope

The scheduler intentionally targets the documented classic/SM-2 behavior,
not modern FSRS. It is not a claim of byte-for-byte parity with Anki. Major
features outside this scope include FSRS, sync, filtered decks, custom note
types/templates, parent-deck limit inheritance, image occlusion, and full
undo history.
