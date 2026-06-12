# Live Browser Event Import Report - 2026-06-04

Purpose: exercise the Luma import path against real event pages found through live web/browser testing for Bitcoin-related events in large cities.

Environment notes:

- The in-app browser could reach Luma pages directly.
- Shell-side live fetches were blocked by network restrictions, so `test/live-smoke.mjs` could not complete from the terminal in this session.
- Direct local app loading in the browser was blocked by the browser URL policy for `file://`, and this sandbox could not bind a local HTTP server. The parser was therefore tested with real browser-loaded Luma page content.

## Results

| City | Luma URL | Parsed title | Parsed date | Parsed location | Map | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Austin | `https://luma.com/1uniw2n0` | Bitcoin Builders Club | Mon, Dec 21 · 6:30 PM CST | Capital Factory; Austin, Texas; US | yes | pass |
| Dallas | `https://luma.com/theOCEANparty` | The OCEAN party | Thu, Nov 13 · 5:00 PM CST | Irving; Irving, Texas; US | yes | pass |
| Dallas | `https://luma.com/i2v6tcq8` | Bitcoin Foundations: A Conversation with Adam Back Hosted By The Texas Blockchain Council | Thu, May 22 · 3:00 PM CDT | Dallas, Texas; US | yes | pass |
| Denver | `https://luma.com/2g5x0ove` | Bitcoin Mini Summit | Thu, Feb 19 · 3:00 PM MST | 4850 National Western Dr; Denver, Colorado; US | yes | pass |
| San Francisco | `https://luma.com/aql0rii9` | Markets, Bitcoin & Tokenization Evening | Fri, May 29 · 6:00 PM PDT | AngelList; San Francisco, California; US | yes | pass |
| Nashville | `https://luma.com/thyyoysm` | Bitcoin Privacy Nashville | Thu, Jul 25 · 12:00 PM CDT | Ole Smoky Moonshine Distillery; Nashville, Tennessee | yes | pass |
| Nashville | `https://luma.com/cfdnashville` | Chain Fusion Day - Bitcoin Edition | Fri, Jul 26 · 2:00 PM CDT | Johnny Cash's Bar & BBQ; Nashville, Tennessee | yes | pass |

## Fix From This Pass

Live Luma pages sometimes repeat the venue name as both the place name and the first address line. The import now dedupes repeated structured location lines before filling the form.

Regression coverage:

- `structured location import dedupes repeated venue lines`
- Full suite after fix: `node --test 'test/*.test.mjs'` passes, 59/59.
