import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { engine } from './load-engine.mjs';
import { providerFixtures } from './fixtures/load-fixture.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(here, '..', 'index.html'), 'utf8');

test('engine loads and exposes limits', () => {
  assert.equal(engine.X_LIMIT, 280);
  assert.equal(engine.X_LONG_SOFT_LIMIT, 2000);
  assert.equal(engine.NOSTR_SOFT_LIMIT, 500);
});

test('UI has no default hashtag placeholder and shows short-X overage state', () => {
  assert.doesNotMatch(indexHtml, /#Denver/);
  assert.match(indexHtml, /placeholder="Luma \| Meetup \| Satlantis"/);
  assert.doesNotMatch(indexHtml, /placeholder="[^"]*Eventbrite/);
  assert.doesNotMatch(indexHtml, /event_import_url" placeholder="https?:\/\//);
  assert.match(indexHtml, /Post too long/);
  assert.match(indexHtml, /chars over/);
});

test('decodeEntities handles named + numeric entities, no DOM', () => {
  assert.equal(engine.decodeEntities('Tom &amp; Jerry'), 'Tom & Jerry');
  assert.equal(engine.decodeEntities('caf&#233; &lt;b&gt;'), 'café <b>');
  assert.equal(engine.decodeEntities('&quot;hi&quot; &#x27;x&#x27;'), '"hi" \'x\'');
  assert.equal(engine.decodeEntities(''), '');
});

test('normalizeLumaUrl adds scheme + bare slug', () => {
  assert.equal(engine.normalizeLumaUrl('luma.com/abc'), 'https://luma.com/abc');
  assert.equal(engine.normalizeLumaUrl('abc123'), 'https://luma.com/abc123');
  assert.equal(engine.normalizeLumaUrl('https://luma.com/x?lm_source=embed'), 'https://luma.com/x');
  assert.equal(engine.normalizeLumaUrl('https://lu.ma/x?utm_source=foo#embed'), 'https://luma.com/x');
  assert.equal(engine.normalizeLumaUrl(''), '');
});

test('lumaSlug extracts the first path segment', () => {
  assert.equal(engine.lumaSlug('https://luma.com/mrxb609z?lm_source=embed'), 'mrxb609z');
  assert.equal(engine.lumaSlug('pks2tmn1'), 'pks2tmn1');
});

test('detectEventProvider recognizes supported event URLs', () => {
  assert.equal(engine.detectEventProvider('https://luma.com/b1n1icdn?lm_source=embed'), 'luma');
  assert.equal(engine.detectEventProvider('https://www.meetup.com/bitcoin-and-beer/events/314928109/?recId=x'), 'meetup');
  assert.equal(engine.detectEventProvider('meetup.com/bitcoin-and-beer/events/314928109/'), 'meetup');
  assert.equal(engine.detectEventProvider('https://satlantis.io/events/denver-bitdevs-socratic-seminar?utm_source=x'), 'satlantis');
  assert.equal(engine.detectEventProvider('https://www.eventbrite.com/e/coinjoin-workshop-tickets-123456789?aff=oddtdtcreator'), '');
  assert.equal(engine.detectEventProvider(''), '');
});

test('normalizeMeetupUrl adds scheme and drops tracking params', () => {
  const url = engine.normalizeMeetupUrl('www.meetup.com/bitcoin-and-beer/events/314928109/?recId=x&eventOrigin=find_page%24all');
  assert.equal(url, 'https://www.meetup.com/bitcoin-and-beer/events/314928109/');
  assert.equal(engine.normalizeMeetupUrl('bitcoin-and-beer/events/314928109'), 'https://www.meetup.com/bitcoin-and-beer/events/314928109');
  assert.equal(engine.normalizeMeetupUrl(''), '');
});

test('normalizes Satlantis URLs for canonical sharing', () => {
  assert.equal(
    engine.normalizeSatlantisUrl('www.satlantis.io/events/denver-bitdevs?utm_source=x#top'),
    'https://satlantis.io/events/denver-bitdevs'
  );
});

test('normalizeEventUrl uses pasted URL provider over the selected provider', () => {
  assert.equal(engine.normalizeEventUrl('https://www.meetup.com/bitcoin-and-beer/events/314928109/?recId=x', 'luma'), 'https://www.meetup.com/bitcoin-and-beer/events/314928109/');
  assert.equal(engine.normalizeEventUrl('b1n1icdn', 'luma'), 'https://luma.com/b1n1icdn');
});

test('formatEventTime renders in the event zone with short tz label', () => {
  const out = engine.formatEventTime('2026-05-28T18:30:00-06:00', 'America/Denver');
  assert.match(out, /Thu, May 28/);
  assert.match(out, /6:30 ?PM MDT|6:30 PM MDT/);
});

test('formatEventTime falls back to the ISO offset when IANA missing (machine-independent)', () => {
  const out = engine.formatEventTime('2026-05-28T18:30:00-06:00', '');
  assert.match(out, /Thu, May 28/);
  assert.match(out, /6:30 PM GMT-6/);
});

test('timezoneConversions uses the ISO offset for local when IANA missing', () => {
  const conv = engine.timezoneConversions('2026-05-28T19:00:00-06:00', '');
  assert.match(conv, /7:00 PM GMT-6/);
  assert.match(conv, /9:00 PM EDT/);
  assert.match(conv, /6:00 PM PDT/);
});

test('timezoneConversions returns deduped local+ET+PT, DST-correct', () => {
  const conv = engine.timezoneConversions('2026-05-28T19:00:00-06:00', 'America/Denver');
  assert.match(conv, /7:00 PM MDT/);
  assert.match(conv, /9:00 PM EDT/);
  assert.match(conv, /6:00 PM PDT/);
  assert.equal(conv.split('·').length, 3);
});

test('timezoneConversions dedupes when event is already Eastern', () => {
  const conv = engine.timezoneConversions('2026-05-28T21:00:00-04:00', 'America/New_York');
  assert.equal(conv.split('·').length, 2);
  assert.match(conv, /9:00 PM EDT/);
  assert.match(conv, /6:00 PM PDT/);
});

test('enforceXLimit keeps short posts unchanged', () => {
  const s = 'Short and sweet';
  assert.equal(engine.enforceXLimit(s), s);
});

test('enforceXLimit trims to <= 280 and protects URL/hashtag lines', () => {
  const long = 'A'.repeat(300) + '\nRSVP: https://luma.com/x\n#Bitcoin';
  const out = engine.enforceXLimit(long);
  assert.ok(out.length <= 280, `len=${out.length}`);
  assert.match(out, /https:\/\/luma\.com\/x/);
  assert.match(out, /#Bitcoin/);
});

test('enforceXLimit protects map URL lines', () => {
  const map = 'Map: https://www.google.com/maps/search/?api=1&query=27.95862%2C%20-82.4439';
  const out = engine.enforceXLimit(`${'A'.repeat(260)}\n${map}`);
  assert.ok(out.length <= 280, `len=${out.length}`);
  assert.match(out, /Map: https:\/\/www\.google\.com\/maps\/search/);
});

test('stripLinks removes URLs from long-X body', () => {
  const body = 'Come hear it.\nRSVP: https://luma.com/x\nSee you';
  const out = engine.stripLinks(body);
  assert.doesNotMatch(out, /https?:\/\//);
  assert.doesNotMatch(out, /luma\.com/);
});

test('sanitizeVenueText scrubs forbidden venue references', () => {
  const dirty = 'Hosted at The Space tonight. A Space member spoke. #TheSpace';
  const clean = engine.sanitizeVenueText(dirty);
  assert.doesNotMatch(clean, /The Space/);
  assert.doesNotMatch(clean, /Space member/i);
  assert.doesNotMatch(clean, /#TheSpace/);
  assert.match(clean, /the venue/);
  assert.match(clean, /community member/i);
  assert.match(clean, /#Bitcoin/);
});

test('sanitizeVenueText leaves clean text alone', () => {
  const s = 'Denver Bitcoin meetup at 6:30 PM';
  assert.equal(engine.sanitizeVenueText(s), s);
});

const JSONLD_HTML = `<html><head>
<script type="application/ld+json">
{"@type":"Event","name":"Bitcoin in Healthcare","startDate":"2026-05-28T18:30:00-06:00",
 "description":"How to build a practice on a Bitcoin standard.","url":"https://luma.com/pks2tmn1",
 "location":{"@type":"Place","name":"Denver"}}
</` + `script></head><body></body></html>`;

test('parseJsonLdEvent pulls name/startDate/description/url', () => {
  const ev = engine.parseJsonLdEvent(JSONLD_HTML);
  assert.equal(ev.name, 'Bitcoin in Healthcare');
  assert.equal(ev.startDate, '2026-05-28T18:30:00-06:00');
  assert.match(ev.description, /Bitcoin standard/);
  assert.equal(ev.url, 'https://luma.com/pks2tmn1');
});

test('parseJsonLdEvent returns null when absent', () => {
  assert.equal(engine.parseJsonLdEvent('<html></html>'), null);
});

test('validateEvent requires a title and (date or description)', () => {
  assert.equal(engine.validateEvent({ title:'X', date_iso:'2026-01-01T00:00:00Z' }), true);
  assert.equal(engine.validateEvent({ title:'X', description:'hi' }), true);
  assert.equal(engine.validateEvent({ title:'' }), false);
  assert.equal(engine.validateEvent({ title:'X' }), false);
});

const NEXT_HTML = `<html><body>
<script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"somethingNew":{"event":{"name":"Denver BitDevs",
 "start_at":"2026-06-04T17:00:00-06:00","timezone":"America/Denver",
 "url":"https://luma.com/yj1xgw3q"}}}}}
</` + `script></body></html>`;

test('deepFindEvent finds an event-shaped object regardless of path', () => {
  const ev = engine.deepFindEvent(NEXT_HTML);
  assert.equal(ev.name, 'Denver BitDevs');
  assert.equal(ev.start_at, '2026-06-04T17:00:00-06:00');
  assert.equal(ev.timezone, 'America/Denver');
});

test('lumaToEvent builds a normalized event from JSON-LD html', () => {
  const ev = engine.lumaToEvent(JSONLD_HTML, 'https://luma.com/pks2tmn1');
  assert.equal(ev.title, 'Bitcoin in Healthcare');
  assert.equal(ev.date_iso, '2026-05-28T18:30:00-06:00');
  // JSONLD_HTML has no __NEXT_DATA__ timezone, so display falls back to the ISO offset (GMT-6)
  assert.match(ev.date_display, /6:30 PM GMT-6/);
  assert.equal(ev.luma_url, 'https://luma.com/pks2tmn1');
  assert.equal(ev.hashtags.length, 0);
  assert.ok(engine.validateEvent(ev));
});

test('lumaToEvent uses __NEXT_DATA__ timezone for display', () => {
  const ev = engine.lumaToEvent(NEXT_HTML, 'https://luma.com/yj1xgw3q');
  assert.equal(ev.title, 'Denver BitDevs');
  assert.equal(ev.tz, 'America/Denver');
  assert.match(ev.date_display, /5:00 PM MDT/);
});

test('eventContentToEvent accepts valid Luma embed pages with incidental 404 text', () => {
  const html = `<html><head>
  <title data-next-head="">AI Made Easy: Hands-On Training with OpenClaw and More! · Luma</title>
  <meta property="og:url" content="https://luma.com/6stdvs93?lm_source=embed">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Event","name":"AI Made Easy: Hands-On Training with OpenClaw and More!","startDate":"2026-06-18T17:30:00-06:00","description":"Hands-on AI training with OpenClaw.","url":"https://luma.com/6stdvs93?lm_source=embed","location":{"@type":"Place","name":"Denver Bitcoin meetup"}}
  </script>
  </head><body><script>window.__APP_CHUNKS__=["Luma bundled route has a 404 component"];</script></body></html>`;
  const ev = engine.eventContentToEvent(html, 'https://luma.com/6stdvs93?lm_source=embed', 'luma');
  assert.equal(ev.title, 'AI Made Easy: Hands-On Training with OpenClaw and More!');
  assert.match(ev.date_display, /Thu, Jun 18/);
  assert.equal(ev.luma_url, 'https://luma.com/6stdvs93');
  assert.equal(ev.hashtags.length, 0);
  assert.ok(engine.validateEvent(ev));
});

test('eventContentToEvent accepts Luma public API JSON as a structured fallback', () => {
  const apiJson = JSON.stringify({
    event: {
      name: 'AI Made Easy: Hands-On Training with OpenClaw and More!',
      start_at: '2026-06-18T23:30:00.000Z',
      timezone: 'America/Denver',
      url: '6stdvs93',
      geo_address_info: {
        full_address: 'The Space, 3704 Franklin St, Denver, CO 80205, USA',
        short_address: '3704 Franklin St, Denver'
      },
      coordinate: { latitude: 39.7683572, longitude: -104.9681833 },
      cover_url: 'https://images.lumacdn.com/event-covers/example.png'
    },
    description_mirror: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hands-on AI training with OpenClaw.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Bring your questions.' }] }
      ]
    }
  });
  const ev = engine.eventContentToEvent(apiJson, 'https://luma.com/6stdvs93?lm_source=embed', 'luma');
  assert.equal(ev.title, 'AI Made Easy: Hands-On Training with OpenClaw and More!');
  assert.match(ev.date_display, /Thu, Jun 18/);
  assert.match(ev.date_display, /5:30 PM MDT/);
  assert.match(ev.location, /3704 Franklin St/);
  assert.match(ev.map_url, /google\.com\/maps\/search/);
  assert.match(ev.description, /Hands-on AI training/);
  assert.equal(ev.luma_url, 'https://luma.com/6stdvs93');
  assert.equal(ev.hashtags.length, 0);
  assert.ok(engine.validateEvent(ev));
});

test('eventContentToEvent unwraps Jina reader output for Luma public API JSON', () => {
  const wrapped = [
    'Title:',
    '',
    'URL Source: https://api.lu.ma/event/get?event_api_id=6stdvs93',
    '',
    'Markdown Content:',
    JSON.stringify({
      event: {
        name: 'AI Made Easy: Hands-On Training with OpenClaw and More!',
        start_at: '2026-06-18T23:30:00.000Z',
        timezone: 'America/Denver',
        url: '6stdvs93',
        geo_address_info: { short_address: '3704 Franklin St, Denver' },
        coordinate: { latitude: 39.7683572, longitude: -104.9681833 }
      },
      description_mirror: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hands-on AI training with OpenClaw.' }] }]
      }
    })
  ].join('\n');
  const ev = engine.eventContentToEvent(wrapped, 'https://luma.com/6stdvs93', 'luma');
  assert.equal(ev.title, 'AI Made Easy: Hands-On Training with OpenClaw and More!');
  assert.match(ev.date_display, /5:30 PM MDT/);
  assert.equal(ev.luma_url, 'https://luma.com/6stdvs93');
  assert.equal(ev.hashtags.length, 0);
});

test('lumaToEvent throws when no title found', () => {
  assert.throws(() => engine.lumaToEvent('<html></html>', ''), /title/i);
});

const MEETUP_HTML = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"EducationEvent","name":"₿itcoin & Beer @ The Space","url":"https://www.meetup.com/bitcoin-and-beer/events/314928109/","description":"Join us for a Bitcoin & Beer happy hour and hang out with the local Bitcoin community every second Friday of the Month at The Space. [https://denver.space]","startDate":"2026-06-12T16:30:00-06:00","endDate":"2026-06-12T19:00:00-06:00","image":["https://secure-content.meetupstatic.com/images/classic-events/521692120/676x676.jpg"],"location":{"@type":"Place","name":"The Space Denver"}}
</` + `script></head><body>
<script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"event":{"__typename":"Event","id":"314928109","title":"₿itcoin & Beer @ The Space","description":"Join us for a Bitcoin & Beer happy hour and hang out with the local Bitcoin community every second Friday of the Month at The Space. [https://denver.space] 4:30PM RSVP: [https://denver.space/events]","eventUrl":"https://www.meetup.com/bitcoin-and-beer/events/314928109/","dateTime":"2026-06-12T16:30:00-06:00","timezone":"America/Denver","eventHosts":[{"name":"@blockbain"}],"displayPhoto":{"source":"https://secure.meetupstatic.com/photos/event/c/b/9/8/highres_521692120.jpeg"}}}}}
</` + `script></body></html>`;

test('parseJsonLdEvent treats schema EducationEvent as an event', () => {
  const ev = engine.parseJsonLdEvent(MEETUP_HTML);
  assert.equal(ev.name, '₿itcoin & Beer @ The Space');
  assert.equal(ev.startDate, '2026-06-12T16:30:00-06:00');
});

test('meetupToEvent builds a normalized event from Meetup html', () => {
  const ev = engine.meetupToEvent(MEETUP_HTML, 'https://www.meetup.com/bitcoin-and-beer/events/314928109/?recId=x');
  assert.equal(ev.title, '₿itcoin & Beer @ the venue');
  assert.equal(ev.date_iso, '2026-06-12T16:30:00-06:00');
  assert.equal(ev.tz, 'America/Denver');
  assert.match(ev.date_display, /4:30 PM MDT/);
  assert.equal(ev.luma_url, 'https://www.meetup.com/bitcoin-and-beer/events/314928109/');
  assert.equal(ev.speaker_x, '@blockbain');
  assert.match(ev.description, /Bitcoin & Beer happy hour/);
  assert.doesNotMatch(ev.description, /The Space/);
  assert.equal(ev.hashtags.length, 0);
  assert.ok(engine.validateEvent(ev));
});

const MEETUP_TRUNCATED_JSONLD_HTML = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Event","name":"Bitcoin for Beginners","url":"https://www.meetup.com/tampa-bay-bitcoin/events/315000821/","description":"Welcome to **Bitcoin for Beginners**! Ready to dive into the world of Bitcoin?\\n\\nThis meetup is perfect for those new to Bitcoin and looking to learn the ba","startDate":"2026-06-04T19:00:00-04:00"}
</` + `script></head><body>
<script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"event":{"__typename":"Event","id":"315000821","title":"Bitcoin for Beginners","description":"Welcome to **Bitcoin for Beginners**! Ready to dive into the world of Bitcoin?\\n\\nThis meetup is perfect for those new to Bitcoin and looking to learn the basics. Our expert instructors will guide you through everything you need to know to get started with Bitcoin.\\n\\nLocated at BarrieHaus Brew Co - They accept bitcoin!","eventUrl":"https://www.meetup.com/tampa-bay-bitcoin/events/315000821/","dateTime":"2026-06-04T19:00:00-04:00","timezone":"America/New_York"}}}}
</` + `script></body></html>`;

