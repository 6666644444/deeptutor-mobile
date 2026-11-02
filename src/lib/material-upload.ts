import { File } from "expo-file-system";
import { materialMultipart } from "./material-multipart";

// SDK 57 fetch cannot upload the older React Native URI-only FormData parts.
export async function materialUpload(
  file: { uri: string; name: string },
  supported?: string[],
) {
  const source = new File(file.uri);
  if (!source.exists || source.size > 25 * 1024 * 1024)
    throw new Error("文件无法读取或超过 25 MB，请重新选择。");
  return materialMultipart(file.name, await source.bytes(), supported);
}
