import assert from "node:assert/strict";
import test from "node:test";
import { TutorClient } from "../src/lib/client.ts";
import { connection } from "../src/lib/connection.ts";

const server = connection("http://10.0.2.2:8786", "computer");
const client = (data: unknown) =>
  new TutorClient(
    server,
    null,
    async () =>
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      }),
  );

test("empty discovery lists are valid and distinguishable from malformed responses", async () => {
  for (const [path, value] of [
    ["/api/personas", { personas: [] }],
    ["/api/capabilities/registered", { capabilities: [] }],
    ["/api/knowledge-bases", []],
  ] as const) {
    assert.deepEqual(await client(value).request(path), value);
    for (const invalid of [null, {}, { items: [] }]) {
      await assert.rejects(client(invalid).request(path), /列表格式不兼容/);
    }
  }
});

test("malformed option rows produce recoverable API errors instead of blank or crashing selectors", async () => {
  for (const [path, value] of [
    ["/api/personas", { personas: [null] }],
    ["/api/personas", { personas: [{ name: "" }] }],
    ["/api/capabilities/registered", { capabilities: [{ id: "chat" }] }],
    [
      "/api/capabilities/registered",
      { capabilities: [{ id: "chat", available: "yes" }] },
    ],
    ["/api/knowledge-bases", [{ name: "教材", id: {} }]],
  ] as const) {
    await assert.rejects(client(value).request(path), /列表格式不兼容/);
  }
});

test("real server option identifiers and unavailable capability flags are preserved", async () => {
  for (const [path, value] of [
    [
      "/api/personas",
      { personas: [{ name: "teacher" }, { name: "peer" }, { name: "custom" }] },
    ],
    [
      "/api/capabilities/registered",
      {
        capabilities: [
          { id: "chat", available: true },
          { id: "video_lesson", available: false },
        ],
      },
    ],
    ["/api/knowledge-bases", [{ name: "教材" }, { name: "练习", id: "kb-1" }]],
  ] as const) {
    assert.deepEqual(await client(value).request(path + "?refresh=1"), value);
  }
});
