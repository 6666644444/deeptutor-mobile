import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('Python startup and release regressions run in the standard test command', () => {
  const executable = process.platform === 'win32' ? 'python' : 'python3';
  const result = spawnSync(executable, ['-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_*.py'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