test('meetupToEvent prefers full Next data description over truncated JSON-LD', () => {
  const ev = engine.meetupToEvent(MEETUP_TRUNCATED_JSONLD_HTML, 'https://www.meetup.com/tampa-bay-bitcoin/events/315000821/');
  assert.match(ev.description, /everything you need to know/);
  assert.match(ev.description, /Located at BarrieHaus Brew Co - They accept bitcoin!/);
  assert.doesNotMatch(ev.description, /\*\*|learn the ba$/);
});

test('meetupToEvent parses reader fallback details without page chrome', () => {
  const reader = [
    'Title: ₿itcoin & Beer @ The Space, Fri, Jun 12, 2026, 4:30 PM | Meetup',
    'URL Source: https://www.meetup.com/bitcoin-and-beer/events/314928109/',
    'Markdown Content:',
    '# ₿itcoin & Beer @ The Space',
    'Hosted by @blockbain',
    'Friday, Jun 12, 4:30 PM to Friday, Jun 12, 7:00 PM MDT',
    '## Details',
    'Join us for a Bitcoin & Beer happy hour and hang out with the local Bitcoin community every second Friday of the Month at The Space. [https://denver.space]',
    '## Related topics'
  ].join('\n');
  const ev = engine.meetupToEvent(reader, 'https://www.meetup.com/bitcoin-and-beer/events/314928109/?recId=x');
  assert.equal(ev.title, '₿itcoin & Beer @ the venue');
  assert.equal(ev.date_display, 'Fri, Jun 12 · 4:30 PM MDT');
  assert.match(ev.description, /Bitcoin & Beer happy hour/);
  assert.doesNotMatch(ev.description, /Related topics|Hosted by|Markdown Content|The Space/);
  assert.equal(ev.luma_url, 'https://www.meetup.com/bitcoin-and-beer/events/314928109/');
  assert.ok(engine.validateEvent(ev));
});

