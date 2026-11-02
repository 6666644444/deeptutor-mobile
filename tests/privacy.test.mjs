import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicText } from '../scripts/source-check.mjs';

test('privacy checks reject contact addresses, home paths and actual token formats', () => {
  const personalContact = ['reviewer', 'mail.example'].join('@');
  assert.throws(() => assertPublicText('commit metadata', personalContact), /contact address/);
  assert.throws(() => assertPublicText('README.md', ['', 'Users', 'test-user', 'notes.txt'].join('/')), /private material/);
  for (const prefix of ['ghp_', 'github_pat_', 'sk-'])
    assert.throws(() => assertPublicText('config.js', prefix + 'A'.repeat(40)), /private material/);
  for (const kind of ['', 'RSA ', 'EC ', 'OPENSSH ', 'ENCRYPTED ', 'DSA '])
    assert.throws(() => assertPublicText('signing.pem', '-----BEGIN ' + kind + 'PRIVATE KEY-----'), /private material/);
  assert.throws(() => assertPublicText('photo.jpg', 'placeholder'), /binary/);
});

test('privacy checks preserve dependency attribution and nonpersonal project identity', () => {
  const dependencyContact = ['author', 'upstream.example'].join('@');
  assert.doesNotThrow(() => assertPublicText('docs/third-party-license-texts.txt', dependencyContact));
  assert.doesNotThrow(() => assertPublicText('commit metadata', 'DeepTutor Mobile contributors <contributors@deeptutor-mobile.invalid>'));
  assert.doesNotThrow(() => assertPublicText('fixture.txt', 'demo / demo-pass'));
});
