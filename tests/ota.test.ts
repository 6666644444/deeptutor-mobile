import test from "node:test";
import assert from "node:assert/strict";
import { OtaController, type OtaDriver } from "../src/lib/ota-controller.ts";
import { githubUpdate } from "../src/lib/github-ota.ts";
import { RELEASES_URL } from "../src/lib/updates.ts";

test("startup checks coalesce and download without restarting an active learning session", async () => {
  let checks = 0, downloads = 0, restarts = 0;
  const controller = new OtaController({ enabled: true,
    async check() { checks++; return { available: true, version: "0.3.1" }; },
    async download() { downloads++; return { ready: true }; }, async reload() { restarts++; },
  });
  const states: string[] = [];
  controller.subscribe(() => states.push(controller.snapshot.status));
  await Promise.all([controller.check(), controller.check(), controller.check(true)]);
  assert.deepEqual(states, ["checking", "downloading", "ready"]);
  assert.equal(checks, 1); assert.equal(downloads, 1); assert.equal(restarts, 0);
  await controller.check(true); assert.equal(checks, 1);
  await controller.restart(); assert.equal(restarts, 1);
});

test("failed download remains recoverable, no update never reloads, and disabled builds make no calls", async () => {
  let fail = true;
  const driver: OtaDriver = { enabled: true, async check() { return { available: true }; },
    async download() { if (fail) throw Error("offline"); return { ready: true }; }, async reload() {} };
  const controller = new OtaController(driver);
  await controller.check(); assert.equal(controller.snapshot.status, "error");
  fail = false; await controller.check(true); assert.equal(controller.snapshot.status, "ready");
  const disabled = new OtaController({ ...driver, enabled: false, async check() { throw Error("Must not check"); } });
  await disabled.check(true); assert.equal(disabled.snapshot.status, "disabled");
  const current = new OtaController({ ...driver, async check() { return { available: false }; }, async reload() { assert.fail("unexpected restart"); } });
  await current.check(); await current.restart(); assert.equal(current.snapshot.status, "current");
});

const release = (tag: string, runtime = "runtime-a", preview = false) => ({
  tag_name: tag, html_url: `${RELEASES_URL}/tag/${tag}`, draft: false, prerelease: preview,
  published_at: "2026-11-02T10:00:00Z", body: "Tested client release", assets: [{
    name: `ota-android-${runtime}.json`, size: 1024, state: "uploaded",
    browser_download_url: `${RELEASES_URL}/download/${tag}/ota-android-${runtime}.json`,
  }],
});
const manifest = (tag = "v0.3.1", runtime = "runtime-a") => ({
  runtimeVersion: runtime, metadata: { platform: "android", releaseTag: tag },
  extra: { expoClient: { extra: { releaseVersion: tag.slice(1) } } }, assets: [],
  launchAsset: { hash: "a".repeat(43), url: `${RELEASES_URL}/download/${tag}/bundle.hbc` },
});
const envelope = (body = manifest()) => ({ manifest: JSON.stringify(body), signature: "A".repeat(512) });
const respond = (data: unknown) => new Response(JSON.stringify(data));

test("only our published compatible manifests are selected; no upstream official, draft, preview, downgrade or source-only update", async () => {
  const visited: string[] = [];
  const releases = [release("v0.4.0", "another-runtime"), release("v0.5.0-preview.1", "runtime-a", true),
    { ...release("v9.0.0"), draft: true }, release("v0.3.1"), { ...release("v0.3.2"), assets: [] }];
  const result = await githubUpdate("android", "runtime-a", "0.3.0", async (input, init) => {
    const url = String(input); visited.push(url);
    assert.equal(init?.credentials, "omit");
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return respond(url.includes("api.github.com") ? releases : envelope());
  });
  assert.equal(result?.version, "0.3.1"); assert.equal(visited.length, 2);
  assert.ok(visited.every(url => url.includes("TinyPandaGame/deeptutor-mobile")));
  assert.equal(await githubUpdate("android", "runtime-a", "0.6.0", async () => respond(releases)), null);
});

test("wrong runtime, wrong version and outside-repository asset payloads fail before reaching the native updater", async () => {
  for (const body of [manifest("v0.3.1", "wrong"), manifest("v0.3.2"),
    { ...manifest(), launchAsset: { hash: "a".repeat(43), url: "https://example.com/evil.hbc" } }]) {
    await assert.rejects(githubUpdate("android", "runtime-a", "0.3.0", async input => respond(String(input).includes("api.github.com") ? [release("v0.3.1")] : envelope(body))));
  }
});
