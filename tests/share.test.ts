import test from "node:test";
import assert from "node:assert/strict";
import {
  assertShareAccount,
  parseShareInbox,
} from "../src/lib/share-policy.ts";
import { redirectSystemPath } from "../src/app/+native-intent.ts";

const batch = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: 100,
  files: [
    {
      name: "教材.txt",
      uri: "file:///private/inbox/0.txt",
      size: 24,
      type: "text/plain",
    },
  ],
  errors: [],
};
test("pending files survive decoding without becoming an upload or account assignment", () => {
  assert.deepEqual(parseShareInbox(JSON.stringify([batch])), [batch]);
});
test("shared URLs, oversized payloads, unsupported files and malformed batches are rejected", () => {
  for (const patch of [
    { uri: "https://example.com/private.txt" },
    { size: 26 * 1024 * 1024 },
    { size: 0 },
    { name: "program.apk" },
  ]) {
    assert.deepEqual(
      parseShareInbox(
        JSON.stringify([
          { ...batch, files: [{ ...batch.files[0], ...patch }] },
        ]),
      ),
      [],
    );
  }
  assert.deepEqual(
    parseShareInbox(
      JSON.stringify([
        { ...batch, id: "../../other" },
        { ...batch, errors: [null] },
      ]),
    ),
    [],
  );
});
test("errors from link-only shares remain visible and batches are oldest first", () => {
  const newer = { ...batch, createdAt: 200, files: [], errors: ["请分享文件"] };
  assert.deepEqual(parseShareInbox(JSON.stringify([newer, batch])), [
    batch,
    newer,
  ]);
});
test("account changes or logout prevent using an earlier confirmation", () => {
  assert.doesNotThrow(() => assertShareAccount("child-a", "child-a"));
  assert.throws(
    () => assertShareAccount("child-a", "child-b"),
    /登录账号已变化/,
  );
  assert.throws(
    () => assertShareAccount("child-a", undefined),
    /登录账号已变化/,
  );
});
test("native share route contains neither credentials nor provider file paths", () => {
  assert.equal(
    redirectSystemPath({
      path: "deeptutor-mobile://share-inbox",
      initial: true,
    }),
    "/share-inbox",
  );
  assert.equal(
    redirectSystemPath({ path: "/materials", initial: false }),
    "/materials",
  );
  assert.equal(redirectSystemPath({ path: "not a URL", initial: true }), "/");
});
