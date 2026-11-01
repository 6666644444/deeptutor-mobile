import { readFileSync, writeFileSync } from 'node:fs';
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const rows = Object.entries(lock.packages).filter(([p]) => p).map(([p, v]) => ({ package: p.split('node_modules/').at(-1), version: v.version, license: v.license || 'UNKNOWN', developmentOnly: !!v.dev, resolved: v.resolved }));
if (rows.some(row => row.license === 'UNKNOWN')) throw Error('Missing package license metadata; review before publishing.');
writeFileSync('docs/dependency-licenses.json', JSON.stringify({ lockfileVersion: lock.lockfileVersion, packages: rows }, null, 2) + '\n');
console.log(`${rows.length} dependency license entries generated.`);
