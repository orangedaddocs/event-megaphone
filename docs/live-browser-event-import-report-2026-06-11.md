# Live browser test — platform support (2026-06-11)

Tested the local `index.html` (sha256 `0e8f7d0d…ad17f74`) in real Chrome. Note: Chrome automation can't open `file://` URLs directly, so the exact local file bytes were loaded into a live Chrome tab via file upload + render (hash-verified identical). All interaction was real UI: clicking the field, typing URLs, clicking Import.

## Unit tests

`node --test test/*.test.mjs` — **65/65 pass**.

## UI checks

- Import placeholder is exactly `Luma | Meetup | Satlantis` — **pass**
- No "Eventbrite" wording anywhere in visible UI or page HTML — **pass**
- Import button copy updates per provider ("Import from Luma / Meetup / Satlantis") — works

## Eventbrite rejection — PASS

URL: `https://www.eventbrite.com/e/bitcoin-asia-2026-hong-kong-tickets-1977520078789`
Clicking Import immediately shows the warn message **"Paste a supported event URL: Luma, Meetup, or Satlantis."** No import is attempted (status never enters "Importing…", no fields touched).

## Platform imports

| Check | Luma | Meetup | Satlantis |
|---|---|---|---|
| Title fills | ✅ "AI Made Easy: Hands-On Training with OpenClaw and More!" | ✅ "AB⚡️DC - Austin Bitcoin Design Club" | ✅ "Fork & Coin Burger Night" |
| Date/time fills | ✅ Thu, Jun 18 · 5:30 PM MDT | ✅ Tue, Jul 7 · 6:00 PM CDT | ✅ Thu, Jun 25 · 4:00 PM - 10:00 PM CDT |
| RSVP URL fills | ✅ | ✅ | ✅ |
| 6 campaign stages render | ✅ | ✅ | ✅ |
| 18 draft textareas | ✅ | ✅ | ✅ |
| Hashtags blank | ✅ | ✅ | ✅ |
| No "add title" alert | ✅ (alert spy: none fired) | ✅ | ✅ |
| No Eventbrite wording in import UI | ✅ | ✅ | ✅ |
| **Verdict** | **PASS** | **PASS** | **PASS** |

Stage labels rendered: Announcement · 7-day reminder · 24-hr reminder · Live update · Follow-up · YouTube recap.

## Field notes (Satlantis partials)

- Location: ✅ full — "Fork & Coin 3938 N Central Ave, Chicago, IL 60634, USA"
- Map URL: ✅ filled — `maps.google.com/?cid=…` (valid but very long; pushes short-X post to 273/280)
- **Description/hook quality issue (only soft failure observed):** the imported Satlantis description came from the reader fallback and contains page-chrome junk that leaks into all generated posts: page-title echo ("Fork & Coin Burger Night Jun 25 2026, 4:00 pm | Satlantis"), a stray "- [x]", duplicated "Sign in / Sign in", and a "Food & Drink" category label. Luma and Meetup descriptions were clean.
- **FIXED later same day:** root cause was `readerDescription` not recognizing Satlantis's "Description" heading (it only knew Luma's "About Event" and Meetup's "Details"), so when the HTML proxies fail and the r.jina.ai reader fallback wins, the extractor scooped page chrome from the top of the page. Patch: recognize the "Description" heading, skip Satlantis chrome lines (Sign in, Address, Discussion, checkbox artifacts), and capture multi-day date ranges from the reader's day-block format. Regression test added (BTC Prague fixture); 66/66 tests pass. Verified live: BTC Prague 2026 now imports with clean description and "Thu, Jun 11 · 12:00 AM - Sat, Jun 13 · 11:59 PM CEST".

## Other observations

- Luma date/time, location, map, and full description all imported cleanly, including agenda.
- Meetup imported full description with venue ("Bitcoin Commons Austin, 601 Congress Avenue Suite 200").
- Import status summary line correctly lists filled vs. manual fields on all three.
