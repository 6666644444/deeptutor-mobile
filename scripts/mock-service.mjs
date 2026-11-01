// Local contract fixture only. No DeepTutor, model, personal data or external traffic.
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { parseArgs } from 'node:util';
import { isPrivateHost } from '../src/lib/connection.ts';
const { values } = parseArgs({ options: { host: { type: 'string', default: '127.0.0.1' }, 'base-port': { type: 'string', default: '8786' } } });
const host = values.host, basePort = Number(values['base-port']);
const localAddresses = Object.values(networkInterfaces()).flat().filter(Boolean).map(item => item.address);
if (host !== '127.0.0.1' && (!isPrivateHost(host) || !localAddresses.includes(host)))
  throw Error('--host must be loopback or an explicit private address assigned to this computer.');
if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65533) throw Error('--base-port must be 1024..65533.');
const servers = [];
for (const [port, label, enabled] of [[basePort, '服务甲', true], [basePort + 1, '单用户演示', false], [basePort + 2, '服务乙', true]]) {
  const tokens = new Map(), materials = new Map(), sessions = new Map();
  const userFor = req => {
    if (!enabled) return 'local-admin';
    const token = req.headers.authorization?.replace(/^Bearer /, '') || /dt_token=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    return tokens.get(token);
  };
  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fixture').pathname;
    const json = (data, code = 200, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(data)); };
    if (path === '/api/auth/status') { const user = userFor(req); return json({ enabled, authenticated: !!user, user_id: user || null, username: user || null, role: user ? 'admin' : null }); }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (path === '/api/auth/login') {
      const data = JSON.parse(body.toString() || '{}');
      if (!['demo', 'other'].includes(data.username) || data.password !== 'demo-pass') return json({ detail: 'Invalid fixture login' }, 401);
      const token = randomUUID(); tokens.set(token, data.username);
      return json({ ok: true, user_id: data.username, username: data.username, role: 'admin' }, 200, { 'Set-Cookie': `dt_token=${token}; Path=/; HttpOnly; SameSite=Lax` });
    }
    // Test-only reset on this explicitly selected local fixture.
    if (path === '/__fixture/expire') { tokens.clear(); return json({ expired: true }); }
    const user = userFor(req);
    if (!user) return json({ detail: 'Not authenticated' }, 401);
    if (path === '/api/reading/materials') {
      if (req.method === 'POST') {
        if (!req.headers['content-type']?.includes('multipart/form-data') || !body.includes('fixture-document')) return json({ detail: 'Fixture file missing' }, 400);
        const items = materials.get(user) || [];
        items.push({ material_id: randomUUID(), title: `${label} · ${user} 的测试资料`, filename: 'fixture.txt', unit_count: 1, unit: 'page', byte_size: body.length }); materials.set(user, items);
      }
      return json(materials.get(user) || []);
    }
    if (path === '/api/notebooks') return json({ notebooks: [] });
    if (path.includes('stats')) return json({ total: 0, wrong: 0, unresolved: 0, bookmarked: 0 });
    if (path.includes('question')) return json(path.includes('categories') ? [] : { questions: [], total: 0 });
    if (path === '/api/sessions') return json({ sessions: [...sessions.values()].filter(x => x.owner === user) });
    if (path.startsWith('/api/sessions/')) return json(sessions.get(path.split('/').at(-1)) || {}, 200);
    if (path === '/api/fixture-file') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(`fixture-document ${label} ${user}`); }
    if (path.startsWith('/api/')) return json({});
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="padding:24px;font:20px system-ui"><h1>内嵌模块验证</h1><p>${label}</p><p>当前身份：${user}</p><p>这是虚拟服务，不是 DeepTutor 模型。</p><a href="/api/fixture-file">测试文件</a></body></html>`);
  });
  server.on('upgrade', (req, socket) => {
    const user = userFor(req); if (!user || req.url !== '/ws') { socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n'); return; }
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const send = value => { const data = Buffer.from(JSON.stringify(value)); const header = data.length < 126 ? Buffer.from([129, data.length]) : Buffer.from([129, 126, data.length >> 8, data.length & 255]); socket.write(Buffer.concat([header, data])); };
    let buffer = Buffer.alloc(0);
    socket.on('error', () => {});
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const opcode = buffer[0] & 15; let n = buffer[1] & 127, offset = 2;
        if (n === 126) { if (buffer.length < 4) return; n = buffer.readUInt16BE(2); offset = 4; }
        if (n === 127) { socket.end(); return; }
        const mask = !!(buffer[1] & 128); if (buffer.length < offset + (mask ? 4 : 0) + n) return;
        const key = buffer.subarray(offset, offset + 4); if (mask) offset += 4;
        const data = Buffer.from(buffer.subarray(offset, offset + n)); if (mask) for (let i = 0; i < data.length; i++) data[i] ^= key[i % 4];
        buffer = buffer.subarray(offset + n); if (opcode === 8) { socket.end(); return; } if (opcode !== 1) continue;
        const value = JSON.parse(data.toString()); if (value.type !== 'start_turn') continue;
        const id = randomUUID(), answer = `${label} / ${user}：已收到测试问题。这是流式协议演示，不是模型答案。`;
        sessions.set(id, { id, owner: user, title: '虚拟测试对话', messages: [{ id: 'u', role: 'user', content: value.content }, { id: 'a', role: 'assistant', content: answer }] });
        send({ type: 'content', content: answer.slice(0, 12), session_id: id, seq: 1 });
        setTimeout(() => { if (!socket.destroyed) { send({ type: 'content', content: answer.slice(12), session_id: id, seq: 2 }); send({ type: 'done', session_id: id, seq: 3 }); } }, 250);
      }
    });
  });
  server.listen(port, host, () => console.log(`Fixture ${label}: http://${host}:${port}${host === '127.0.0.1' ? ` (Android emulator: http://10.0.2.2:${port})` : ' (trusted LAN only; demo data, no real credentials)'}`)); servers.push(server);
}
const stop = () => { for (const server of servers) server.close(); process.exit(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
