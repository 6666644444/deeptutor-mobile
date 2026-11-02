import { File } from "expo-file-system";
export async function uploadBody(
  fields: Record<string, string>,
  files: { uri: string; name: string; mime?: string; field?: string }[] = [],
) {
  const boundary = `----Tutor${Date.now()}${Math.random().toString(16).slice(2)}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const append = (s: string) => chunks.push(encoder.encode(s));
  for (const [key, value] of Object.entries(fields)) {
    if (!/^[a-z_]+$/i.test(key)) throw new Error("上传字段无效");
    append(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
    );
  }
  for (const file of files) {
    if (/[\r\n\0/\\]/.test(file.name)) throw new Error("文件名称无效");
    const f = new File(file.uri);
    size += f.size;
    if (!f.exists || size > 50 * 1024 * 1024)
      throw new Error("文件不可读或总大小超过 50 MB");
    const bytes = await f.bytes();
    append(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field || "files"}"; filename="${file.name.replace(/"/g, "%22")}"\r\nContent-Type: ${(file.mime || "application/octet-stream").replace(/[\r\n]/g, "")}\r\n\r\n`,
    );
    chunks.push(bytes);
    append("\r\n");
  }
  append(`--${boundary}--\r\n`);
  const body = new Uint8Array(chunks.reduce((n, x) => n + x.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return {
    body,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  };
}
