export type SharedFile = {
  name: string;
  uri: string;
  size: number;
  type: string;
};
export type SharedBatch = {
  id: string;
  createdAt: number;
  files: SharedFile[];
  errors: string[];
};

export function parseShareInbox(raw: string): SharedBatch[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("接收记录格式不正确");
  return value
    .filter((batch): batch is SharedBatch => {
      if (
        !batch ||
        typeof batch !== "object" ||
        !/^[a-f\d-]{36}$/i.test(batch.id)
      )
        return false;
      if (
        !Number.isFinite(batch.createdAt) ||
        !Array.isArray(batch.files) ||
        !Array.isArray(batch.errors)
      )
        return false;
      return (
        batch.files.length <= 5 &&
        batch.errors.every((v: unknown) => typeof v === "string") &&
        batch.files.every(
          (file: SharedFile) =>
            typeof file.name === "string" &&
            /\.(pdf|docx|txt)$/i.test(file.name) &&
            typeof file.uri === "string" &&
            file.uri.startsWith("file://") &&
            Number.isFinite(file.size) &&
            file.size > 0 &&
            file.size <= 25 * 1024 * 1024 &&
            typeof file.type === "string",
        )
      );
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function assertShareAccount(
  expected: string,
  current: string | undefined,
) {
  if (!current || expected !== current)
    throw new Error("登录账号已变化，请重新核对资料和账号后再确认。");
}
