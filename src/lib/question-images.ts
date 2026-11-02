import { File } from "expo-file-system";
import type { ChatAttachment, TutorClient } from "./client";
import { temporaryBytes } from "./temporary-files";

// Notebook deletion owns its attachments. Never give it a chat attachment ID
// or URL: deleting the question would otherwise delete the original chat photo.
export async function copyQuestionImages(
  api: TutorClient,
  images: ChatAttachment[],
  questionId: string,
) {
  const copies = [];
  for (const [index, source] of images.entries()) {
    api.assertOpen();
    let base64 = source.base64;
    if (!base64 && source.url) {
      const bytes = await api.download(api.contentPath(source.url));
      const file = new File(temporaryBytes(api, bytes, "question-photo.jpg"));
      try {
        base64 = await file.base64();
      } finally {
        if (file.exists) file.delete();
      }
    }
    api.assertOpen();
    if (!base64)
      throw new Error("原题照片未能完整读取，请重新打开对话后再保存。");
    copies.push({
      id: `${questionId}_photo_${index}`,
      base64,
      filename: source.filename || "question.jpg",
      mime_type: source.mime_type || "image/jpeg",
    });
  }
  return copies;
}
