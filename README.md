# Event Megaphone

A free, single-file, self-hosted post generator for Luma, Meetup, and Satlantis events. Paste an event URL, get a ready-to-copy Twitter/X + Nostr campaign.

**▶ Use it now → https://orangedaddocs.github.io/event-megaphone/** — or download the single `index.html` and open it; it works the same, fully offline.

🔒 **No AI. No accounts. No tracking.** No analytics, no pixels, no external scripts or fonts — one HTML file you can read end to end. It makes zero network requests until you click an import button.

## Features

- **Multi-platform import**: paste a Luma, Meetup, or Satlantis event URL and the tool detects the source automatically; if automatic import is blocked, paste the page text/source as a fallback
- **6-stage campaign** per event: Announcement → 7-day reminder → 24-hr reminder → Live update → Follow-up recap → YouTube recap
- **3 post variants per stage**: short X (≤ 280 chars), long link-light X (no URL in body; link goes in the reply), and Nostr — with live character counts
- **Style selector**: Structured (label-led, scannable) or Conversational (hook-first, reads like a person)
- **3 tone presets**: Educational, Welcoming, Punchy — switching either knob re-renders all 18 drafts instantly
- **Visible Title field** — type or import the event title and see it live in every draft
- **Timezone-aware**: reads the IANA zone when the event page exposes it (e.g. `America/Denver`); labels every time with the correct abbreviation (MDT/EDT/etc.); Live-stage posts show local + ET + PT conversions, deduped and DST-correct
- **Location + map aware**: imports venue/address details and Google Maps links into editable fields, then includes clean map links in short X/Nostr posts
- **User-controlled hashtags**: imports leave the hashtag field blank; add only the tags you choose
- **Editable drafts** with one-click copy + "Open in X" using your edited text; clipboard fallback for `file://` / non-HTTPS contexts
- **Posting checklist** to keep each event's campaign consistent
- **Zero build, zero backend, zero dependencies** — a single HTML file. Works on GitHub Pages or just `open index.html`; works fully offline (manual entry + paste fallback)

## Quick start

- **Run locally**: open `index.html` in any browser. For full clipboard support on every browser, serve it from your machine: `python3 -m http.server 8787` → `http://localhost:8787`.
- **Self-host**: it's one static file — put `index.html` behind any web server you control.
- **GitHub Pages**: push the repo, then in repo **Settings → Pages → Source** select the `main` branch, `/ (root)`. Live at `https://<your-username>.github.io/event-megaphone/`.

## Usage

1. Paste a Luma, Meetup, or Satlantis event URL and click **Import event**.
2. If import is blocked, click **Paste text/HTML**, paste the page source or copied event text, then parse it.
3. Review the filled fields and edit anything that needs fixing (Title, date, speaker, hook, RSVP URL, location, map URL). Add hashtags manually if you want them.
4. Pick a **Style** and a **Tone** — posts re-render instantly. Click **Generate posts** if you made manual edits.
5. Walk down the 6 stages and copy each post: short X and long X into Twitter/X, Nostr into [Primal](https://primal.net), [Damus](https://damus.io), or [Amethyst](https://github.com/vitorpamplona/amethyst).
6. Use the **Posting checklist** at the bottom to confirm nothing was missed.

## Customize

- **Colors**: edit the `:root` CSS variables in `index.html` (`--accent`, `--navy-950`, `--bg`).
- **Tone phrases**: edit the `openers` / `ctas` / `signoffs` arrays in `const TONES = {...}` in the `<script>` block.
- **AI-written posts (optional)**: the default engine fills templates. To wire up a bring-your-own-key LLM instead (local Ollama or OpenRouter; templates stay the fallback), follow [`AI_INTEGRATION.md`](AI_INTEGRATION.md).

## License

MIT.
