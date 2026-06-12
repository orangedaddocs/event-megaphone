# Multi-Platform Event Import Done

As of June 4, 2026, Event Poster imports from four sources:

- Eventbrite
- Luma
- Meetup
- Satlantis

The app uses a single event URL field and detects the source automatically. Eventbrite, Luma, and Meetup attempt structured event import from JSON-LD, embedded app data, or reader text. Satlantis is treated as a partial import source: title, description, date text, and RSVP are expected; location, map URL, speaker, and hashtags remain manual edits when the public page does not expose them.

Verification points:

- `node --test 'test/*.test.mjs'`
- `node test/live-smoke.mjs <real-event-urls...>` for network smoke checks
- at least three local fixtures per provider in `test/fixtures/`
- `index.html` remains single-file, backend-free, build-free, and dependency-free
