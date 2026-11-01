import { Directory, File, Paths } from "expo-file-system";
import type { TutorClient } from "./client";
const root = new Directory(Paths.cache, "deeptutor-mobile-sessions");
export function clearTemporaryFiles() { if (root.exists) root.delete(); }
export function temporaryBytes(api: TutorClient, bytes: ArrayBuffer, name: string) {
  api.assertOpen();
  const directory = new Directory(root, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  directory.create({ intermediates: true });
  const file = new File(directory, name);
  file.write(new Uint8Array(bytes));
  api.onClose(() => { if (directory.exists) directory.delete(); });
  return file.uri;
}
export async function ownTemporaryFile(api: TutorClient, uri: string, name: string) {
  api.assertOpen();
  const directory = new Directory(root, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  directory.create({ intermediates: true });
  const source = new File(uri);
  const file = new File(directory, name.replace(/[^\w.-]/g, "_"));
  try {
    await source.copy(file);
    api.assertOpen();
    api.onClose(() => { if (directory.exists) directory.delete(); });
    return file.uri;
  } catch (error) {
    if (directory.exists) directory.delete();
    throw error;
  } finally {
    if (uri.startsWith(Paths.cache.uri)) { try { source.delete(); } catch {} }
  }
}
