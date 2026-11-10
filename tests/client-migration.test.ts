import test from 'node:test';
import assert from 'node:assert/strict';
import { connection } from '../src/lib/connection.ts';
import { ApiError, TutorClient, tokenFromCookie } from '../src/lib/client.ts';

const config = connection('http://192.168.1.2:3782', 'computer');
const credentials = { username: 'fixture-user', password: 'test-only-password' };
const user = { user_id: 'fixture-id', username: credentials.username, role: 'user' };
const json = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });

test('cookie token extraction handles combined headers and empty deletion cookies', () => {
  assert.equal(tokenFromCookie('other=value; Path=/, dt_token=fixture-token; HttpOnly; Secure'), 'fixture-token');
  assert.equal(tokenFromCookie('dt_token=; Max-Age=0'), '');
  assert.equal(tokenFromCookie(null), '');
});

test('a login response for another account never installs its session', async () => {
  const api = new TutorClient(config, credentials, async () =>
    json({ ...user, username: 'wrong-user' }, 200, { 'set-cookie': 'dt_token=fixture-token;' }));
  await assert.rejects(api.login(), (error: ApiError) => error.status === 401);
  assert.equal(api.token, '');
  assert.equal(api.user, null);
});

test('offline writes preserve the login and do not replay or log out', async () => {
  let requests = 0, expired = 0;
  const api = new TutorClient(config, credentials, async () => { requests++; throw Error('offline'); });
  api.token = 'existing-token';
  api.onExpired = () => { expired++; };
  await assert.rejects(api.json('/api/records', { question: 'fixture' }));
  assert.equal(requests, 1);
  assert.equal(expired, 0);
  assert.equal(api.token, 'existing-token');
});

test('an unauthenticated status renews before creating a conversation socket', async () => {
  let logins = 0;
  const api = new TutorClient(config, credentials, async url => {
    if (String(url).endsWith('/status')) return json({ enabled: true, authenticated: false });
    logins++;
    return json(user, 200, { 'set-cookie': 'dt_token=fresh-token; HttpOnly' });
  });
  api.mode = 'account';
  api.user = user;
  await api.ensureSession();
  assert.equal(logins, 1);
  assert.equal(api.socketOptions().headers['X-DeepTutor-Session'], 'fresh-token');
});
