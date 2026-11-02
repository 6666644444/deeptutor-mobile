import test from "node:test";
import assert from "node:assert/strict";
import { TutorClient } from "../src/lib/client.ts";
import { connection } from "../src/lib/connection.ts";
import { SessionManager } from "../src/lib/session-manager.ts";
const A = connection("http://10.0.2.2:8786", "computer");
const B = connection("http://10.0.2.2:8788", "computer");
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
test("wrong notebook envelopes and malformed rows become recoverable errors, not render-time filter failures", async () => {
  for (const value of [{ questions: [], total: 0 }, {}, null, { items: null, total: 0 }, { items: [null], total: 1 }, { items: [{ id: 1, question: "test", categories: {} }], total: 1 }]) {
    const c = new TutorClient(A, null, async () => json(value));
    await assert.rejects(c.request("/api/question-notebook/entries?limit=50"), /错题列表格式/);
  }
  const expected = { items: [{ id: 1, question: "2 + 3", categories: null }], total: 1 };
  assert.deepEqual(await new TutorClient(A, null, async () => json(expected)).request("/api/question-notebook/entries"), expected);
});
test("media paths accept only the selected origin and never leak to a sibling port", () => {
  const c = new TutorClient(A);
  assert.equal(c.contentPath(A.origin + "/api/media/a.pdf?q=1"), "/api/media/a.pdf?q=1");
  assert.equal(c.contentPath("/api/media/a.pdf"), "/api/media/a.pdf");
  for (const value of [B.origin + "/file", "https://example.com/file", "//example.com/file", "data:text/html,hello", "file:///tmp/a", "http://demo:pass@10.0.2.2:8786/file"]) assert.throws(() => c.contentPath(value));
});
test("closing a client during a PDF/export body read prevents the bytes reaching a renderer", async () => {
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  let started!: () => void;
  const ready = new Promise<void>(r => { started = r; });
  const c = new TutorClient(A, null, (async url => String(url).endsWith("/status")
    ? json({ enabled: false, authenticated: true, user_id: "local-admin" })
    : { ok: true, status: 200, headers: new Headers(), arrayBuffer: async () => { started(); await gate; return new ArrayBuffer(2); } } as Response) as typeof fetch);
  await c.probe();
  const pending = c.download("/api/document/raw"); await ready; c.close(); release();
  await assert.rejects(pending, /切换/);
});
test("workspace retirement cancels old scopes and restores independently per service, including anonymous mode", async () => {
  const values = new Map<string, string>(); let retired = 0;
  const storage = { get: async (k: string) => values.get(k) || null, set: async (k: string, v: string) => { values.set(k, v); }, remove: async (k: string) => { values.delete(k); } };
  const fetcher: typeof fetch = async () => json({ enabled: false, authenticated: true, user_id: "local-admin" });
  const m = new SessionManager(storage, fetcher, async () => { retired++; });
  await m.start(); await m.connect(A);
  const old = m.snapshot.api!;
  await m.setWorkspace("workspace-one");
  assert.equal(old.isClosed, true); assert.equal(retired, 1);
  assert.notEqual(old.scope, m.snapshot.api!.scope);
  assert.equal(m.snapshot.api!.mode, "anonymous");
  await m.connect(B); assert.equal(m.snapshot.api!.workspaceId, "");
  await m.connect(A); assert.equal(m.snapshot.api!.workspaceId, "workspace-one");
  const restored = new SessionManager(storage, fetcher); await restored.start();
  assert.equal(restored.snapshot.api!.workspaceId, "workspace-one");
  assert.equal(restored.snapshot.api!.config.origin, A.origin);
});
test("redirects and HTTP failures do not become downloadable credentials-bearing artifacts", async () => {
  for (const status of [302, 404, 500]) {
    const c = new TutorClient(A, null, async url => String(url).endsWith("/status") ? json({ enabled: false, authenticated: true, user_id: "local-admin" }) : json({}, status));
    await c.probe(); await assert.rejects(c.download("/api/export"));
  }
});
