import test from "node:test";
import type { FormData as NodeFormData } from "undici-types";
import assert from "node:assert/strict";
import { materialMultipart } from "../src/lib/material-multipart.ts";

test("multipart preserves Chinese filenames and binary content for the server parser", async () => {
  const bytes = new Uint8Array([0, 255, 13, 10, 34, 128, 65]);
  for (const name of [
    "分享验收-20261101-中文.txt",
    "小学教材.pdf",
    "练习.docx",
  ]) {
    const { body, headers } = materialMultipart(name, bytes);
    const form = (await new Response(body, {
      headers,
    }).formData()) as unknown as NodeFormData;
    const file = form.get("file") as File;
    assert.equal(file.name, name);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    assert.equal([...form.keys()].length, 1);
  }
});

test("upload rejects header injection, unsupported files and oversized content", () => {
  for (const name of ["x\r\nInjected: true.txt", "../../file.pdf", "file.exe"])
    assert.throws(() => materialMultipart(name, new Uint8Array([1])));
  assert.throws(() => materialMultipart("empty.txt", new Uint8Array()));
  assert.throws(() =>
    materialMultipart("large.txt", new Uint8Array(25 * 1024 * 1024 + 1)),
  );
});
