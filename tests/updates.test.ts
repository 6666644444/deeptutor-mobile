import assert from "node:assert/strict";
import test from "node:test";
import { checkReleases, compareVersions, newestRelease, parseReleases, parseVersion, readableReleaseNotes, RELEASES_URL } from "../src/lib/updates.ts";

const release = (tag: string, overrides: Record<string, unknown> = {}) => ({
  tag_name: tag, html_url: `${RELEASES_URL}/tag/${tag}`, draft: false,
  prerelease: false, published_at: "2026-11-02T08:00:00Z", assets: [], body: "更新说明", ...overrides,
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

test("release notes stay inert readable text without long Markdown link syntax", () => {
  assert.equal(readableReleaseNotes("# 新版本\n\n- **修复** `键盘`\n[验证记录](https://example.com/long/path)\n![示例图](https://example.com/image.png)"),
    "新版本\n\n• 修复 键盘\n验证记录\n示例图");
});

test("updates compare numeric versions, preview identifiers and final releases without downgrades", () => {
  const ascending = ["0.2.0-preview.1", "0.2.0-preview.2", "0.2.0-preview.10", "0.2.0", "0.2.9", "0.2.10", "0.10.0", "1.0.0"];
  for (let i = 1; i < ascending.length; i++) {
    assert.ok(compareVersions(ascending[i], ascending[i - 1])! > 0);
    assert.ok(compareVersions(ascending[i - 1], ascending[i])! < 0);
  }
  assert.equal(compareVersions("v0.2.0+build.2", "0.2.0+build.1"), 0);
  assert.equal(compareVersions("0.2.0", "unmarked"), null);
  for (const invalid of ["1.2", "1.2.03", "1.2.3-preview.01", "main", " 1.2.3", "1.2.3-"]) assert.equal(parseVersion(invalid), null);
});

test("published releases are sorted by version, with stable and preview channels kept distinct", () => {
  const rows = parseReleases([release("v0.2.0"), release("v0.3.0-preview.1"), release("v0.1.0"), release("v9.0.0", { draft: true })]);
  assert.equal(newestRelease(rows, false)?.tag, "v0.2.0");
  assert.equal(newestRelease(rows, true)?.tag, "v0.3.0-preview.1");
  assert.equal(newestRelease(parseReleases([release("v0.2.0-preview.1")]), false), null);
  assert.equal(newestRelease([], true), null);
});

test("source archives, partial APK uploads and untrusted download links are not Android installers", () => {
  const asset = { name: "client.apk", size: 42, state: "uploaded", browser_download_url: `${RELEASES_URL}/download/v0.3.0/client.apk` };
  for (const assets of [[], [{ ...asset, name: "source.tar.gz" }], [{ ...asset, state: "starter" }], [{ ...asset, size: 0 }], [{ ...asset, browser_download_url: "https://example.com/client.apk" }]]) {
    assert.equal(parseReleases([release("v0.3.0", { assets })])[0].hasAndroidApk, false);
  }
  assert.equal(parseReleases([release("v0.3.0", { assets: [asset] })])[0].hasAndroidApk, true);
  assert.throws(() => parseReleases([release("v0.3.0", { html_url: "https://example.com/release" })]), /可识别/);
});

test("malformed release responses fail instead of claiming the client is current", () => {
  for (const value of [null, {}, { message: "rate limit" }, [null], [release("v1.0.0", { published_at: null })]])
    assert.throws(() => parseReleases(value));
  assert.deepEqual(parseReleases([]), []);
});

test("GitHub checks never use learning service credentials and handle rate limits or offline errors", async () => {
  await checkReleases(undefined, async (input, init) => {
    assert.equal(new URL(String(input)).origin, "https://api.github.com");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "error");
    const headers = new Headers(init?.headers);
    assert.equal(headers.has("Authorization"), false);
    assert.equal(headers.has("Cookie"), false);
    assert.equal(headers.has("X-DeepTutor-Session"), false);
    return response([release("v0.3.0")]);
  });
  for (const status of [403, 429]) await assert.rejects(checkReleases(undefined, async () => response({}, status)), /次数暂时受限/);
  await assert.rejects(checkReleases(undefined, async () => response({}, 500)), /500/);
  await assert.rejects(checkReleases(undefined, async () => { throw Error("offline"); }), /网络/);
});

test("leaving the update page cancels its request and slow requests time out", async () => {
  const stopped = new AbortController(); stopped.abort();
  await assert.rejects(checkReleases(stopped.signal, async () => { throw Error("must not fetch"); }), /已取消/);
  const waiting: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(Error("abort")), { once: true });
  });
  await assert.rejects(checkReleases(undefined, waiting, 5), /超时/);
  const controller = new AbortController();
  const result = checkReleases(controller.signal, waiting);
  controller.abort();
  await assert.rejects(result, /已取消/);
});