test('meetupToEvent reader fallback captures map/location separately from the hook', () => {
  const reader = [
    'Title: Bitcoin for Beginners, Thu, Jun 4, 2026, 7:00 PM | Meetup',
    'URL Source: https://www.meetup.com/tampa-bay-bitcoin/events/315000821/',
    'Markdown Content:',
    '# Bitcoin for Beginners',
    '## Details',
    'Welcome to **Bitcoin for Beginners**! Ready to dive into the world of Bitcoin?',
    'This meetup is perfect for those new to Bitcoin and looking to learn the basics.',
    'Located at BarrieHaus Brew Co - They accept bitcoin!',
    "[![Image 12: Google map of the user's next upcoming event's location](https://maps-googleapis.meetup.com/maps/api/staticmap?center=27.95862%2C+-82.4439)](https://www.google.com/maps/search/?api=1&query=27.95862%2C%20-82.4439)",
    'BarrieHaus Brewery',
    '1403 East 5th Avenue Tampa, FL 33605 · Ybor City, FL',
    '## Attendees',
    '6'
  ].join('\n');
  const ev = engine.meetupToEvent(reader, 'https://www.meetup.com/tampa-bay-bitcoin/events/315000821/');
  assert.equal(ev.date_display, 'Thu, Jun 4 · 7:00 PM');
  assert.match(ev.description, /Located at BarrieHaus Brew Co - They accept bitcoin!/);
  assert.doesNotMatch(ev.description, /\*\*/);
  assert.doesNotMatch(ev.description, /\[\]\(|google\.com\/maps|BarrieHaus Brewery|1403 East 5th Avenue|Attendees/);
  assert.equal(ev.map_url, 'https://www.google.com/maps/search/?api=1&query=27.95862%2C%20-82.4439');
  assert.match(ev.location, /BarrieHaus Brewery/);
  assert.match(ev.location, /1403 East 5th Avenue Tampa, FL 33605/);
  assert.doesNotMatch(ev.location, /Attendees/);
  const long = engine.compose(ev, 'conversational', 'educational')[1].xlong;
  assert.match(long, /BarrieHaus Brewery/);
  assert.doesNotMatch(long, /\[\]\(|google\.com\/maps|Attendees/);
});

test('meetupToEvent reader fallback captures location when address appears before map', () => {
  const reader = [
    'Title: Bitcoin for Beginners, Thu, Jun 4, 2026, 7:00 PM | Meetup',
    'URL Source: https://www.meetup.com/tampa-bay-bitcoin/events/315000821/',
    '# Bitcoin for Beginners',
    'Thursday, Jun 4, 7:00 PM to Thursday, Jun 4, 9:00 PM EDT',
    'BarrieHaus Brewery',
    '1403 East 5th Avenue Tampa, FL 33605 · Ybor City, FL',
    "[![Image 7: Google map of the user's next upcoming event's location](https://maps-googleapis.meetup.com/maps/api/staticmap?center=27.95862%2C+-82.4439)](https://www.google.com/maps/search/?api=1&query=27.95862%2C%20-82.4439)",
    '## Sponsors',
    '## Details',
    'Welcome to **Bitcoin for Beginners**!'
  ].join('\n');
  const ev = engine.meetupToEvent(reader, 'https://www.meetup.com/tampa-bay-bitcoin/events/315000821/');
  assert.equal(ev.date_display, 'Thu, Jun 4 · 7:00 PM EDT');
  assert.equal(ev.map_url, 'https://www.google.com/maps/search/?api=1&query=27.95862%2C%20-82.4439');
  assert.match(ev.location, /BarrieHaus Brewery/);
  assert.match(ev.location, /1403 East 5th Avenue Tampa, FL 33605/);
  assert.doesNotMatch(ev.location, /Sponsors|Details/);
});

test('compose shares map links in short X and Nostr while long X stays link-light', () => {
  const ev = {
    ...EV,
    location: 'BarrieHaus Brewery\n1403 East 5th Avenue Tampa, FL 33605',
    map_url: 'https://www.google.com/maps/search/?api=1&query=27.95862%2C%20-82.4439'
  };
  const posts = engine.compose(ev, 'conversational', 'educational');
  const announce = posts.find(p => p.stage === 'Announcement');
  const live = posts.find(p => p.stage === 'Live update');
  assert.match(announce.x, /Map: https:\/\/www\.google\.com\/maps\/search/);
  assert.match(announce.nostr, /Map: https:\/\/www\.google\.com\/maps\/search/);
  assert.match(live.x, /Map: https:\/\/www\.google\.com\/maps\/search/);
  assert.match(announce.xlong, /Map link.s in the reply/i);
  assert.doesNotMatch(announce.xlong, /https?:\/\//);
});

test('eventContentToEvent routes supported providers', () => {
  assert.equal(engine.eventContentToEvent(JSONLD_HTML, 'https://luma.com/pks2tmn1', 'luma').title, 'Bitcoin in Healthcare');
  assert.equal(engine.eventContentToEvent(MEETUP_HTML, 'https://www.meetup.com/bitcoin-and-beer/events/314928109/', 'meetup').title, '₿itcoin & Beer @ the venue');
  assert.equal(engine.eventContentToEvent(providerFixtures('satlantis')[0].content, 'https://satlantis.io/events/denver-bitdevs-socratic-seminar', 'satlantis').title, 'Denver BitDevs Socratic Seminar');
});

test('eventContentToEvent rejects Eventbrite as unsupported', () => {
  assert.throws(
    () => engine.eventContentToEvent('Title: Paid Ticket Event', 'https://www.eventbrite.com/e/paid-ticket-event-tickets-123', 'eventbrite'),
    /Unsupported event source/i
  );
});

test('eventContentToEvent rejects provider error pages from proxy readers', () => {
  const meetup404 = [
    'Title: Welp, this 404 is awkward',
    'URL Source: https://www.meetup.com/grand-rapids-bitcoin/events/ggxmvtyjcgbdc/',
    'Warning: Target URL returned error 404: Not Found',
    'Markdown Content:',
    '# Meetup | Welp, this 404 is awkward',
    'The people platform'
  ].join('\n');
  assert.throws(
    () => engine.eventContentToEvent(meetup404, 'https://www.meetup.com/grand-rapids-bitcoin/events/ggxmvtyjcgbdc/', 'meetup'),
    /404|Not Found/i
  );
});

test('fixture set has at least three import examples per provider', () => {
  for(const provider of ['luma', 'meetup', 'satlantis']){
    assert.ok(providerFixtures(provider).length >= 3, `${provider} needs at least 3 fixtures`);
  }
});

const fixtureFallback = {
  luma: name => `https://luma.com/${name.replace(/\..+$/, '')}`,
  meetup: name => `https://www.meetup.com/example/events/${name.replace(/\D/g, '') || '315000000'}/`,
  satlantis: name => `https://satlantis.io/events/${name.replace(/\..+$/, '')}?utm_source=x`
};

const fixtureParser = {
  luma: engine.lumaToEvent,
  meetup: engine.meetupToEvent,
  satlantis: engine.satlantisToEvent
};

for(const provider of ['luma', 'meetup', 'satlantis']){
  test(`${provider} fixtures parse into usable event drafts`, () => {
    for(const fixture of providerFixtures(provider)){
      const ev = fixtureParser[provider](fixture.content, fixtureFallback[provider](fixture.name));
      assert.ok(ev.title, `${provider}/${fixture.name} missing title`);
      assert.ok(ev.description || ev.date_display || ev.date_iso, `${provider}/${fixture.name} missing usable body/date`);
      assert.ok(ev.luma_url, `${provider}/${fixture.name} missing RSVP URL`);
      assert.ok(engine.validateEvent(ev), `${provider}/${fixture.name} did not validate`);
      const composed = engine.compose(ev, 'conversational', 'educational');
      assert.equal(composed.length, 6, `${provider}/${fixture.name} did not compose all stages`);
    }
  });
}

test('structured location import dedupes repeated venue lines', () => {
  const html = `<html><head><script type="application/ld+json">
  {"@type":"Event","name":"Bitcoin Builders Club","startDate":"2026-12-21T18:30:00-06:00","description":"Builders hang out.","url":"https://luma.com/1uniw2n0","location":{"@type":"Place","name":"Capital Factory","address":{"streetAddress":"Capital Factory","addressLocality":"Austin","addressRegion":"TX","addressCountry":"US"}}}
  </script></head></html>`;
  const ev = engine.lumaToEvent(html, 'https://luma.com/1uniw2n0');
  assert.equal(ev.location.split('\n').filter(line => line === 'Capital Factory').length, 1);
});

test('Satlantis adapter is explicit about partial import fields', () => {
  const ev = engine.satlantisToEvent(providerFixtures('satlantis').find(f => f.name === 'denver.html').content, 'https://satlantis.io/events/denver-bitdevs-socratic-seminar?utm_source=x');
  assert.equal(ev.title, 'Denver BitDevs Socratic Seminar');
  assert.match(ev.date_display, /Thu, Jun 4 · 5:00 PM MDT/);
  assert.equal(ev.location, '');
  assert.equal(ev.map_url, '');
  const summary = engine.importFieldSummary(ev, 'satlantis');
  assert.match(summary, /Add manually:.*location/i);
  assert.match(summary, /Add manually:.*map/i);
});

test('Satlantis adapter reads embedded event state when available', () => {
  const html = `<html><head>
  <title>600000000000 Prague Party Jun 11 2026, 7:30 pm | Satlantis</title>
  <meta property="og:title" content="600000000000 Prague Party Jun 11 2026, 7:30 pm | Satlantis">
  <meta property="og:description" content="Come and party with the 600000000000 community at BTC Prague!">
  <meta property="og:url" content="https://www.satlantis.io/events/2315/600000000000-prague-party">
  </head><body><script>
  data:{eventDetails:{title:"600000000000 Prague Party",start:"2026-06-11T17:30:00Z",startTzId:"Europe/Prague",location:"ostrov \\u0160tvanice, 170 00 Praha 7-Hole\\u0161ovice, Czechia",venue:{googleMapsUrl:"https://maps.google.com/?cid=17776776173746056198",name:"Fuchs2"}}}
  </script></body></html>`;
  const ev = engine.satlantisToEvent(html, 'https://www.satlantis.io/events/2315/600000000000-prague-party');
  assert.equal(ev.title, '600000000000 Prague Party');
  assert.equal(ev.date_iso, '2026-06-11T17:30:00Z');
  assert.equal(ev.tz, 'Europe/Prague');
  assert.match(ev.date_display, /7:30 PM/);
  assert.match(ev.location, /Fuchs2/);
  assert.match(ev.location, /ostrov Štvanice/);
  assert.equal(ev.map_url, 'https://maps.google.com/?cid=17776776173746056198');
});

test('Satlantis adapter captures title and address from reader fallback', () => {
  const reader = [
    'Title: 600000000000 Prague Party Jun 11 2026, 7:30 pm | Satlantis',
    'URL Source: https://satlantis.io/events/2315/600000000000-prague-party',
    'Markdown Content:',
    '# 600000000000 Prague Party',
    '11',
    'Jun',
    'Thursday',
    '7:30 PM CEST',
    'Description',
    'Come and party with the 600000000000 community at BTC Prague!',
    'Address',
    '[Fuchs2 ostrov Štvanice, Holešovice, 170 00 Praha 7, Czechia](https://maps.google.com/?cid=17776776173746056198)',
    '[Open Map](https://maps.google.com/?cid=17776776173746056198)'
  ].join('\n');
  const ev = engine.satlantisToEvent(reader, 'https://satlantis.io/events/2315/600000000000-prague-party');
  assert.equal(ev.title, '600000000000 Prague Party');
  assert.match(ev.date_display, /Thu, Jun 11 · 7:30 PM CEST/);
  assert.match(ev.location, /Fuchs2/);
  assert.equal(ev.map_url, 'https://maps.google.com/?cid=17776776173746056198');
});

test('Satlantis reader fallback skips page chrome and captures multi-day range (BTC Prague regression)', () => {
  // Shape taken from real r.jina.ai output for satlantis.io/events/1500/btc-prague-2026
  const reader = [
    'Title: BTC Prague 2026  Jun 11 2026, 12:00 am | Satlantis',
    'URL Source: https://satlantis.io/events/1500/btc-prague-2026',
    'Markdown Content:',
    '# BTC Prague 2026 Jun 11 2026, 12:00 am | Satlantis',
    '- [x] ',
    '[![Image 1: Satlantis](https://satlantis.io/images/logo.svg)](https://satlantis.io/)',
    'Sign in',
    'Sign in',
    'Conference',
    '# BTC Prague 2026',
    'Beranových 667, 199 00 Praha 9, Czechia',
    '11',
    'Jun',
    'Thursday ',
    '12:00 AM CEST',
    '13',
    'Jun',
    'Saturday ',
    '11:59 PM CEST',
    'Register',
    'conference btc prague europe adoption',
    'Description',
    'BTC Prague is Europe’s largest Bitcoin conference, bringing together thousands of people from around the world to learn, build, and connect around Bitcoin.',
    '[http://btcprg.me/SATLANTIS](http://btcprg.me/SATLANTIS)',
    'Address',
    '[PVA EXPO PRAHA Beranových 667, 199 00 Praha 9, Czechia](https://maps.google.com/?cid=14925188571624524152)',
    '[Open Map](https://maps.google.com/?cid=14925188571624524152)',
    'Discussion',
    'Add a comment',
    'Join the',
    'Social Events App',
    'Continue with Email',
    'Sign Up For Free'
  ].join('\n');
  const ev = engine.satlantisToEvent(reader, 'https://satlantis.io/events/1500/btc-prague-2026');
  assert.equal(ev.title, 'BTC Prague 2026');
  // description is the real body — none of the page chrome
  assert.match(ev.description, /Europe’s largest Bitcoin conference/);
  assert.doesNotMatch(ev.description, /Sign in|\[x\]|Sign Up|Add a comment|Continue with/i);
  assert.doesNotMatch(ev.description, /\| Satlantis/);
  // multi-day range with shared tz shown once
  assert.match(ev.date_display, /Thu, Jun 11 · 12:00 AM - Sat, Jun 13 · 11:59 PM CEST/);
  assert.equal(ev.map_url, 'https://maps.google.com/?cid=14925188571624524152');
  assert.match(ev.location, /PVA EXPO PRAHA/);
});

test('og:description with apostrophes is not truncated (Hodl House regression)', () => {
  const html = '<html><head>'
    + '<meta property="og:title" content="Sunday Fireside Chat Jun 07 2026, 3:00 pm | Satlantis">'
    + '<meta property="og:description" content="Homes and hard assets.\n\nWe’re thrilled to be joined by Bryan Jones, founder of Hodl House. It\'ll be great.">'
    + '</head><body></body></html>';
  const ev = engine.satlantisToEvent(html, 'https://satlantis.io/events/2231/sunday-fireside-chat');
  assert.match(ev.description, /thrilled to be joined by Bryan Jones/);
  assert.match(ev.description, /It'll be great/);
});

test('importErrorReason does not false-positive on "404" inside SVG paths or hashes (Hodl House regression)', () => {
  // Real Satlantis pages embed icon SVGs whose path data contains digit runs like "18.404"
  const livePage = '<html><head><meta property="og:title" content="Sunday Fireside Chat | Satlantis"></head>'
    + '<body><svg><path d="M19.1474 18.3525C19.2027 18.404 19.247 18.4661Z"/></svg>Description here</body></html>';
  assert.equal(engine.importErrorReason(livePage, 'satlantis'), '');
  // ...but a genuinely dead event page is still caught
  assert.match(engine.importErrorReason('<html><body>Page not found</body></html>', 'satlantis'), /unavailable/i);
});

test('buildProxyAttempts includes 4 no-key proxies with correct Jina URL', () => {
  const url = 'https://luma.com/mrxb609z';
  const attempts = engine.buildProxyAttempts(url);
  const urls = attempts.map(a => a.url);
  assert.equal(attempts.length, 4);
  // raw-HTML proxies that carry JSON-LD / __NEXT_DATA__ / inline state
  assert.ok(urls.some(u => u.includes('test.cors.workers.dev/?')));
  assert.ok(urls.some(u => u.includes('cors.eu.org/')));
  assert.ok(urls.some(u => u.includes('api.allorigins.win/get?url=')));
  // at least one non-reader raw proxy is tried before the reader fallback
  assert.ok(attempts.some(a => !a.reader && a.kind === 'raw'));
  const jina = urls.find(u => u.includes('r.jina.ai'));
  assert.equal(jina, 'https://r.jina.ai/https://luma.com/mrxb609z');
  assert.doesNotMatch(jina, /r\.jina\.ai\/http:\/\/r\.jina\.ai/);
});

test('TONES has exactly three tones with deepened phrase pools', () => {
  assert.deepEqual(Object.keys(engine.TONES).sort(), ['educational', 'punchy', 'welcoming']);
  for(const t of ['educational', 'welcoming', 'punchy']){
    assert.ok(Array.isArray(engine.TONES[t].openers) && engine.TONES[t].openers.length >= 6, `${t} openers too shallow`);
    assert.ok(Array.isArray(engine.TONES[t].ctas) && engine.TONES[t].ctas.length >= 5, `${t} ctas too shallow`);
    assert.ok(Array.isArray(engine.TONES[t].signoffs) && engine.TONES[t].signoffs.length >= 3, `${t} signoffs too shallow`);
  }
});

test('STYLES are structured + conversational', () => {
  assert.deepEqual(Object.keys(engine.STYLES).sort(), ['conversational', 'structured']);
});

const EV = {
  title:'Bitcoin in Healthcare', speaker:'Dr. Noah Kaufman', speaker_x:'@noah', speaker_nostr:'',
  date_iso:'2026-05-28T19:00:00-06:00', tz:'America/Denver',
  date_display:'Thu, May 28 · 7:00 PM MDT', hook:'How do you build a practice on a Bitcoin standard?',
  luma_url:'https://luma.com/pks2tmn1', youtube_url:'', hashtags:'#Bitcoin #Healthcare', venue:'Denver Bitcoin meetup'
};

test('compose returns 6 stages, each with x/xlong/nostr strings', () => {
  const posts = engine.compose(EV, 'conversational', 'educational');
  assert.equal(posts.length, 6);
  for(const p of posts){
    assert.equal(typeof p.x, 'string');
    assert.equal(typeof p.xlong, 'string');
    assert.equal(typeof p.nostr, 'string');
    assert.ok(p.stage && p.when);
  }
});

test('short X is always <= 280', () => {
  for(const style of ['structured', 'conversational']){
    for(const tone of ['educational', 'welcoming', 'punchy']){
      for(const p of engine.compose(EV, style, tone)) assert.ok(p.x.length <= 280, `${style}/${tone}/${p.stage}=${p.x.length}`);
    }
  }
});

test('long X never contains a URL (link-light)', () => {
  for(const p of engine.compose(EV, 'conversational', 'educational')) assert.doesNotMatch(p.xlong, /https?:\/\/|luma\.com/);
});

test('pre-event stages have no blank placeholders; post-event have at most one', () => {
  const posts = engine.compose(EV, 'conversational', 'educational');
  const byStage = Object.fromEntries(posts.map(p => [p.stage, p]));
  const preStages = ['Announcement', '7-day reminder', '24-hr reminder', 'Live update'];
  for(const s of preStages){
    const all = byStage[s].x + byStage[s].xlong + byStage[s].nostr;
    assert.doesNotMatch(all, /\[[^\]]+\]/, `unexpected blank in ${s}`);
  }
  assert.match(byStage['Follow-up'].x, /\[[^\]]+\]/);
});

test('announcement includes the RSVP URL on short X and Nostr', () => {
  const a = engine.compose(EV, 'structured', 'educational')[0];
  assert.match(a.x, /luma\.com\/pks2tmn1/);
  assert.match(a.nostr, /luma\.com\/pks2tmn1/);
});

test('live stage shows timezone conversions', () => {
  const live = engine.compose(EV, 'conversational', 'punchy').find(p => p.stage === 'Live update');
  assert.match(live.x, /9:00 PM EDT/);
});

test('youtube recap: X says link in reply, nostr embeds url', () => {
  const ev = { ...EV, youtube_url:'https://youtube.com/watch?v=abc' };
  const recap = engine.compose(ev, 'conversational', 'educational').find(p => p.stage === 'YouTube recap');
  assert.match(recap.x, /reply/i);
  assert.doesNotMatch(recap.x, /youtube\.com/);
  assert.match(recap.nostr, /youtube\.com\/watch\?v=abc/);
});

test('speaker X handle tags on X posts and npub tags on Nostr, in both styles', () => {
  const ev = { ...EV, speaker_x:'@noah', speaker_nostr:'npub1abc' };
  for(const style of ['conversational', 'structured']){
    const posts = engine.compose(ev, style, 'educational');
    const announce = posts.find(p => p.stage === 'Announcement');
    assert.match(announce.x, /@noah/, `X handle missing on ${style} announcement X`);
    assert.match(announce.nostr, /nostr:npub1abc/, `npub missing on ${style} announcement Nostr`);
    const rem1 = posts.find(p => p.stage === '24-hr reminder');
    assert.match(rem1.x, /@noah/, `X handle missing on ${style} 24-hr X`);
  }
});

test('short X does not truncate the hook at an abbreviation like "Dr."', () => {
  const ev = { ...EV, hook: 'Dr. Smith shows how to run a clinic on a Bitcoin standard. Come learn how.' };
  const announce = engine.compose(ev, 'conversational', 'educational')[0];
  assert.match(announce.x, /Dr\. Smith shows how to run a clinic on a Bitcoin standard\./);
});

test('reader fallback ignores the "Title: … · Luma" line and captures the body', () => {
  const reader = [
    'Title: My Event · Luma',
    'URL Source: https://luma.com/abc',
    'About Event',
    'Come learn about sovereign computing.',
    'We will cover hash rate heating.',
    'Hosted By',
    'Someone'
  ].join('\n');
  const ev = engine.lumaToEvent(reader, 'https://luma.com/abc');
  assert.doesNotMatch(ev.description, /Title:/);
  assert.doesNotMatch(ev.description, /· Luma/);
  assert.match(ev.description, /sovereign computing/);
  assert.match(ev.description, /hash rate heating/);
});

test('buildStage returns empty strings for an unknown stage id', () => {
  const out = engine.buildStage({ id:'nope', label:'X', when:'' }, EV, 'conversational', 'educational', 0);
  assert.equal(out.x, '');
  assert.equal(out.xlong, '');
  assert.equal(out.nostr, '');
});

test('no dangling RSVP/CTA label when luma_url is empty', () => {
  const ev = { ...EV, luma_url:'' };
  for(const style of ['structured','conversational']){
    for(const p of engine.compose(ev, style, 'educational')){
      const all = p.x + '\n' + p.xlong + '\n' + p.nostr;
      assert.doesNotMatch(all, /RSVP:\s*(\n|$)/i, `dangling "RSVP:" in ${style}/${p.stage}`);
      assert.doesNotMatch(all, /RSVP →\s*(\n|$)/i, `dangling "RSVP →" in ${style}/${p.stage}`);
    }
  }
});

test('stripLinks removes bare domains without a path', () => {
  assert.doesNotMatch(engine.stripLinks('come to luma.com today'), /luma\.com/);
  assert.doesNotMatch(engine.stripLinks('see bit.ly/abc here'), /bit\.ly/);
  assert.doesNotMatch(engine.stripLinks('at mysite.app/path ok'), /mysite\.app/);
});

test('compose still includes RSVP url when present (regression guard)', () => {
  const a = engine.compose(EV, 'structured', 'educational')[0];
  assert.match(a.x, /luma\.com\/pks2tmn1/);
});
