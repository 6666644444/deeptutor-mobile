import type { ChatAttachment } from "./client.ts";

export function isImageAttachment(attachment: ChatAttachment) {
  return attachment.type === "image" || attachment.type.startsWith("image/") ||
    !!attachment.mime_type?.startsWith("image/");
}

/** Use the same payload for the immediate bubble and the saved server turn. */
export function outgoingAttachments(image?: { base64: string; filename: string }, file?: ChatAttachment | null, existing: ChatAttachment[] = []): ChatAttachment[] {
  return [...existing, ...(image ? [{ type: "image", base64: image.base64, filename: image.filename, mime_type: "image/jpeg" }] : []), ...(file ? [file] : [])];
}
