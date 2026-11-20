// Fails unless every Lighthouse category scores at least the minimum (P3-T02: 80+). With several reports of
// the same page, each category's median counts: one run on a busy shared CI runner can score performance far
// below the page's real score (75 against a usual 90 to 98 with no code change).
// Usage: node scripts/lighthouse-check.mjs min report.json [report.json ...]
import { readFileSync } from 'node:fs';

const [min, ...files] = process.argv.slice(2);
if (!files.length || Number.isNaN(Number(min))) {
  console.error('Usage: node scripts/lighthouse-check.mjs min report.json [report.json ...]');
  process.exit(2);
}
const reports = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
let ok = true;
for (const id of Object.keys(reports[0].categories)) {
  const scores = reports.map((r) => r.categories[id].score);
  const m = median(scores);
  const pass = m >= Number(min);
  ok &&= pass;
  const runs = scores.map((s) => Math.round(s * 100)).join(', ');
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(16)} ${Math.round(m * 100)}  (runs: ${runs})`,
  );
}
process.exit(ok ? 0 : 1);
