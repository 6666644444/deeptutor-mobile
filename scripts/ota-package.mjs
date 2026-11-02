import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { randomUUID, sign } from 'node:crypto';
import { assetHash, assetName, REPOSITORY } from './ota-protocol.mjs';
import { parseVersion } from '../src/lib/updates.ts';

// Candidate construction does not publish. Signing happens only after a
// successful acceptance record matches this exact exported candidate.
export function prepareCandidate({ directory, config, platform, runtime, version, output, assetBase }) {
  if (!['android', 'ios'].includes(platform) || !/^[\w.-]{1,128}$/.test(runtime) || !parseVersion(version) || version.startsWith('v')) throw Error('Invalid target');
  const root = realpathSync(directory);
  const metadata = JSON.parse(readFileSync(path.join(root, 'metadata.json')));
  const files = metadata.fileMetadata[platform];
  if (!files) throw Error('Missing platform export');
  const base = assetBase || `https://github.com/${REPOSITORY}/releases/download/v${version}/`;
  mkdirSync(output, { recursive: true });
  function asset(relative, ext, launch = false) {
    const file = realpathSync(path.resolve(root, relative));
    if (!file.startsWith(root + path.sep)) throw Error('Asset outside export');
    const data = readFileSync(file), hash = assetHash(data);
    const extension = launch ? 'hbc' : ext;
    if (!/^[\w]+$/.test(extension)) throw Error('Invalid extension');
    const name = `ota-${platform}-${hash}.${extension}`;
    writeFileSync(path.join(output, name), data);
    const contentType = launch ? 'application/javascript' : ({ png: 'image/png', jpg: 'image/jpeg', ttf: 'font/ttf', otf: 'font/otf' }[extension] || 'application/octet-stream');
    return { key: hash, hash, fileExtension: '.' + extension, contentType, url: base + name };
  }
  const manifest = {
    id: randomUUID(), createdAt: new Date().toISOString(), runtimeVersion: runtime,
    launchAsset: asset(files.bundle, 'hbc', true),
    assets: files.assets.map(a => asset(a.path, a.ext)),
    metadata: { platform, releaseTag: `v${version}` },
    extra: { expoClient: { ...config, extra: { ...config.extra, releaseVersion: version } } },
  };
  // Native signing file paths and any private build-machine settings must not
  // be copied into a public runtime manifest.
  delete manifest.extra.expoClient.updates;
  delete manifest.extra.expoClient._internal;
  const body = JSON.stringify(manifest);
  const filename = path.join(output, `candidate-${platform}-${runtime}.json`);
  writeFileSync(filename, body);
  return { path: filename, hash: assetHash(Buffer.from(body)), id: manifest.id };
}
export function sealCandidate({ candidate, evidence, privateKey, certificate, output }) {
  const body = readFileSync(candidate, 'utf8');
  const manifest = JSON.parse(body), record = JSON.parse(readFileSync(evidence));
  if (record.candidateSha256 !== assetHash(Buffer.from(body)) || record.updateId !== manifest.id ||
      record.platform !== manifest.metadata.platform || record.runtimeVersion !== manifest.runtimeVersion ||
      record.unitTests !== 'passed' || record.nativeDownload !== 'passed' || record.coldRestart !== 'passed' ||
      record.learningSmoke !== 'passed' || record.result !== 'passed')
    throw Error('Acceptance evidence does not approve this exact candidate');
  const envelope = { manifest: body, signature: sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64') };
  // Importing lazily keeps construction and verification usable in tests.
  return import('./ota-protocol.mjs').then(({ verifyEnvelope }) => {
    verifyEnvelope(envelope, certificate, { platform: manifest.metadata.platform, runtime: manifest.runtimeVersion, tag: manifest.metadata.releaseTag });
    const file = path.join(output, assetName(manifest.metadata.platform, manifest.runtimeVersion));
    writeFileSync(file, JSON.stringify(envelope));
    return file;
  });
}
