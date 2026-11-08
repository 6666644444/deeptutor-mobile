import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { request } from 'node:http';

test('published mock serves the actual list/upload/PDF contracts and isolates account, service and workspace', { timeout: 15000 }, async t => {
  const base = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['scripts/mock-service.mjs', '--base-port', String(base)], { stdio: 'pipe' });
  let logs = ''; child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
  t.after(async () => { if (child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGINT'); await ended; } });
  for (let i = 0; i < 100 && !logs.includes(`:${base + 2}`); i++) { if (child.exitCode !== null) throw Error(logs); await delay(30); }
  assert.match(logs, /Fixture 服务乙/);
  const origin = `http://127.0.0.1:${base}`;
  const login = async (at, username) => {
    const r = await fetch(at + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'demo-pass' }) });
    assert.equal(r.status, 200); return /dt_token=([^;]+)/.exec(r.headers.get('set-cookie'))[1];
  };
  const token = await login(origin, 'demo');
  const handshake = headers => new Promise((resolve, reject) => {
    const req = request(origin + '/ws', { headers: { ...headers, Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' } });
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
    req.on('response', res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(await handshake({ Authorization: `Bearer ${token}` }), 401);
  assert.equal(await handshake({ Cookie: `dt_token=${token}` }), 101);
  const attachmentBytes = Buffer.from('synthetic-attachment '.repeat(5000));
  const sessionId = await new Promise((resolve, reject) => {
    const req = request(origin + '/ws', { headers: { Cookie: `dt_token=${token}`, Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' } });
    req.on('error', reject);
    req.on('upgrade', (_res, socket) => {
      const payload = Buffer.from(JSON.stringify({ type: 'start_turn', content: 'attachment persistence fixture', attachments: [{ type: 'file', filename: 'fixture.txt', mime_type: 'text/plain', base64: attachmentBytes.toString('base64') }] }));
      const header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2);
      let buffer = Buffer.alloc(0);
      socket.on('error', reject);
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 2) {
          let size = buffer[1] & 127, offset = 2;
          if (size === 126) { if (buffer.length < 4) return; size = buffer.readUInt16BE(2); offset = 4; }
          if (buffer.length < offset + size) return;
          const event = JSON.parse(buffer.subarray(offset, offset + size)); buffer = buffer.subarray(offset + size);
          if (event.type === 'done') { socket.destroy(); resolve(event.session_id); return; }
        }
      });
      socket.write(Buffer.concat([header, payload]));
    }); req.end();
  });
  const headers = { Authorization: `Bearer ${token}` };
  const read = async (path, extra = {}) => (await fetch(origin + path, { headers: { ...headers, ...extra } })).json();
  const session = await read(`/api/sessions/${sessionId}`);
  const stored = session.messages[0].attachments[0];
  assert.equal(stored.base64, undefined); assert.ok(stored.url.startsWith('/files/attachments/'));
  assert.deepEqual(Buffer.from(await (await fetch(origin + stored.url, { headers })).arrayBuffer()), attachmentBytes);
  assert.equal((await fetch(origin + stored.url, { headers: { ...headers, 'X-DeepTutor-Workspace': 'another' } })).status, 404);
  assert.deepEqual(await read('/api/question-notebook/entries?mistakes_only=true'), { items: [], total: 0 });
  const body = new FormData(); body.append('file', new Blob(['fixture-document']), 'fixture.txt');
  const uploaded = await (await fetch(origin + '/api/reading/materials', { method: 'POST', headers, body })).json();
  assert.ok(uploaded.material_id);
  assert.equal((await read('/api/reading/materials')).length, 1);
  assert.deepEqual(await read('/api/reading/materials', { 'X-DeepTutor-Workspace': 'another' }), []);
  const other = await login(origin, 'other');
  assert.equal((await fetch(origin + stored.url, { headers: { Authorization: `Bearer ${other}` } })).status, 404);
  assert.deepEqual(await read('/api/reading/materials', { Authorization: `Bearer ${other}` }), []);
  const second = `http://127.0.0.1:${base + 2}`;
  const secondToken = await login(second, 'demo');
  assert.deepEqual(await (await fetch(second + '/api/reading/materials', { headers: { Authorization: `Bearer ${secondToken}` } })).json(), []);
  const pdf = await fetch(origin + '/api/reading/materials/fixture-pdf/raw', { headers });
  assert.match(pdf.headers.get('content-type'), /application\/pdf/); assert.match(await pdf.text(), /^%PDF-1.4/);
  assert.equal((await fetch(origin + '/api/not-implemented', { headers })).status, 404);
  assert.equal((await fetch(origin + '/api/notebooks', { method: 'POST', headers, body: '{}' })).status, 404);
  assert.equal((await (await fetch(`http://127.0.0.1:${base + 1}/api/auth/status`)).json()).enabled, false);
});
