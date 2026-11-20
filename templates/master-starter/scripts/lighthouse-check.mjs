// Fails unless every Lighthouse category of the given report scores at least the minimum (P3-T02: 80+).
// Usage: node scripts/lighthouse-check.mjs report.json [min=0.8]
import { readFileSync } from 'node:fs';

const [file, min = '0.8'] = process.argv.slice(2);
const report = JSON.parse(readFileSync(file, 'utf8'));
let ok = true;
for (const [id, c] of Object.entries(report.categories)) {
  const pass = c.score >= Number(min);
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(16)} ${Math.round(c.score * 100)}`);
}
process.exit(ok ? 0 : 1);
