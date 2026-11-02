import test from 'node:test';
import assert from 'node:assert/strict';
import { connection } from '../src/lib/connection.ts';

test('short addresses infer LAN HTTP and public HTTPS without changing explicit schemes', () => {
  for (const [input, output] of [
    ['192.168.1.20:3782', 'http://192.168.1.20:3782'],
    ['tutor.local:3782', 'http://tutor.local:3782'],
    ['[fd00::20]:3782', 'http://[fd00::20]:3782'],
    [' study.example.com ', 'https://study.example.com'],
    ['study.example.com:8443', 'https://study.example.com:8443'],
    ['https://192.168.1.20:3782', 'https://192.168.1.20:3782'],
  ]) assert.equal(connection(input, 'server').origin, output);
});

test('short addresses retain credential, public cleartext, loopback and path boundaries', () => {
  for (const input of ['localhost:3782', '127.1:3782', '[::1]:3782', '//evil.test',
    'user:password@example.com', 'study.example.com/api', 'study.example.com?x=y',
    'http://study.example.com', 'ftp://192.168.1.1', 'study.example.com\\evil',
    'study.example.com\n.evil', '192.168.fake.com:3782/path'])
    assert.throws(() => connection(input, 'server'), input);
});
