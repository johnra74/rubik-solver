// Fails if the gzip size of first-load JS (entry chunks referenced by index.html) exceeds the budget.
// The lazily loaded solver worker chunk is excluded.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET = 300 * 1024;
const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
for (const src of scripts) {
  const file = join(dist, src.replace(/^.*?assets\//, 'assets/'));
  const size = gzipSync(readFileSync(file)).length;
  total += size;
  console.log(`${file}: ${(size / 1024).toFixed(1)} kB gzip`);
}
console.log(`first-load JS: ${(total / 1024).toFixed(1)} kB gzip (budget ${BUDGET / 1024} kB)`);
if (scripts.length === 0 || total > BUDGET) {
  console.error(scripts.length === 0 ? 'No entry scripts found in dist/index.html' : 'Bundle budget exceeded');
  process.exit(1);
}
