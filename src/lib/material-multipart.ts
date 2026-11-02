const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

// Expo 57's FormData encoder percent-encodes filenames, which DeepTutor retains
// literally. RFC 7578 multipart with UTF-8 filenames preserves Chinese names.
export function materialMultipart(
  name: string,
  bytes: Uint8Array,
  supported?: string[],
) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const type =
    MIME[ext] ||
    (supported?.includes("." + ext) ? "application/octet-stream" : undefined);
  if (!type || /[\r\n\0/\\]/.test(name))
    throw new Error("文件名称或类型不支持。");
  if (!bytes.length || bytes.length > 25 * 1024 * 1024)
    throw new Error("文件为空或超过 25 MB。");
  const boundary = `----LearningMaterial${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name.replace(/"/g, "%22")}"\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const footer = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(header.length + bytes.length + footer.length);
  body.set(header);
  body.set(bytes, header.length);
  body.set(footer, header.length + bytes.length);
  return {
    body,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  };
}
