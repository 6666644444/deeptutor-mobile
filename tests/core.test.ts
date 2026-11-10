import test from 'node:test';
import assert from 'node:assert/strict';
import { connection, safePath, scopedKey, sameOrigin, isPrivateHost } from '../src/lib/connection.ts';
import { ApiError, TutorClient, streamText } from '../src/lib/client.ts';
import { SessionManager, type Storage } from '../src/lib/session-manager.ts';
const A = connection('http://192.168.1.2:3782', 'computer');
const B = connection('http://192.168.1.2:3783', 'computer');
function response(value: unknown, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers }); }
function fixture() {
  const users = new Map<string, string>(); const calls: { url: string; init?: RequestInit }[] = [];
  let enabled = true, offline = false, count = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (offline) throw Error('offline');
    const url = String(input); calls.push({ url, init });
    const token = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /, '');
    const account = users.get(new URL(url).origin + ':' + token);
    if (url.endsWith('/api/auth/status')) return response({ enabled, authenticated: !enabled || !!account, user_id: enabled ? account : 'local-admin' });
    if (url.endsWith('/api/auth/login')) {
      const body = JSON.parse(String(init?.body)); if (body.password !== 'demo-pass') return response({}, 401);
      const token = String(++count); users.set(new URL(url).origin + ':' + token, body.username);
      return response({ user_id: body.username, username: body.username, role: 'admin' }, 200, { 'Set-Cookie': `dt_token=${token}; HttpOnly` });
    }
    if (enabled && !account) return response({}, 401);
    if (url.endsWith('/file')) return new Response(new TextEncoder().encode('fixture-document'));
    return response({ account: account || 'local-admin', origin: new URL(url).origin });
  }) as typeof fetch;
  const values = new Map<string, string>();
  const storage: Storage = { get: async k => values.get(k) || null, set: async (k, v) => { values.set(k, v); }, remove: async k => { values.delete(k); } };
  return { fetcher, storage, values, calls, expire: () => users.clear(), mode: (value: boolean) => { enabled = value; }, offline: (value: boolean) => { offline = value; } };
}
test('origin validation rejects loopback, public HTTP, URL credentials and deceptive private names', () => {
  for (const origin of ['http://127.1', 'http://localhost:3782', 'http://[::1]', 'https://u:p@example.com', 'http://10.evil.com', 'http://192.168.fake.com', 'https://example.com/api', 'https://example.com/?password=x', 'file:///a', 'http://public.example']) assert.throws(() => connection(origin, 'computer'));
  assert.equal(isPrivateHost('192.168.2.3'), true); assert.equal(isPrivateHost('172.32.1.2'), false);
  assert.equal(connection(' HTTPS://EXAMPLE.COM:443/ ', 'server').origin, 'https://example.com');
});
test('paths and scope keys preserve service, port and account boundaries', () => {
  for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', '/a\n']) assert.throws(() => safePath(A, path));
  assert.equal(sameOrigin(A, B.origin), false);
  assert.notEqual(scopedKey(A.origin, 'demo'), scopedKey(B.origin, 'demo'));
  assert.notEqual(scopedKey(A.origin, 'demo'), scopedKey(A.origin, 'other'));
});
test('HTTP, uploads, downloads and WS use one origin with no shared cookie jar', async () => {
  const f = fixture(), c = new TutorClient(A, { username: 'demo', password: 'demo-pass' }, f.fetcher);
  await c.login(); const form = new FormData(); form.append('file', new Blob(['fixture-document']), 'fixture.txt');
  await c.request('/api/reading/materials', { method: 'POST', body: form });
  assert.equal(new TextDecoder().decode(await c.download('/file')), 'fixture-document');
  for (const call of f.calls) { assert.equal(new URL(call.url).origin, A.origin); assert.equal(call.init?.credentials, 'omit'); assert.equal(call.init?.redirect, 'error'); }
  assert.equal(c.socketOptions().url, 'ws://192.168.1.2:3782/ws');
  assert.equal(c.socketOptions().headers.Cookie, `dt_token=${c.token}`);
  assert.equal('Authorization' in c.socketOptions().headers, false);
});
test('concurrent expired GETs coalesce login renewal; write is never replayed', async () => {
  const f = fixture(), c = new TutorClient(A, { username: 'demo', password: 'demo-pass' }, f.fetcher);
  await c.login(); f.expire(); await Promise.all([c.request('/a'), c.request('/b')]);
  assert.equal(f.calls.filter(x => x.url.endsWith('/login')).length, 2);
  f.expire(); await assert.rejects(c.json('/write', { payload: 'once' }), /避免重复/);
  assert.equal(f.calls.filter(x => x.url.endsWith('/write')).length, 1);
});
test('WS credential marker is scoped to each selected client and cleared on retirement', async () => {
  const f = fixture();
  const a = new TutorClient(A, { username: 'demo', password: 'demo-pass' }, f.fetcher);
  const b = new TutorClient(B, { username: 'other', password: 'demo-pass' }, f.fetcher);
  await a.login(); await b.login();
  assert.notEqual(a.socketOptions().headers['X-DeepTutor-Session'], b.socketOptions().headers['X-DeepTutor-Session']);
  assert.equal(a.socketOptions().headers['X-DeepTutor-Session'], a.token);
  assert.equal(a.socketOptions().headers.Origin, A.origin);
  assert.equal(b.socketOptions().url.includes(b.token + '?'), false);
  const anonymous = new TutorClient(A); assert.equal(anonymous.socketOptions().headers.Cookie, '');
  assert.equal(anonymous.socketOptions().headers['X-DeepTutor-Session'], '');
  a.close(); assert.throws(() => a.socketOptions(), /切换/);
});
test('closing a client aborts body reads and closes streams before late response arrives', async () => {
  let resolve!: () => void; let signal: AbortSignal | undefined;
  const gate = new Promise<void>(r => { resolve = r; });
  const c = new TutorClient(A, null, (async (_url, init) => { signal = init?.signal as AbortSignal; return { ok: true, status: 200, json: async () => { await gate; return { secret: true }; } } as Response; }) as typeof fetch);
  let closed = false; c.onClose(() => { closed = true; });
  const pending = c.request('/slow'); await new Promise(r => setTimeout(r, 0)); c.close(); resolve();
  await assert.rejects(pending, /切换/); assert.equal(signal?.aborted, true); assert.equal(closed, true);
});
test('single-user mode does not login and refuses public unauthenticated service', async () => {
  const f = fixture(); f.mode(false); const c = new TutorClient(A, null, f.fetcher); await c.probe(); await c.ensureSession();
  assert.equal(c.user?.user_id, 'local-admin'); assert.equal(f.calls.some(x => x.url.endsWith('/login')), false);
  await assert.rejects(new TutorClient(connection('https://public.example', 'server'), null, f.fetcher).probe(), /没有启用登录/);
});
test('multi-service same-account records restore independently; offline preserves credentials', async () => {
  const f = fixture(), m = new SessionManager(f.storage, f.fetcher);
  await m.start(); await m.connect(A); await m.login('demo', 'demo-pass'); const first = m.snapshot.api!;
  await m.connect(B); assert.equal(first.isClosed, true); assert.equal(m.snapshot.api, null); await m.login('demo', 'demo-pass');
  assert.equal(f.values.has(scopedKey(A.origin, 'demo')), true); assert.equal(f.values.has(scopedKey(B.origin, 'demo')), true);
  await m.connect(A); assert.equal((m.snapshot.api as TutorClient | null)?.config.origin, A.origin);
  f.offline(true); await m.connect(A, false); assert.ok(m.snapshot.bootError); assert.ok(f.values.get(scopedKey(A.origin, 'demo')));
  f.offline(false); const restarted = new SessionManager(f.storage, f.fetcher); await restarted.start(); assert.equal(restarted.snapshot.api?.user?.username, 'demo');
  await restarted.logout(); assert.equal(f.values.has(scopedKey(A.origin, 'demo')), false); assert.equal(f.values.has(scopedKey(B.origin, 'demo')), true);
  await restarted.login('other', 'demo-pass'); assert.equal(restarted.snapshot.api?.user?.username, 'other');
});
test('expired saved session renews automatically on restart and saves new token', async () => {
  const f = fixture(), m = new SessionManager(f.storage, f.fetcher); await m.start(); await m.connect(A); await m.login('demo', 'demo-pass');
  const old = m.snapshot.api?.token; m.dispose(); f.expire();
  const next = new SessionManager(f.storage, f.fetcher); await next.start(); assert.ok(next.snapshot.api); assert.notEqual(next.snapshot.api?.token, old);
  assert.equal(JSON.parse(f.values.get(scopedKey(A.origin, 'demo'))!).token, next.snapshot.api?.token);
});
test('a pending service probe cannot restore after user switches away', async () => {
  const f = fixture(); let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  const delayed = (async (url, init) => { if (String(url).startsWith(A.origin)) await gate; return f.fetcher(url, init); }) as typeof fetch;
  const m = new SessionManager(f.storage, delayed); await m.start(); const pending = m.connect(A); await m.connect(B); release(); await pending;
  assert.equal(m.snapshot.config?.origin, B.origin); assert.equal(m.snapshot.profiles.length, 1);
});
test('background reconnect recovers an offline session but never interrupts editing a failed service', async () => {
  const f = fixture(), m = new SessionManager(f.storage, f.fetcher);
  await m.start(); await m.connect(A); await m.login('demo', 'demo-pass');
  f.offline(true); await m.connect(A, false);
  assert.ok(m.snapshot.bootError);
  f.offline(false); await m.retryConnection();
  assert.equal(m.snapshot.api?.user?.username, 'demo');
  m.editConnections(); f.offline(true); await m.connect(B, false);
  const formState = m.snapshot, calls = f.calls.length;
  f.offline(false); await m.retryConnection();
  assert.equal(m.snapshot, formState);
  assert.equal(f.calls.length, calls);
  assert.equal(m.snapshot.needsConnection, true);
  await m.connect(B); assert.equal(m.snapshot.config?.origin, B.origin);
});
test('a renewal completing during logout cannot recreate credentials', async () => {
  const f = fixture(), m = new SessionManager(f.storage, f.fetcher); await m.start(); await m.connect(A); await m.login('demo', 'demo-pass');
  const old = m.snapshot.api!; f.expire(); const renewal = old.ensureSession().catch(() => {}); await m.logout(); await renewal;
  assert.equal(f.values.has(scopedKey(A.origin, 'demo')), false); assert.equal(m.snapshot.api, null);
});
test('incompatible status and changed auth mode fail closed', async () => {
  await assert.rejects(new TutorClient(A, null, (async () => response({ authenticated: true })) as typeof fetch).probe(), /兼容/);
  const f = fixture(), c = new TutorClient(A, { username: 'demo', password: 'demo-pass' }, f.fetcher); await c.login(); f.mode(false);
  await assert.rejects(c.ensureSession(), /认证设置/);
});
test('stream terminal result does not duplicate incremental text', () => {
  assert.equal(streamText({ type: 'result', content: 'same' }, 'same'), 'same');
  assert.equal(streamText({ type: 'content', content: 'more' }, 'some'), 'somemore');
});
