import type { Question } from "./client.ts";
export function questionEntries(value: unknown): { items: Question[]; total: number } {
  const list = value as { items?: unknown; total?: unknown } | null;
  if (!list || !Array.isArray(list.items) || !Number.isSafeInteger(list.total) || (list.total as number) < 0 ||
    list.items.some(item => !item || typeof item !== "object" || !Number.isSafeInteger(item.id) || typeof item.question !== "string" ||
      (item.categories != null && (!Array.isArray(item.categories) || item.categories.some((c: { name?: unknown } | null) => !c || typeof c.name !== "string")))))
    throw new Error("错题列表格式不兼容，请重试或检查服务版本。");
  return list as { items: Question[]; total: number };
}
