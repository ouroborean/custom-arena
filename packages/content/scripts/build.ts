// Writes the validated content bundle as JSON (for clients/servers that shouldn't parse YAML).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContentOrThrow } from '../src/load.js';

const bundle = loadContentOrThrow();
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'content.json'), JSON.stringify(bundle));
writeFileSync(join(out, `content.${bundle.version}.json`), JSON.stringify(bundle));
console.log(`wrote dist/content.json (version ${bundle.version})`);
