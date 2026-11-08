// Local contract fixture only. No DeepTutor, model, personal data or external traffic.
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { parseArgs } from 'node:util';
import { isPrivateHost } from '../src/lib/connection.ts';
const { values } = parseArgs({ options: { host: { type: 'string', default: '127.0.0.1' }, 'base-port': { type: 'string', default: '8786' }, 'user-models': { type: 'boolean', default: false } } });
const host = values.host, basePort = Number(values['base-port']);
const localAddresses = Object.values(networkInterfaces()).flat().filter(Boolean).map(item => item.address);
if (host !== '127.0.0.1' && (!isPrivateHost(host) || !localAddresses.includes(host)))
  throw Error('--host must be loopback or an explicit private address assigned to this computer.');
if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65533) throw Error('--base-port must be 1024..65533.');
const servers = [];
// Small synthetic document, generated in memory; never imports a user's file.
function fixturePdf() {
  const text = 'BT /F1 24 Tf 40 150 Td (DeepTutor public PDF fixture) Tj ET';
  const second = 'BT /F1 24 Tf 40 150 Td (Second page for navigation check) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>',
    `<< /Length ${second.length} >>\nstream\n${second}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
for (const [port, label, enabled] of [[basePort, '服务甲', true], [basePort + 1, '单用户演示', false], [basePort + 2, '服务乙', true]]) {
  const tokens = new Map(), materials = new Map(), sessions = new Map(), personal = new Map();
  const passwords = new Map(), displays = new Map(), attachments = new Map();
  let messageSequence = 0;
  const role = values['user-models'] ? 'user' : 'admin';
  const userFor = req => {
    if (!enabled) return 'local-admin';
    const token = req.headers.authorization?.replace(/^Bearer /, '') || /dt_token=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    return tokens.get(token);
  };
  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fixture').pathname;
    const json = (data, code = 200, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(data)); };
    if (path === '/api/auth/status') { const user = userFor(req); return json({ enabled, authenticated: !!user, user_id: user || null, username: user || null, role: user ? role : null }); }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (path === '/api/auth/login') {
      const data = JSON.parse(body.toString() || '{}');
      if (!['demo', 'other'].includes(data.username) || data.password !== (passwords.get(data.username) || 'demo-pass')) return json({ detail: 'Invalid fixture login' }, 401);
      const token = randomUUID(); tokens.set(token, data.username);
      return json({ ok: true, user_id: data.username, username: data.username, role }, 200, { 'Set-Cookie': `dt_token=${token}; Path=/; HttpOnly; SameSite=Lax` });
    }
    // Test-only reset on this explicitly selected local fixture.
    if (path === '/__fixture/expire') { tokens.clear(); return json({ expired: true }); }
    const user = userFor(req);
    if (!user) return json({ detail: 'Not authenticated' }, 401);
    const owner = `${user}:${req.headers['x-deeptutor-workspace'] || ''}`;
    if (path.startsWith('/files/attachments/')) {
      const item = attachments.get(path);
      if (!item || item.owner !== owner) return json({ detail: 'Not found' }, 404);
      res.writeHead(200, { 'Content-Type': item.mime, 'Cache-Control': 'no-store' });
      return res.end(item.bytes);
    }
    if (path === '/api/auth/profile') return json({ id: user, username: user, role, can_change_password: enabled, must_change_password: false });
    if (path === '/api/auth/profile/learner-profile') return json({ detail: 'Learner profile required' }, 403);
    if (path === '/api/auth/profile/password' && req.method === 'PUT') {
      const data = JSON.parse(body.toString());
      if (data.current_password !== (passwords.get(user) || 'demo-pass')) return json({ detail: 'Current password is incorrect' }, 400);
      if (data.new_password.length < 8 || data.current_password === data.new_password) return json({}, 422);
      passwords.set(user, data.new_password); return json({ ok: true });
    }
    if (path === '/api/settings/display') return json(displays.get(user) || { content_font_scale: 100, content_line_spacing: 'normal' });
    if (path === '/api/settings/ui' && req.method === 'PUT') { const data = JSON.parse(body.toString()); displays.set(user, data); return json(data); }
    const threadMatch = /^\/api\/sessions\/([^/]+)\/threads$/.exec(path);
    if (threadMatch) return json({ threads: [...sessions.values()].filter(s => s.owner === owner && s.preferences.parent_session_id === threadMatch[1]) });
    const organizationMatch = /^\/api\/sessions\/([^/]+)\/(organization|branch-selection)$/.exec(path);
    if (organizationMatch) {
      const session = sessions.get(organizationMatch[1]);
      if (!session || session.owner !== owner) return json({},404);
      const data = JSON.parse(body.toString() || '{}');
      Object.assign(session.preferences, data);
      return json({ session, selected_branches: data.selected_branches });
    }
    if (path === '/api/documents/flashcards/export' || path === '/api/documents/fixture-note/flashcards/export') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('#separator:tab\n#html:true\n3×4等于几？\t12\n'); }
    if (path === '/api/documents/fixture-note') return json({ id: 'fixture-note', title: '闪卡导出演示', content: '', version: 1, blocks: [{ id: 'cards', type: 'learning', props: { kind: 'flashcards', data: JSON.stringify({ cards: [{ front: '3×4等于几？', back: '12' }] }) } }] });
    if (path === '/api/documents/fixture-note/suggestions') return json({ suggestions: [] });
    if (path === '/api/documents') return json({ documents: [{ id: 'fixture-note', title: '闪卡导出演示', preview: '仅供测试，不是真实学习资料' }] });
    const modelState = personal.get(user) || { profiles: [], active: null };
    const providers = [{ value: 'custom', label: 'Custom (OpenAI API)', base_url: 'https://api.example.com/v1', api_formats: ['auto', 'openai_chat'] }, { value: 'deepseek', label: 'DeepSeek', base_url: 'https://api.example.com/v1', api_formats: ['auto', 'openai_chat'] }];
    const publicModels = () => ({ ...modelState, profiles: modelState.profiles.map(({ api_key, ...p }) => ({ ...p, has_key: !!api_key })), providers });
    if (path === '/api/settings/llm-options' || path === '/api/mobile/models/options') {
      const shared = { profile_id: 'fixture-shared', model_id: 'fixture-shared-model', model: 'fixture-shared-model', profile_name: '演示服务', provider: 'custom' };
      const active = modelState.active || { profile_id: shared.profile_id, model_id: shared.model_id };
      const options = [shared, ...modelState.profiles.flatMap(p => p.models.map(m => ({ profile_id: p.id, model_id: m.id, model: m.model, profile_name: p.name, provider: p.binding })))];
      return json({ active, options: options.map(m => ({ ...m, is_active_default: m.profile_id === active.profile_id && m.model_id === active.model_id })) });
    }
    if (values['user-models'] && path.startsWith('/api/mobile/models')) {
      const data = JSON.parse(body.toString() || '{}');
      if (path === '/api/mobile/models' && req.method === 'GET') return json(publicModels());
      if (path.endsWith('/discover') && req.method === 'POST') {
        const key = data.api_key || modelState.profiles.find(p => p.id === data.id)?.api_key;
        return json(key?.startsWith('fixture-key') ? { status: 'connected', models: [{ id: 'fixture-model-a' }, { id: 'fixture-model-b' }] } : { status: 'auth_error', models: [] });
      }
      if (path.endsWith('/profile') && req.method === 'POST') {
        const old = modelState.profiles.find(p => p.id === data.id);
        if (data.id && !old) return json({}, 404);
        if (!data.models?.length) return json({}, 400);
        const p = { ...data, id: old?.id || randomUUID(), api_key: data.api_key || old?.api_key, models: data.models.map(id => ({ id, model: id, name: id })) };
        modelState.profiles = [...modelState.profiles.filter(row => row.id !== p.id), p];
        modelState.active ||= { profile_id: p.id, model_id: p.models[0].id };
        personal.set(user, modelState); return json(publicModels());
      }
      if (path.endsWith('/default') && req.method === 'POST') { modelState.active = data; personal.set(user, modelState); return json({ ok: true }); }
      if (path.includes('/profile/') && req.method === 'DELETE') { modelState.profiles = modelState.profiles.filter(p => p.id !== path.split('/').at(-1)); modelState.active = null; personal.set(user, modelState); return json({ ok: true }); }
      return json({}, 404);
    }
    if (req.method !== 'GET' && !(req.method === 'POST' && path === '/api/reading/materials') && !(req.method === 'PUT' && path === '/api/reading/materials/fixture-pdf/position'))
      return json({ detail: 'This write is not implemented by the local fixture' }, 404);
    const document = { material_id: 'fixture-pdf', title: `${label} / ${user} · PDF演示`, filename: 'fixture.pdf', render_mode: 'pdf', has_raw_view: true, unit_count: 2, unit: 'page', revision: 1, status: 'ready' };
    if (path === '/api/capabilities/registered') return json({ capabilities: ['chat','deep_question','video_lesson','math_animator'].map(id => ({ id, available: true })) });
    if (path === '/api/personas') return json({ personas: [{ name: 'teacher' }, { name: 'peer' }] });
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
        if (n === 127) { if (buffer.length < 10) return; const size = buffer.readBigUInt64BE(2); if (size > 14n * 1024n * 1024n) { socket.end(); return; } n = Number(size); offset = 10; }
        const mask = !!(buffer[1] & 128); if (buffer.length < offset + (mask ? 4 : 0) + n) return;
        const key = buffer.subarray(offset, offset + 4); if (mask) offset += 4;
        const data = Buffer.from(buffer.subarray(offset, offset + n)); if (mask) for (let i = 0; i < data.length; i++) data[i] ^= key[i % 4];
        buffer = buffer.subarray(offset + n); if (opcode === 8) { socket.end(Buffer.from([0x88, 0])); return; } if (opcode !== 1) continue;
        const value = JSON.parse(data.toString()); if (value.type !== 'start_turn') continue;
        if (String(value.content).includes('fixture-reject')) { send({ type: 'protocol_error', message: '模拟拒绝：本次未保存，可修改后重试。' }); continue; }
        const id = value.session_id || randomUUID();
        let answer = `${label} / ${user}：已收到测试问题。这是流式协议演示，不是模型答案。${value.llm_selection ? `\n收到模型 ID：${value.llm_selection.model_id}` : ''}`;
        const owner = `${user}:${req.headers['x-deeptutor-workspace'] || ''}`;
        const previous = sessions.get(id);
        if (previous && previous.owner !== owner) { send({ type: 'error', content: 'Not found' }); continue; }
        const storedAttachments = (Array.isArray(value.attachments) ? value.attachments : []).map(item => {
          if (!item.base64) return item;
          const aid = randomUUID(), filename = String(item.filename || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
          const url = `/files/attachments/${id}/${aid}/${filename}`;
          attachments.set(url, { owner, mime: item.mime_type || 'application/octet-stream', bytes: Buffer.from(item.base64, 'base64') });
          const { base64, ...metadata } = item;
          return { ...metadata, id: aid, url };
        });
        if (/排版验收|LayoutAcceptance/.test(String(value.content))) answer = '这是合成排版验收，不是模型识别。\n### **一起算一算**\n先算 $26 + 17 = 43$。\n- **第一步**：先加十位。\n- 第二步：再加个位。\n> 分数也可以读清楚：$\\frac{1}{2}$。\n| 内容 | 数量 |\n| --- | --- |\n| 苹果 | 3 |\n| 梨 | 4 |\n【题目】26+17=?\n【我的作答】43\n【不确定之处】这是测试用固定文本，请校对。';
        const parent = Object.hasOwn(value,'parent_message_id') ? value.parent_message_id : previous?.messages.at(-1)?.id || null;
        const userId = ++messageSequence, assistantId = ++messageSequence;
        const preferences = { ...previous?.preferences, llm_selection: value.llm_selection };
        if (value.selection_tutor_context) Object.assign(preferences, { parent_session_id: value.selection_tutor_context.parent_session_id, session_kind: 'selection_tutor', tutor_source_message_id: value.selection_tutor_context.quoted_message_id });
        const message = { id: assistantId, parent_message_id: userId, role: 'assistant', content: answer, attachments: [{ type: 'file', filename: '演示资料.pdf', mime_type: 'application/pdf', url: '/api/reading/materials/fixture-pdf/raw', generated: true }] };
        sessions.set(id, { id, owner, title: '虚拟测试对话', preferences, messages: [...(previous?.messages || []), { id: userId, parent_message_id: parent, role: 'user', content: value.content, attachments: storedAttachments }, message] });
        send({ type: 'content', content: answer.slice(0, 12), session_id: id, seq: 1 });
        setTimeout(() => { if (!socket.destroyed) {
          send({ type: 'content', content: answer.slice(12), session_id: id, seq: 2 });
          if (String(value.content).includes('render')) {
            const event = { type: 'result', session_id: id, seq: 3, metadata: { data: [
            { text: '公式：$\\frac{1}{2}+\\frac{1}{2}=1$' },
            { render_type: 'mermaid', code: 'graph TD\nA[Start]-->B[Learn]' },
            { render_type: 'chartjs', code: JSON.stringify({ type: 'bar', data: { labels: ['A', 'B'], datasets: [{ label: 'Fixture', data: [2, 3] }] } }) },
            ] } };
            message.events = [event];
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
