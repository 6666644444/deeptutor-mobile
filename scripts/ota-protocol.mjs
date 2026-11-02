import { createHash, verify } from 'node:crypto';
import { RELEASES_URL } from '../src/lib/updates.ts';

export const REPOSITORY = 'TinyPandaGame/deeptutor-mobile';
export const assetName = (platform, runtime) => `ota-${platform}-${runtime}.json`;
export const assetHash = bytes => createHash('sha256').update(bytes).digest('base64url');
export function verifyEnvelope(envelope, certificate, { platform, runtime, tag, localAssetOrigin }) {
  if (!envelope || typeof envelope.manifest !== 'string' || typeof envelope.signature !== 'string' ||
      !verify('RSA-SHA256', Buffer.from(envelope.manifest), certificate, Buffer.from(envelope.signature, 'base64')))
    throw Error('Invalid OTA signature');
  const manifest = JSON.parse(envelope.manifest);
  if (manifest.runtimeVersion !== runtime || manifest.metadata?.platform !== platform || manifest.metadata?.releaseTag !== tag ||
      !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(manifest.id) || !Number.isFinite(Date.parse(manifest.createdAt)) ||
      manifest.extra?.expoClient?.extra?.releaseVersion !== tag.replace(/^v/, '') || !Array.isArray(manifest.assets))
    throw Error('Incompatible OTA manifest');
  for (const asset of [manifest.launchAsset, ...manifest.assets]) {
    const prefix = localAssetOrigin || `${RELEASES_URL}/download/${encodeURIComponent(tag)}/`;
    if (!asset || !/^[\w-]{43}$/.test(asset.hash) || typeof asset.key !== 'string' ||
        typeof asset.url !== 'string' || !asset.url.startsWith(prefix) ||
        !/^[\w.-]+$/.test(asset.url.slice(prefix.length)) || typeof asset.contentType !== 'string')
      throw Error('Untrusted OTA asset');
  }
  return manifest;
}

