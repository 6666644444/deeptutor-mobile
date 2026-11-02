import type { Question, TutorClient } from "./client.ts";

export function favoriteMetadata(values: Record<string, string>) {
  // A favorite's source output is immutable in DeepTutor. Edit its label only.
  return { title: values.title, summary: values.summary };
}

export function questionUpdate(
  original: Question,
  fields: Record<string, string>,
): Record<string, unknown> {
  if (!original.question_id || !original.origin_ref)
    throw new Error("题目来源信息不完整，请刷新后重试。");
  const keys = [
    "session_id",
    "origin_type",
    "origin_ref",
    "turn_id",
    "question_id",
    "question_type",
    "options",
    "difficulty",
    "source",
    "material_id",
    "material_title",
    "section_id",
    "section_title",
    "is_correct",
    "assessment_type",
    "result",
    "mastery_path_id",
    "knowledge_point_id",
    "attempt_count",
    "hints_used",
    "confidence",
    "response_time",
    "quality",
  ];
  const source = original as unknown as Record<string, unknown>;
  return {
    ...Object.fromEntries(
      keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]),
    ),
    question: fields.question.trim(),
    user_answer: fields.user_answer,
    correct_answer: fields.correct_answer,
    explanation: fields.explanation,
    // Omitting user_answer_images preserves persisted images on the server.
  };
}

export const QUESTION_PAGE_SIZE = 50;
export function questionListPath(search: string, filter: string, page: number) {
  const query = new URLSearchParams({
    mistakes_only: "true",
    limit: String(QUESTION_PAGE_SIZE),
    offset: String(Math.max(0, Math.floor(page)) * QUESTION_PAGE_SIZE),
    search: search.trim().slice(0, 200),
  });
  if (filter === "todo") query.set("resolved", "false");
  if (filter === "star") query.set("bookmarked", "true");
  return `/api/question-notebook/entries?${query}`;
}

export function calendarName(calendar: {
  id: string;
  name: string;
  is_default?: boolean;
}) {
  return (
    calendar.name?.trim() ||
    (calendar.is_default || calendar.id === "default"
      ? "默认日历"
      : "未命名日历")
  );
}

export function documentPreview(value = "") {
  // A compact list summary is plain text; formulas are rendered in the document.
  return value
    .replace(
      /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\n$]+?\$|\\\([^\n]*?\\\)/g,
      (math) => {
        const delimiter =
          math.startsWith("$$") || math.startsWith("\\") ? 2 : 1;
        const formula = math
          .slice(delimiter, -delimiter)
          .replace(
            /\\(?:dfrac|tfrac|frac)\{([^{}]+)\}\{([^{}]+)\}/g,
            "($1)/($2)",
          )
          .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
          .replace(/\\(?:text|mathrm|mathbf)\{([^{}]+)\}/g, "$1")
          .replace(/([_^])\{([^{}]+)\}/g, "$1($2)")
          .replace(
            /\\(times|cdot|div|pm|leq?|geq?|neq|pi)\b/g,
            (_, name: string) =>
              ({
                times: "×",
                cdot: "·",
                div: "÷",
                pm: "±",
                le: "≤",
                leq: "≤",
                ge: "≥",
                geq: "≥",
                neq: "≠",
                pi: "π",
              })[name] || "",
          )
          .replace(/\\(?:left|right)\b/g, "");
        return /[\\{}]/.test(formula) ? "〔数学公式〕" : formula.trim();
      },
    )
    .replace(/\\[a-zA-Z]+(?:\{[^}]*\})*/g, "〔数学公式〕")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "〔图片〕")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(^|\n)\s*#{1,6}\s+/g, "$1")
    .replace(
      /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`/g,
      (_, bold, underline, code) => bold || underline || code,
    )
    .replace(/\s+/g, " ")
    .trim();
}

export async function materialText(
  api: TutorClient,
  path: string,
  count: number,
  revision: number,
  signal?: AbortSignal,
) {
  if (!Number.isInteger(count) || count < 1)
    throw new Error("资料还没有解析完成，请稍后重试。");
  const texts: string[] = [];
  let size = 0;
  for (let page = 1; page <= count; page++) {
    api.assertOpen();
    if (signal?.aborted) throw new Error("导出已取消。");
    const unit = await api.request<{ text: string }>(`${path}/units/${page}`, {
      signal,
    });
    if (typeof unit.text !== "string")
      throw new Error(`第 ${page} 页没有返回完整文本，未导出。`);
    size += unit.text.length;
    if (size > 10 * 1024 * 1024)
      throw new Error("文本超过导出容量，请拆分资料后导出。");
    texts.push(unit.text);
  }
  const current = await api.request<{ revision: number; unit_count: number }>(
    path,
    { signal },
  );
  if (current.revision !== revision || current.unit_count !== count)
    throw new Error("资料在导出期间发生变化，请刷新后重新导出。");
  api.assertOpen();
  return new TextEncoder().encode(texts.join("\n\n")).buffer as ArrayBuffer;
}
