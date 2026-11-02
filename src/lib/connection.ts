export type Connection = { origin: string; kind: "computer" | "server" };
export function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  const parts = h.split(".");
  const ipv4 = parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255);
  return (ipv4 && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) ||
    /^(fc|fd)[0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h) || h.endsWith(".local");
}
export function connection(input: string, kind: Connection["kind"]): Connection {
  let url: URL;
  const trimmed = input.trim();
  // A bare host is convenient on a phone. Never downgrade an explicit scheme.
  let address = trimmed;
  if (!trimmed.includes("://")) {
    try {
      const host = new URL(`https://${trimmed}`).hostname;
      address = `${isPrivateHost(host) ? "http" : "https"}://${trimmed}`;
    } catch { /* Validated below, alongside explicit URLs. */ }
  }
  try { url = new URL(address); } catch { throw Error("请输入电脑 IP 和端口，或服务器域名，例如 192.168.1.20:3782 或 tutor.example.com"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash || trimmed.startsWith("/") || /[\\\r\n]/.test(input) || input.length > 240)
    throw Error("请填写服务首页地址，不要带账号、路径、参数或片段。");
  if (/^(localhost\.?|127\..*|\[::1\]|0\.0\.0\.0|\[::\])$/.test(url.hostname))
    throw Error("手机上的 127.0.0.1 / localhost 指手机自己。请填写电脑的局域网 IP 或可达的服务器域名。");
  if (url.protocol === "http:" && !isPrivateHost(url.hostname))
    throw Error("公网服务器请使用 HTTPS。HTTP 仅用于你信任的局域网电脑。");
  return { origin: url.origin, kind };
}
export function serviceKey(origin: string) {
  // Lossless encoding avoids hash collisions between services, ports and accounts.
  return Array.from(origin).map(c => c.codePointAt(0)!.toString(16).padStart(6, "0")).join("");
}
export function scopedKey(origin: string, account: string) {
  return `dtm.v1.${serviceKey(origin)}.${serviceKey(account)}`;
}
export function safePath(config: Connection, path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\r\n]/.test(path))
    throw Error("无效的服务内地址。");
  const url = new URL(path, config.origin);
  if (url.origin !== config.origin || url.username || url.password)
    throw Error("不能把学习凭据发送到其他服务。");
  return url.href;
}
export function sameOrigin(config: Connection, url: string) {
  try { return new URL(url).origin === config.origin && !/[\\\r\n]/.test(url); } catch { return false; }
}
