# Event Import Live Smoke

Use this when you want to check real public event pages after changing import logic. The normal test suite uses local fixtures so it stays deterministic; this script is intentionally network-dependent.

```sh
node test/live-smoke.mjs \
  "https://luma.com/..." \
  "https://www.meetup.com/.../events/..." \
  "https://www.eventbrite.com/e/...-tickets-..." \
  "https://satlantis.io/events/..."
```

For each URL the harness:

- detects the provider and normalizes the RSVP URL
- tries the page directly, then the Jina reader fallback
- parses the page with the same engine used by `index.html`
- prints which fields were filled
- saves the fetched body under `test/fixtures/_candidates/`

Promote a candidate into `test/fixtures/<provider>/` only after trimming unrelated page chrome and confirming it does not contain private or venue-specific text. The checked-in contract is at least three fixtures per provider.
