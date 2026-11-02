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
// Small synthetic document, generated in memory; never imports a user's file.
function fixturePdf() {
  const text = 'BT /F1 24 Tf 40 150 Td (DeepTutor public PDF fixture) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
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
    const owner = `${user}:${req.headers['x-deeptutor-workspace'] || ''}`;
    if (req.method !== 'GET' && !(req.method === 'POST' && path === '/api/reading/materials') && !(req.method === 'PUT' && path === '/api/reading/materials/fixture-pdf/position'))
      return json({ detail: 'This write is not implemented by the local fixture' }, 404);
    const document = { material_id: 'fixture-pdf', title: `${label} / ${user} · PDF演示`, filename: 'fixture.pdf', render_mode: 'pdf', has_raw_view: true, unit_count: 1, unit: 'page', revision: 1, status: 'ready' };
    if (path === '/api/reading/library/materials') return json({ materials: [document] });
    if (path === '/api/reading/workspaces') return json({ workspaces: [] });
    if (path === '/api/reading/supported-formats') return json({ extensions: ['.pdf', '.docx', '.txt'] });
    if (path === '/api/reading/materials/fixture-pdf') return json(document);
    if (path === '/api/reading/materials/fixture-pdf/raw') { res.writeHead(200, { 'Content-Type': 'application/pdf' }); return res.end(fixturePdf()); }
    if (path === '/api/reading/materials/fixture-pdf/position') return json({ locator: 1 });
    if (path === '/api/reading/materials/fixture-pdf/units/1') return json({ text: '虚拟教材：$\\frac{1}{2}+\\frac{1}{2}=1$。' });
    if (path === '/api/reading/materials/fixture-pdf/bookmarks') return json({ bookmarks: [] });
    if (['/api/reading/materials/fixture-pdf/media', '/api/reading/materials/fixture-pdf/annotations', '/api/knowledge-bases', '/api/partners'].includes(path)) return json([]);
    const emptyLists = { '/api/books': 'books', '/api/books/block-types': 'block_types', '/api/documents': 'documents', '/api/memory/overview': 'docs', '/api/mastery-paths/topics': 'topics', '/api/calendar/events': 'occurrences', '/api/calendar/calendars': 'calendars', '/api/personas': 'personas', '/api/capabilities/registered': 'capabilities' };
    if (path in emptyLists) return json({ [emptyLists[path]]: [], can_create: false });
    if (path === '/api/settings/workspace/registrations') return json({ workspaces: [{ workspace_id: 'fixture-workspace', display_name: '虚拟工作区', status: 'active' }] });
    if (path === '/api/settings/workspace') return json({ workspace_id: req.headers['x-deeptutor-workspace'] || '', display_name: '虚拟工作区' });
    if (path === '/api/reading/materials') {
      if (req.method === 'POST') {
        if (!req.headers['content-type']?.includes('multipart/form-data') || !body.includes('fixture-document')) return json({ detail: 'Fixture file missing' }, 400);
        const items = materials.get(owner) || [];
        const item = { material_id: randomUUID(), title: `${label} · ${user} 的测试资料`, filename: 'fixture.txt', unit_count: 1, unit: 'page', byte_size: body.length };
        items.push(item); materials.set(owner, items);
        return json(item);
      }
      return json(materials.get(owner) || []);
    }
    if (path === '/api/notebooks') return json({ notebooks: [] });
    if (path.includes('stats')) return json({ total: 0, wrong: 0, unresolved: 0, bookmarked: 0 });
    if (path === '/api/question-notebook/entries') return json({ items: [], total: 0 });
    if (path === '/api/question-notebook/categories') return json([]);
    if (path === '/api/sessions') return json({ sessions: [...sessions.values()].filter(x => x.owner === owner) });
    if (path.startsWith('/api/sessions/')) { const session = sessions.get(path.split('/').at(-1)); return session?.owner === owner ? json(session) : json({ detail: 'Not found' }, 404); }
    if (path === '/api/fixture-file') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(`fixture-document ${label} ${user}`); }
    if (path.startsWith('/api/')) return json({ detail: 'Not implemented by the local fixture' }, 404);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="padding:24px;font:20px system-ui"><h1>虚拟协议测试服务</h1><p>${label}</p><p>当前身份：${user}</p><p>这是虚拟服务，不是 DeepTutor 模型。</p><a href="/api/fixture-file">测试文件</a></body></html>`);
  });
  server.on('upgrade', (req, socket) => {
    // Match the real WS endpoint: a REST Bearer header alone is not accepted.
    const user = enabled ? tokens.get(/(?:^|;\s*)dt_token=([^;]+)/.exec(req.headers.cookie || '')?.[1]) : 'local-admin';
    if (!user || req.url !== '/ws') { socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n'); return; }
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
        buffer = buffer.subarray(offset + n); if (opcode === 8) { socket.end(Buffer.from([0x88, 0])); return; } if (opcode !== 1) continue;
        const value = JSON.parse(data.toString()); if (value.type !== 'start_turn') continue;
        const id = randomUUID(), answer = `${label} / ${user}：已收到测试问题。这是流式协议演示，不是模型答案。`;
        sessions.set(id, { id, owner: `${user}:${req.headers['x-deeptutor-workspace'] || ''}`, title: '虚拟测试对话', messages: [{ id: 'u', role: 'user', content: value.content }, { id: 'a', role: 'assistant', content: answer }] });
        send({ type: 'content', content: answer.slice(0, 12), session_id: id, seq: 1 });
        setTimeout(() => { if (!socket.destroyed) {
          send({ type: 'content', content: answer.slice(12), session_id: id, seq: 2 });
          if (String(value.content).includes('render')) {
            const event = { type: 'result', session_id: id, seq: 3, metadata: { data: [
            { text: '公式：$\\frac{1}{2}+\\frac{1}{2}=1$' },
            { render_type: 'mermaid', code: 'graph TD\nA[Start]-->B[Learn]' },
            { render_type: 'chartjs', code: JSON.stringify({ type: 'bar', data: { labels: ['A', 'B'], datasets: [{ label: 'Fixture', data: [2, 3] }] } }) },
            ] } };
            sessions.get(id).messages[1].events = [event];
            send(event);
          }
          send({ type: 'done', session_id: id, seq: 4 });
        } }, 250);
      }
    });
  });
  server.listen(port, host, () => console.log(`Fixture ${label}: http://${host}:${port}${host === '127.0.0.1' ? ` (Android emulator: http://10.0.2.2:${port})` : ' (trusted LAN only; demo data, no real credentials)'}`)); servers.push(server);
}
const stop = () => { for (const server of servers) server.close(); process.exit(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
