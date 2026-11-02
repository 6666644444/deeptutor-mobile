import test from "node:test";
import { artifactPayload } from "../src/lib/artifact-payload.ts";
import assert from "node:assert/strict";
test("book concept graphs and canonical chart payloads select a real renderer", () => {
  assert.deepEqual(
    artifactPayload({
      render_type: "concept_graph",
      code: { language: "mermaid", content: "graph TD\nA-->B" },
    }),
    { kind: "mermaid", source: "graph TD\nA-->B", renderable: true },
  );
  const data = { type: "bar", data: { labels: ["A"], datasets: [] } };
  assert.deepEqual(
    JSON.parse(
      artifactPayload({ render_type: "chartjs", payload: { data } }).source,
    ),
    data,
  );
  assert.equal(
    artifactPayload({ render_type: "unknown", code: "untrusted" }).renderable,
    false,
  );
});
import { calendarTime, chinaTime } from "../src/lib/calendar-time.ts";
import { mathMarkup } from "../src/lib/math-markup.ts";
import { nativeDestination } from "../src/lib/native-routes.ts";
import { connection } from "../src/lib/connection.ts";
import { TutorClient } from "../src/lib/client.ts";
import { dialogueParts } from "../src/lib/conversation.ts";
test("interactive replies remain visible between the question and feedback", () => {
  assert.deepEqual(
    dialogueParts("2+3 是多少？回答正确。", [
      {
        type: "progress",
        metadata: {
          ask_user_resolved: true,
          assistant_content_offset: 8,
          answers: [{ questionId: "q1", text: "5，我从2再数3个。" }],
        },
      },
    ]),
    [
      { role: "assistant", text: "2+3 是多少？" },
      { role: "user", text: "5，我从2再数3个。" },
      { role: "assistant", text: "回答正确。" },
    ],
  );
});
test("calendar UTC round-trips as China time without an eight-hour shift", () => {
  assert.equal(chinaTime("2026-11-02T11:00:00Z"), "2026-11-02 19:00");
  assert.equal(calendarTime("2026-11-02 19:00"), "2026-11-02T11:00:00.000Z");
  assert.equal(calendarTime("2026-11-02", true), "2026-11-02");
  assert.throws(() => calendarTime("2026-02-30 19:00"));
  assert.throws(() => calendarTime("2026-11-02 25:00"));
});
test("math typesets fractions and escapes untrusted prose and TeX links", () => {
  const html = mathMarkup("分数 $\\frac{1}{4}$ <script>alert(1)</script>");
  assert.match(html, /class="katex"/);
  assert.match(html, /frac/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(
    mathMarkup("$\\href{javascript:alert(1)}{点这里}$"),
    /href="javascript:/,
  );
});
test("legacy module destinations resolve to native routes", () => {
  for (const path of [
    "/learning/reading",
    "/learning/books",
    "/learning/mastery",
    "/notebooks",
    "/calendar",
    "/co-writer",
    "/memory",
    "/partners",
    "/knowledge-bases",
    "/settings/workspace",
    "/",
  ]) {
    const destination = nativeDestination(path);
    assert.equal(typeof destination, "object");
    assert.equal((destination as { pathname: string }).pathname, "/feature");
  }
});
test("workspace scope accompanies content requests and never the login endpoint", async () => {
  const calls: { url: string; headers: Headers }[] = [];
  const client = new TutorClient(
    connection("http://10.0.2.2:8786", "computer"),
    { username: "fixture", password: "test-only-password" },
    async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) });
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  client.workspaceId = "fixture-workspace";
  client.token = "fixture-token";
  await client.request("/api/notebooks");
  await client.request("/api/auth/status");
  assert.equal(
    calls[0].headers.get("X-DeepTutor-Workspace"),
    "fixture-workspace",
  );
  assert.equal(calls[1].headers.get("X-DeepTutor-Workspace"), null);
});
