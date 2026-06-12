# Handoff — Event Megaphone (formerly Event Poster)

Last updated: 2026-06-11

## What this is

A free, single-file (`index.html`), no-backend tool: paste a **Luma, Meetup, or
Satlantis** event URL → auto-detect provider → fill form → generate a 6-stage
Twitter/X + Nostr campaign. Eventbrite was **dropped** as a supported platform
and is explicitly rejected with a supported-platform message.

Important: **the deployed GitHub Pages app is still the old Luma-only build** at
`https://orangedaddocs.github.io/event-poster/`. Everything below is committed
locally on `main` but **not pushed/deployed**.

## State as of this commit (2026-06-11 session)

App renamed **Event Megaphone** (page title, header, meta). Repo is still named
`event-poster` — decide whether to rename the GitHub repo when pushing; the
"View on GitHub" button still points at `orangedaddocs/event-poster`.

### Bug fixes (each has a regression test)

1. **Satlantis reader-fallback junk** — `readerDescription` didn't know
   Satlantis's `Description` heading (only Luma's `About Event` / Meetup's
   `Details`), so when CORS proxies failed and the r.jina.ai reader won, posts
   filled with page chrome ("Sign in", "- [x]", category badges, title echo).
   Now recognizes the heading, skips Satlantis chrome lines, and captures
   multi-day date ranges ("Thu, Jun 11 · 12:00 AM - Sat, Jun 13 · 11:59 PM CEST").
2. **False 404 on live Satlantis pages** — `importErrorReason` used
   `/Satlantis.*404/` against the whole collapsed document; SVG icon path data
   containing "…18.404…" made every fast-path HTML import fail. Pattern removed;
   genuine dead pages still caught via "Page not found". Side effect: Satlantis
   imports are now faster (~8s) because the HTML proxy path actually gets used.
3. **Apostrophe truncation in meta parsing** — `metaContent` used
   `["']([^"']*)["']`, so any og:description in double quotes was cut at the
   first apostrophe ("We're thrilled…" → "We"). Now quote-aware (4 patterns).

### Product changes

- **Tones cut from 4 to 3** — Cypherpunk removed (insider-speak fought the
  welcoming goal; tones only swap opener/CTA/signoff so it never differentiated).
  Educational / Welcoming / Punchy pools roughly **doubled** (8 openers, 6 CTAs,
  4 signoffs each) so Regenerate gives real variety.
- **Wait expectation** — import status now says "This can take 15–20 seconds";
  topbar subtitle mentions it too (imports run through flaky public CORS proxies).
- **"Twitter/X" wording** instead of bare "X" in topbar subtitle and empty-state.
- **Topbar font bumped** — logo 18→24px, subtitle 12→15px.

### Verification run this session

- `node --test 'test/*.test.mjs'` — **68/68 pass**.
- Full live browser UI test (real Chrome, real clicks/typing): placeholder
  exactly `Luma | Meetup | Satlantis`, no Eventbrite wording anywhere,
  Eventbrite URL rejected without any fetch, successful imports verified for
  all three providers (title/date/RSVP filled, 6 stages, 18 draft textareas,
  hashtags blank, no alerts). Report:
  `docs/live-browser-event-import-report-2026-06-11.md`.
- Live-verified imports: `luma.com/6stdvs93`,
  `meetup.com/bitcoin-park-austin/events/314778531`,
  `satlantis.io/events/2282/fork-and-coin-burger-night`,
  `satlantis.io/events/1500/btc-prague-2026`,
  `satlantis.io/events/1788/free-cities-conference-2026-prospera-step-inside`,
  `satlantis.io/events/2231/sunday-fireside-chat-ft-bryan-jones-from-hodl-house`.

## Known gaps / notes

- `output/` (7.4MB of test screenshots) is gitignored, not committed.
- Free Cities event imports without location/map — correct behavior, the event's
  venue is "To be announced" on Satlantis.
- Multi-day reader date shows no weekday on some pages ("Sep 03 · 12:00 PM") —
  cosmetic, comes from the fallback line parser.
- README/BUILD_SPEC still say "Event Poster" in places — sweep when renaming repo.
- `Stellantis` in conversation transcripts means **Satlantis**.

## Next session (Claude Code) should do this

1. **Commit everything pending.** The Cowork sandbox could not run git on this
   mount (git crashed with SIGBUS/EDEADLK at the filesystem layer), so all of
   the above is uncommitted working-tree state. If git complains about a stale
   `.git/index.lock`, delete it — it's from a crashed process, not a real lock.
   Suggested commit message:

   ```
   feat: Event Megaphone v2 — drop Eventbrite, fix Satlantis imports, 3 deeper tones

   - Rename app to Event Megaphone; bigger header; Twitter/X wording
   - Drop Eventbrite: reject with supported-platform message (Luma|Meetup|Satlantis)
   - Fix Satlantis reader fallback: recognize "Description" heading, skip page
     chrome, capture multi-day date ranges
   - Fix false 404: /Satlantis.*404/ matched SVG path data on live pages
   - Fix metaContent truncating og:description at apostrophes
   - Cut Cypherpunk tone; double phrase pools for Educational/Welcoming/Punchy
   - Import status sets 15–20s expectation
   - Tests: 68/68 pass, incl. 3 new regression tests
   ```

2. `git push`.
3. Decide on repo rename (`event-poster` → `event-megaphone`?) and update the
   "View on GitHub" link + README/BUILD_SPEC naming.
4. Deploy to GitHub Pages and click through the deployed app once
   (the deployed build is still old Luma-only until then).
