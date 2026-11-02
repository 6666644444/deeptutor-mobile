type Data = Record<string, unknown>;
const object = (x: unknown): Data =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Data) : {};
const string = (x: unknown) => (typeof x === "string" ? x : "");
export function artifactPayload(value: Data) {
  const code = object(value.code),
    payload = object(value.payload);
  const raw = string(value.render_type) || string(value.renderer);
  const supported = ["html", "svg", "mermaid", "mindmap", "chartjs"];
  const kind = supported.includes(raw) ? raw : string(code.language);
  const data = payload.data;
  const source =
    string(code.content) ||
    string(value.code) ||
    string(data) ||
    (kind === "chartjs" && data && typeof data === "object"
      ? JSON.stringify(data)
      : "");
  return { kind, source, renderable: supported.includes(kind) && !!source };
}
