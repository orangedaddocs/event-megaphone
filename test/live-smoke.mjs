import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { engine } from './load-engine.mjs';

const urls = process.argv.slice(2).filter(Boolean);

function usage(){
  console.log('Usage: node test/live-smoke.mjs <event-url> [event-url ...]');
  console.log('Supported: Luma, Meetup, Satlantis');
}

function safeName(s){
  return String(s || 'event').toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96) || 'event';
}

function providerSummary(ev, provider){
  return {
    provider,
    title: !!ev.title,
    date: !!(ev.date_iso || ev.date_display),
    location: !!ev.location,
    map: !!ev.map_url,
    description: !!ev.description,
    rsvp: !!ev.luma_url,
    valid: engine.validateEvent(ev)
  };
}

function fieldScore(ev){
  return ['title', 'date_iso', 'date_display', 'location', 'map_url', 'description', 'luma_url', 'speaker', 'speaker_x', 'speaker_nostr']
    .reduce((score, field) => score + (ev[field] ? 1 : 0), 0);
}

async function fetchText(url){
  const res = await fetch(url, {
    headers: {
      'accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      'user-agent': 'EventPosterLiveSmoke/1.0'
    }
  });
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

async function readEvent(url, provider){
  const attempts = [
    { label: 'direct', url },
    { label: 'jina', url: `https://r.jina.ai/${url}` }
  ];
  const errors = [];
  const successes = [];
  for(const attempt of attempts){
    try{
      const body = await fetchText(attempt.url);
      const ev = engine.eventContentToEvent(body, url, provider);
      if(!engine.validateEvent(ev)) throw new Error('parsed event failed validation');
      successes.push({ body, ev, attempt: attempt.label, score: fieldScore(ev) });
    }catch(e){
      errors.push(`${attempt.label}: ${e.message}`);
    }
  }
  if(successes.length){
    successes.sort((a, b) => b.score - a.score);
    return successes[0];
  }
  throw new Error(errors.join('; '));
}

if(!urls.length){
  usage();
  process.exit(1);
}

const candidateDir = join(process.cwd(), 'test', 'fixtures', '_candidates');
mkdirSync(candidateDir, { recursive: true });

let failures = 0;
for(const rawUrl of urls){
  const provider = engine.detectEventProvider(rawUrl);
  if(!provider){
    failures++;
    console.error(`FAIL ${rawUrl}`);
    console.error('  Unsupported event source.');
    continue;
  }
  const url = engine.normalizeEventUrl(rawUrl, provider);
  try{
    const { body, ev, attempt } = await readEvent(url, provider);
    const ext = attempt === 'jina' ? 'txt' : 'html';
    const snapshot = join(candidateDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${provider}-${safeName(url)}.${ext}`);
    writeFileSync(snapshot, body);
    console.log(`PASS ${provider} ${url}`);
    console.log(`  Attempt: ${attempt}`);
    console.log(`  Snapshot: ${snapshot}`);
    console.log(`  Fields: ${JSON.stringify(providerSummary(ev, provider))}`);
    console.log(`  Summary: ${engine.importFieldSummary(ev, provider)}`);
  }catch(e){
    failures++;
    console.error(`FAIL ${provider} ${url}`);
    console.error(`  ${e.message}`);
  }
}

if(failures) process.exitCode = 1;
