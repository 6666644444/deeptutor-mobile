import type { ChatAttachment } from "./client.ts";
import type { QuestionDraft } from "./drafts.ts";
import { isImageAttachment } from "./chat-attachments.ts";

export const PHOTO_QUESTION_PROMPT =
  "请先识别图片里的题目和作答，按【题目】【我的作答】【不确定之处】分段输出。看不清的地方注明，不要猜。等我校对后再讲解。";
export function photoQuestionDraft(
  messages: {
    id: string;
    role: string;
    content: string;
    attachments?: ChatAttachment[];
  }[],
  sessionId: string,
  messageId?: string,
): QuestionDraft {
  const index = messageId
    ? messages.findIndex((m) => m.id === messageId && m.role === "user")
    : messages.findLastIndex((m) => m.role === "user");
  const source = messages[index];
  if (!source) throw new Error("请先选择一道已经发送的题目。");
  const after = messages.slice(index + 1);
  const nextUser = after.findIndex((m) => m.role === "user");
  const reply = (nextUser < 0 ? after : after.slice(0, nextUser))
    .filter((m) => m.role === "assistant")
    .map((m) => m.content)
    .join("\n\n");
  const images = (source.attachments || []).filter(
    (a) => isImageAttachment(a) && (a.url || a.base64),
  );
  const section = (name: string) =>
    new RegExp(`【${name}】\\s*([\\s\\S]*?)(?=【|$)`)
      .exec(reply)?.[1]
      ?.trim() || "";
  const isRecognitionPrompt =
    images.length && source.content.startsWith("请先识别图片里的题目和作答");
  return {
    question: images.length
      ? section("题目") ||
        (isRecognitionPrompt
          ? ""
          : source.content.replace(/\n\[已附题目照片\]/g, ""))
      : source.content,
    user_answer: images.length ? section("我的作答") : "",
    explanation: reply,
    session_id: sessionId || undefined,
    images,
  };
}
