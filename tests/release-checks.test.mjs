import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('public release checks reject private credentials and unsafe archives', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_*.py'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
