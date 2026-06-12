---
date: 2026-06-04
topic: multi-platform-event-import
---

# Multi-Platform Event Import + Self-Verifying Harness — Requirements

## Summary

Extend the existing single-file event poster so a user can paste **any** of four
event URLs — Luma, Meetup, Eventbrite, Satlantis — and the tool auto-detects the
source, fills the event form, and generates the existing 6-stage X + Nostr
campaign. Ship it with a self-verifying test harness: committed fixtures of real
Bitcoin events drive deterministic unit tests (the "done" gate), and a Playwright
live-smoke run hunts current Denver-area Bitcoin events to catch markup drift and
harvest new fixtures.

---

## Problem Frame

The tool today reliably imports **Luma** and **Meetup** only. A Bitcoin meetup
organizer running real events (e.g. the Denver scene) uses several platforms
depending on the event, and currently has to fall back to manual entry for
anything that isn't Luma/Meetup — which defeats the ~15-minute promise. The two
gaps that matter for this community are **Eventbrite** (broad public/ticketed
events) and **Satlantis** (the Bitcoin-native event platform).

The second cost is verification. Each new adapter is a parser against a live
site, and live event pages expire, sell out, get edited, and change markup
without notice. Hand-debugging "does it still import?" against whatever event
happens to be live is slow and never settles — there is no stable finish line.
The organizer wants an autonomous agent to build and *prove* this works without
becoming a manual QA loop.

---

## Key Decisions

- **One tool, four URL types — not a second tool.** The earlier idea of a
  separate Nostr-native sibling is dropped. Investigation confirmed Satlantis
  deliberately does **not** publish events to Nostr (NIP-52); its events live in
  a proprietary backend. So Satlantis is just a fourth web URL, and there is no
  Nostr `naddr` ingestion path to build. See Sources.

- **Auto-detect on paste replaces the manual provider selector.** The current
  "Choose Meetup / Choose Luma" buttons go away. One URL field; the tool
  identifies the source from the URL. This is what "just paste it and it works"
  requires.

- **Satlantis import is partial by design.** Only title, date/time, and
  description are reachable from a pure client-side fetch (the page's `og:` meta
  tags). Venue, map/geo, and speaker are JavaScript-rendered and unreachable
  without a backend — which the no-backend constraint forbids. The user adds
  those fields manually, prompted by a visible cue.

- **Two-layer verification.** Deterministic fixture tests are the only "done"
  signal; the live Playwright run is a drift detector and fixture harvester, never
  a pass/fail gate. This keeps the loop's finish line reproducible despite
  non-deterministic live data.

- **Reuse the post engine unchanged.** Tones, styles, the 6 stages, the map
  line, speaker `@handle`/`nostr:npub` rendering, and hashtags already exist and
  already work. This project adds *importers and tests*, not post-generation
  features.

---

## Requirements

### Import & detection

- R1. Pasting a URL from any supported platform auto-detects the provider from
  the URL (host/path) and runs the matching adapter. No manual provider
  selection step.
- R2. An unrecognized or unreachable URL produces a clear, non-silent message and
  exposes the existing paste-text/HTML fallback so the user can still import by
  pasting page source.
- R3. The robustness chain is preserved for every adapter: structured-data-first
  (JSON-LD / `og:` tags) → CORS-proxy + reader fallback → manual paste-text
  fallback. Import is deterministic given the same input.
- R4. Import never overwrites a field the user has already typed without the
  existing regenerate-style heads-up; failed/partial imports leave the form
  usable rather than erroring out.

### Platform adapters

- R5. Luma and Meetup imports continue to work exactly as today, protected by
  fixtures so the new adapters can't regress them.
- R6. Eventbrite adapter: detect Eventbrite event URLs and extract title,
  `date_iso` + IANA `tz`, `date_display`, location/address, `map_url` (when geo
  is present), description, and RSVP URL from the page's structured data, with
  reader and paste-text fallback.
- R7. Satlantis adapter: detect `satlantis.io/events/...` URLs and extract title,
  date/time, and description from `og:` meta tags. Venue, map, and speaker are
  not auto-filled.
- R8. Partial-import cue: after any import, a visible notice states which fields
  were filled automatically and which still need manual entry — required for
  Satlantis so users don't post events missing venue/map.
- R9. Imported event data feeds the existing post engine unchanged: tones,
  styles, 6 stages, the `Map:` line, speaker handle/npub rendering, and
  user-entered hashtags all apply with no new post-generation work.

### Verification harness

- R10. Committed fixtures: at least 3 real saved Bitcoin-event snapshots per
  platform (12+ total), chosen to vary the hard cases — with/without a named
  venue, with/without geo, with/without a speaker, and at least one non-Mountain
  timezone.
- R11. Adapter unit tests run each fixture through its adapter and assert the
  required-field contract (see Acceptance Examples), integrated into the existing
  `node --test` suite so `node --test 'test/*.test.mjs'` is the single green gate.
- R12. Playwright live-smoke script: for each platform, find current Denver-area
  Bitcoin events, import each, and emit a field-by-field report (filled / missing
  / mismatched) plus saved page snapshots as candidate fixtures. This run is
  non-gating and tolerant of zero results for a platform.
- R13. The Definition of Done predicate (see Success Criteria) is written into
  the repo so an autonomous agent has an unambiguous, checkable finish line.

---

## Key Flows

- F1. Paste-and-import
  - **Trigger:** User pastes an event URL into the single import field.
  - **Steps:** Detect provider from URL → run adapter (structured-data →
    reader → paste-text fallback) → populate form fields → show partial-import
    cue listing auto-filled vs. manual fields → user fills any gaps → Generate.
  - **Covered by:** R1, R2, R3, R6, R7, R8, R9

