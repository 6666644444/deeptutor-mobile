import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { prepareCandidate, sealCandidate } from './ota-package.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: Object.fromEntries(
  ['export', 'config', 'platform', 'runtime', 'version', 'output', 'candidate', 'evidence', 'private-key', 'certificate']
    .map(name => [name, { type: 'string' }]),
) });
function required(name) {
  if (!values[name]) throw Error(`Missing --${name}`);
  return values[name];
}
try {
  if (positionals[0] === 'prepare') {
    const result = prepareCandidate({ directory: required('export'), config: JSON.parse(readFileSync(required('config'), 'utf8')),
      platform: required('platform'), runtime: required('runtime'), version: required('version'), output: required('output') });
    console.log(JSON.stringify(result, null, 2));
  } else if (positionals[0] === 'seal') {
    const output = path.resolve(required('output'));
    mkdirSync(output, { recursive: true });
    const file = await sealCandidate({ candidate: required('candidate'), evidence: required('evidence'),
      privateKey: readFileSync(required('private-key')), certificate: readFileSync(required('certificate')), output });
    console.log(file);
  } else {
    throw Error('Usage: node --experimental-strip-types scripts/ota-release.mjs prepare|seal --… (see docs/updates.md)');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to package update');
  process.exitCode = 1;
}
