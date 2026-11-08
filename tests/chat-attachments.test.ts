import test from "node:test";
import assert from "node:assert/strict";
import { isImageAttachment, outgoingAttachments } from "../src/lib/chat-attachments.ts";
import { photoQuestionDraft } from "../src/lib/photo-question.ts";

test("existing photos remain in the immediate message when editing and asking again", () => {
  const image = { type: "image", url: "/files/attachments/s/a/question.jpg", filename: "question.jpg" };
  assert.deepEqual(outgoingAttachments(undefined, null, [image]), [image]);
  assert.equal(outgoingAttachments({ base64: "YWJj", filename: "q.jpg" })[0].base64, "YWJj");
});
test("MIME-tagged image attachments keep their original reference in mistake correction", () => {
  const image = { type: "file", mime_type: "image/png", url: "/files/attachments/s/a/q.png" };
  assert.equal(isImageAttachment(image), true);
  assert.equal(isImageAttachment({ type: "pdf", mime_type: "application/pdf" }), false);
  assert.deepEqual(photoQuestionDraft([{ id: "1", role: "user", content: "这道题", attachments: [image] }], "s").images, [image]);
});
