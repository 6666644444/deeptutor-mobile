export type Capability = {
  id: string;
  available: boolean;
  config_schema?: Record<string, unknown>;
};
export type Persona = { name: string };
export type KnowledgeBase = { name: string; id?: string };

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const name = (value: unknown): value is string =>
  typeof value === "string" && !!value.trim();

// Validate discovery responses before screens render them. An empty list is a
// valid server state; a missing/malformed list must surface as a retryable error.
export function learningOptionsResponse(path: string, value: unknown): unknown {
  const endpoint = path.split("?")[0];
  if (endpoint === "/api/capabilities/registered") {
    if (
      !record(value) ||
      !Array.isArray(value.capabilities) ||
      value.capabilities.some(
        (item) =>
          !record(item) ||
          !name(item.id) ||
          typeof item.available !== "boolean",
      )
    )
      throw new Error("学习能力列表格式不兼容，请重试或检查服务版本。");
  } else if (endpoint === "/api/personas") {
    if (
      !record(value) ||
      !Array.isArray(value.personas) ||
      value.personas.some((item) => !record(item) || !name(item.name))
    )
      throw new Error("交流方式列表格式不兼容，请重试或检查服务版本。");
  } else if (endpoint === "/api/knowledge-bases") {
    if (
      !Array.isArray(value) ||
      value.some(
        (item) =>
          !record(item) ||
          !name(item.name) ||
          (item.id != null && !name(item.id)),
      )
    )
      throw new Error("知识库列表格式不兼容，请重试或检查服务版本。");
  }
  return value;
}
