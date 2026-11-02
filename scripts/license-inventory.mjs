import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const licenseOf = (p, v) => {
  if (v.license) return v.license;
  // This exact package omits the JSON field; its distributed license was reviewed.
  if (p.endsWith('/khroma') && v.version === '2.1.0' && readFileSync(p + '/license', 'utf8').startsWith('The MIT License (MIT)')) return 'MIT';
  return 'UNKNOWN';
};
const entries = Object.entries(lock.packages).filter(([p]) => p);
const rows = entries.map(([p, v]) => ({ package: p.split('node_modules/').at(-1), version: v.version, license: licenseOf(p, v), developmentOnly: !!v.dev, resolved: v.resolved }));
if (rows.some(row => row.license === 'UNKNOWN')) throw Error('Missing package license metadata; review before publishing.');
writeFileSync('docs/dependency-licenses.json', JSON.stringify({ lockfileVersion: lock.lockfileVersion, packages: rows }, null, 2) + '\n');
let missing = 0, installed = 0;
const texts = [];
for (const [p, v] of entries) {
  if (!existsSync(p)) continue;
  installed++;
  const names = readdirSync(p).filter(n => /^(licen[cs]e|notice|copying)([.-]|$)/i.test(n) && statSync(p + '/' + n).isFile()).sort();
  if (!names.length) missing++;
  for (const name of names) texts.push(`PACKAGE ${p.split('node_modules/').at(-1)} ${v.version} — ${name}\n\n${readFileSync(p + '/' + name, 'utf8')}\n`);
}
// Normalize line endings/trailing space only; keep all license words and notices.
writeFileSync('docs/third-party-license-texts.txt', texts.join('\n----------------------------------------\n\n').split(/\r?\n/).map(line => line.trimEnd()).join('\n').trimEnd() + '\n');
console.log(`${rows.length} dependency license entries; ${installed} installed packages; ${missing} without top-level license texts.`);
