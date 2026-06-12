import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadFixture(provider, name){
  return readFileSync(join(here, provider, name), 'utf8');
}

export function providerFixtures(provider){
  return readdirSync(join(here, provider))
    .filter(name => !name.startsWith('.'))
    .map(name => ({ name, content: loadFixture(provider, name) }));
}
