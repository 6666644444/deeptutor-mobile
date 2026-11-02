import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { verifyEnvelope, assetHash } from '../scripts/ota-protocol.mjs';
import { prepareCandidate, sealCandidate } from '../scripts/ota-package.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('signed release manifests bind the exact payload, runtime and repository asset hashes', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const base = 'https://github.com/TinyPandaGame/deeptutor-mobile/releases/download/v0.3.1/';
  const manifest = { id: randomUUID(), createdAt: new Date().toISOString(), runtimeVersion: 'runtime-a',
    metadata: { platform: 'android', releaseTag: 'v0.3.1' }, assets: [],
    launchAsset: { key: 'bundle', hash: assetHash(Buffer.from('bundle')), url: base + 'bundle.hbc', contentType: 'application/javascript' },
    extra: { expoClient: { extra: { releaseVersion: '0.3.1' } } } };
  const body = JSON.stringify(manifest);
  const envelope = { manifest: body, signature: sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64') };
  const target = { platform: 'android', runtime: 'runtime-a', tag: 'v0.3.1' };
  assert.equal(verifyEnvelope(envelope, publicKey, target).id, manifest.id);
  assert.throws(() => verifyEnvelope({ ...envelope, manifest: body.replace('bundle.hbc', 'malware.hbc') }, publicKey, target), /signature/);
  assert.throws(() => verifyEnvelope(envelope, publicKey, { ...target, runtime: 'old-native' }), /Incompatible/);
  const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
  assert.throws(() => verifyEnvelope(envelope, wrongKey, target), /signature/);
});

test('release sealing rejects stale acceptance evidence and verifies the signed output', async t => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dtm-ota-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'export'), output = path.join(root, 'candidate');
  mkdirSync(directory);
  writeFileSync(path.join(directory, 'bundle.hbc'), 'synthetic test bundle');
  writeFileSync(path.join(directory, 'metadata.json'), JSON.stringify({ fileMetadata: { android: { bundle: 'bundle.hbc', assets: [] } } }));
  const candidate = prepareCandidate({ directory, output, platform: 'android', runtime: 'native-a', version: '0.3.1',
    config: { extra: {}, _internal: { projectRoot: '/private/build' }, updates: { codeSigningCertificate: '/private/build/cert' } } });
  const manifest = JSON.parse(readFileSync(candidate.path));
  assert.equal(manifest.extra.expoClient._internal, undefined);
  assert.equal(manifest.extra.expoClient.updates, undefined);
  const evidence = path.join(root, 'acceptance.json');
  const record = { candidateSha256: candidate.hash, updateId: candidate.id, platform: 'android', runtimeVersion: 'native-a',
    unitTests: 'passed', nativeDownload: 'passed', coldRestart: 'passed', learningSmoke: 'passed', result: 'passed' };
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const args = { candidate: candidate.path, evidence, privateKey, certificate: publicKey, output };
  writeFileSync(evidence, JSON.stringify({ ...record, coldRestart: 'pending' }));
  assert.throws(() => sealCandidate(args), /Acceptance evidence/);
  writeFileSync(evidence, JSON.stringify({ ...record, candidateSha256: 'outdated' }));
  assert.throws(() => sealCandidate(args), /Acceptance evidence/);
  writeFileSync(evidence, JSON.stringify(record));
  const file = await sealCandidate(args);
  const envelope = JSON.parse(readFileSync(file));
  assert.equal(verifyEnvelope(envelope, publicKey, { platform: 'android', runtime: 'native-a', tag: 'v0.3.1' }).id, candidate.id);
  assert.throws(() => prepareCandidate({ directory, output, platform: 'android', runtime: 'native-a', version: '../../wrong', config: {} }), /Invalid target/);
});