- F2. Autonomous build + verify loop (RALF)
  - **Trigger:** Agent is tasked to build/extend an adapter.
  - **Steps:** Implement or fix adapter → run `node --test 'test/*.test.mjs'`
    (deterministic gate) → if green, run the Playwright live-smoke to detect
    drift and harvest fixtures → fold any new/failed real events into committed
    fixtures + tests → repeat until the Done predicate holds.
  - **Outcome:** Loop exits only when the Done predicate is satisfied — not on
    "looks right against a live page."
  - **Covered by:** R10, R11, R12, R13

---

## Acceptance Examples

The required-field contract is what "imported correctly" means and is the
backbone of both fixture tests and the live smoke report.

- AE1. Full-data platforms (Luma, Meetup, Eventbrite)
  - **Given:** a committed fixture for a real Bitcoin event with a physical venue
    and geo.
  - **When:** run through its adapter.
  - **Then:** title, `date_iso` + `tz`, `date_display`, location/address,
    `map_url`, description, and RSVP URL are all extracted and non-empty; no page
    chrome (navigation, "Attendees", broken `[](` markdown) leaks into any field.
  - **Covers R5, R6.**

- AE2. Eventbrite timezone correctness
  - **Given:** a fixture event in a non-Mountain timezone.
  - **When:** imported and rendered.
  - **Then:** the Live-stage post shows local + ET + PT conversions, deduped and
    DST-correct, matching the event's real zone (never hardcoded).
  - **Covers R6.**

- AE3. Satlantis partial import
  - **Given:** a Satlantis event fixture.
  - **When:** run through the adapter.
  - **Then:** title, date/time, and description are filled; venue, map, and
    speaker are empty; the partial-import cue names venue and map as manual
    to-dos.
  - **Covers R7, R8.**

- AE4. Unknown / unreachable URL
  - **Given:** a URL from no supported platform, or a supported URL that fails to
    fetch.
  - **When:** the user attempts import.
  - **Then:** a clear message appears and the paste-text fallback is offered; the
    form stays usable.
  - **Covers R2.**

- AE5. No regression
  - **Given:** the pre-existing Luma and Meetup fixtures.
  - **When:** the full suite runs after the new adapters land.
  - **Then:** all prior assertions still pass.
  - **Covers R5.**

---

## Success Criteria — Definition of Done (RALF termination predicate)

The autonomous loop is **done** when **all** of the following hold:

1. `node --test 'test/*.test.mjs'` is green.
2. Each of the four platforms has ≥3 committed fixtures, and every fixture
   satisfies its required-field contract (AE1 / AE3) under its adapter's tests.
3. The Eventbrite and Satlantis adapters exist, are wired into URL auto-detection
   (R1), and degrade through the fallback chain (R3) rather than throwing.
4. The partial-import cue (R8) renders for a Satlantis import in a fixture-driven
   test.
5. A single live-smoke run completed and produced a field-by-field report; for
   each platform where ≥1 current event was found, the required fields were
   extracted. (A platform with zero current events does not block — but is
   reported, not silently skipped.)
6. No new dependency, build step, or backend was added; `index.html` stays within
   its size budget; the neutrality grep still returns no matches.

Anything short of all six is "keep looping," and the unmet item names the next
action.

---

## Scope Boundaries

### Deferred for later
- Live-smoke as a scheduled/CI job — v1 is an on-demand script an agent or human
  runs.
- Auto-resolving Satlantis venue/geo via a headless render — only viable with a
  backend; revisit if the no-backend constraint ever relaxes.
- Additional platforms (Splash, Partiful) — low Bitcoin-community usage and poor
  client-side data.

### Outside this product's identity
- A separate Nostr-native / NIP-52 / `naddr` import tool — Satlantis isn't on
  Nostr for events, and the user chose one paste-a-URL tool over two tools.
- Any backend, build step, API key, or framework dependency.

---

## Dependencies / Assumptions

- **Eventbrite exposes parseable structured data (JSON-LD `Event`) on event
  pages.** Assumed from common Eventbrite behavior; the first Eventbrite fixture
  verifies it. If JSON-LD is absent/blocked, the reader + paste-text fallback is
  the floor.
- **Satlantis keeps title/date in `og:title` and the description in
  `og:description`, server-rendered.** Verified on live pages during research
  (see Sources); proprietary and could change — exactly what the live-smoke
  drift detector exists to catch.
- **CORS proxies / reader fallback remain available** for client-side fetches of
  Eventbrite and Satlantis, as already relied on for Luma/Meetup.
- **Playwright is available to the verifying agent** (present as tooling in this
  environment); it powers live-smoke only and is not a repo runtime dependency.

---

## Sources / Research

- Satlantis architecture — CEO post "As Nostr As Possible" (blog.satlantis.io):
  events are stored in Satlantis's own backend, **not** as Nostr NIP-52 kinds;
  Nostr is used for identity/social graph only. Basis for the "one web tool, no
  Nostr path" decision.
- Live Satlantis event pages confirm URL pattern `satlantis.io/events/{id}/{slug}`
  and that `og:title` (title + date/time) and `og:description` (full description)
  are server-rendered; venue/geo require JS. No public events REST API found.
- NIP-52 (kinds 31922/31923) and Flockstr are the real Nostr-native calendar
  path — explicitly out of scope here, recorded in case a future Nostr tool is
  revisited.
- Existing engine + tests: `test/engine.test.mjs`, `test/load-engine.mjs`
  (50 tests via `node --test`); adapters/detection live in `index.html`
  (`detectEventProvider`, `normalize*Url`, `parseJsonLdEvent`, reader/paste
  fallbacks). New adapters extend these patterns.
- `BUILD_SPEC.md` — hard constraints (single file, no backend/build/deps, size
  and neutrality budgets) that bound every requirement above.
