import { isPrivateHost, safePath, scopedKey, type Connection } from "./connection.ts";
export type User = { user_id: string; username: string; role: string };
export type Credentials = { username: string; password: string };
export type SavedLogin = Credentials & { origin: string; user: User; token: string };
export type AuthStatus = { enabled: boolean; authenticated: boolean; user_id?: string; username?: string; role?: string };
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}
export function tokenFromCookie(header: string | null) {
  return /(?:^|[,;]\s*)dt_token=([^;,\s]+)/.exec(header || "")?.[1] || "";
}
export class TutorClient {
  token = "";
  user: User | null = null;
  mode: "account" | "anonymous" = "account";
  readonly config: Connection;
  private credentials: Credentials | null;
  private fetcher: typeof fetch;
  private closed = false;
  private controllers = new Set<AbortController>();
  private disposers = new Set<() => void>();
  private renewal: Promise<void> | null = null;
  onRenewed?: (login: SavedLogin) => Promise<void>;
  onExpired?: () => void;
  constructor(config: Connection, credentials: Credentials | null = null, fetcher: typeof fetch = fetch) {
    this.config = config; this.credentials = credentials; this.fetcher = fetcher;
  }
  get scope() { return scopedKey(this.config.origin, this.user?.user_id || "pending"); }
  get isClosed() { return this.closed; }
  assertOpen() { if (this.closed) throw new ApiError("连接或账号已切换，已取消旧操作。"); }
  onClose(dispose: () => void) { this.assertOpen(); this.disposers.add(dispose); return () => this.disposers.delete(dispose); }
  private async consume<T>(path: string, init: RequestInit, read: (response: Response) => Promise<T>, timeout: number) {
    this.assertOpen();
    const controller = new AbortController();
    this.controllers.add(controller);
    const cancel = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener("abort", cancel);
    const timer = setTimeout(cancel, timeout);
    try {
      const headers = new Headers(init.headers);
      headers.delete("Cookie"); headers.delete("Authorization");
      if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
      // expo/fetch implements redirect:error and credentials:omit on both platforms.
      // No shared native cookie jar: cookies for equal hosts on different ports cannot collide.
      const result = await this.fetcher(safePath(this.config, path), {
        ...init, headers, credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
      });
      this.assertOpen();
      if (result.redirected || (result.url && new URL(result.url).origin !== this.config.origin) || (result.status >= 300 && result.status < 400))
        throw new ApiError("服务跳转到其他地址。请直接填写最终的服务首页地址。");
      const value = await read(result);
      this.assertOpen();
      return value;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("暂时连接不上。请确认电脑在线、手机与电脑网络互通，或服务器地址和 HTTPS 证书正常。登录信息仍保留。");
    } finally {
      clearTimeout(timer); this.controllers.delete(controller); init.signal?.removeEventListener("abort", cancel);
    }
  }
  async status(): Promise<AuthStatus> {
    return this.consume("/api/auth/status", {}, async r => {
      if (!r.ok) throw new ApiError(`无法检查服务认证设置（${r.status}）。`, r.status);
      const value = await r.json();
      if (typeof value.enabled !== "boolean" || typeof value.authenticated !== "boolean")
        throw new ApiError("地址没有返回兼容的 DeepTutor 接口。请使用 1.7.1 的同源服务首页地址。");
      return value;
    }, 15000);
  }
  async probe() {
    const state = await this.status();
    if (!state.enabled) {
      if (!isPrivateHost(new URL(this.config.origin).hostname))
        throw new ApiError("这项服务没有启用登录。请先启用服务端认证，或通过受保护的局域网 / VPN 地址连接。");
      if (!state.authenticated || state.user_id !== "local-admin")
        throw new ApiError("服务的免登录身份不符合当前支持版本。");
      this.mode = "anonymous";
      this.user = { user_id: "local-admin", username: "本机学习空间", role: "admin" };
    }
    return state;
  }
  async login(): Promise<SavedLogin> {
    if (!this.credentials) throw new ApiError("请登录当前服务。", 401);
    return this.consume("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(this.credentials),
    }, async r => {
      if (!r.ok) throw new ApiError(r.status === 401 ? "账号或密码不正确，请重新输入。" : r.status === 403 ? "服务器限制了此地址登录，请使用管理员允许的私有入口。" : `暂时无法登录（${r.status}）。`, r.status);
      const user = await r.json() as User;
      this.assertOpen();
      if (!user.user_id || user.username !== this.credentials?.username || (this.user && user.user_id !== this.user.user_id))
        throw new ApiError("登录身份已变化，请重新登录。", 401);
      const token = tokenFromCookie(r.headers.get("set-cookie"));
      if (!token) throw new ApiError("当前环境未能取得登录会话。请使用 Android / iOS 安装客户端。");
      this.token = token; this.user = user;
      return { ...this.credentials, origin: this.config.origin, user, token };
    }, 25000);
  }
  async renew() {
    if (!this.renewal) this.renewal = (async () => {
      try { const login = await this.login(); this.assertOpen(); await this.onRenewed?.(login); }
      catch (e) { if (e instanceof ApiError && e.status === 401) this.onExpired?.(); throw e; }
      finally { this.renewal = null; }
    })();
    return this.renewal;
  }
  async ensureSession() {
    const state = await this.status();
    if (state.enabled !== (this.mode === "account")) {
      this.onExpired?.(); throw new ApiError("服务的认证设置已改变，请重新连接。", 401);
    }
    if (!state.authenticated) await this.renew();
    else if (state.user_id !== this.user?.user_id) {
      this.onExpired?.(); throw new ApiError("登录身份已变化，请重新登录。", 401);
    }
  }
  async request<T>(path: string, init: RequestInit = {}, retry = true, timeout = 25000): Promise<T> {
    const result = await this.consume(path, init, async r => {
      if (r.status === 401) return { unauthorized: true as const };
      if (!r.ok) throw new ApiError(r.status === 404 ? "此内容不存在、当前账号不可访问，或服务未安装此功能。" : `暂时无法完成操作（${r.status}）。`, r.status);
      return { unauthorized: false as const, data: r.status === 204 ? undefined as T : await r.json() as T };
    }, timeout);
    if (!result.unauthorized) return result.data;
    if (retry && this.mode === "account") {
      await this.renew();
      if (!init.method || init.method === "GET" || init.method === "HEAD") return this.request(path, init, false, timeout);
      throw new ApiError("登录已恢复。为避免重复保存，请先检查服务端结果，再重新操作。", 401);
    }
    this.onExpired?.(); throw new ApiError("登录已失效，请重新登录。", 401);
  }
  json<T>(path: string, body: unknown, method = "POST") {
    return this.request<T>(path, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  }
  async download(path: string) {
    await this.ensureSession();
    return this.consume(path, {}, async r => {
      if (!r.ok) throw new ApiError(`未能读取文件（${r.status}）。`, r.status);
      return r.arrayBuffer();
    }, 60000);
  }
  socketOptions() {
    this.assertOpen();
    return { url: this.config.origin.replace(/^http/, "ws") + "/ws", headers: {
      Origin: this.config.origin, Cookie: "", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    } };
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const c of this.controllers) c.abort(); this.controllers.clear();
    for (const dispose of this.disposers) { try { dispose(); } catch {} } this.disposers.clear();
    this.token = ""; this.credentials = null;
  }
}
export type Question = {
  id: number;
  question: string;
  correct_answer: string;
  explanation: string;
  user_answer: string;
  resolved: boolean;
  bookmarked: boolean;
  categories?: { id: number; name: string }[];
  options?: Record<string, string>;
  user_answer_images?: { url: string }[];
};
export type Session = {
  id: string;
  title: string;
  message_count: number;
  updated_at: string | number;
  content_workspace_id?: string;
  messages?: { id: string; role: string; content: string }[];
};
export type Material = {
  material_id: string;
  title: string;
  filename: string;
  unit_count: number;
  unit: string;
  byte_size: number;
};
export type Stats = {
  total: number;
  wrong: number;
  unresolved: number;
  bookmarked: number;
};
export type TurnEvent = {
  type: string;
  content?: string;
  session_id?: string;
  turn_id?: string;
  seq?: number;
  metadata?: Record<string, unknown>;
};
export function streamText(event: TurnEvent, previous: string): string {
  if (event.type === "content" && typeof event.content === "string")
    return previous + event.content;
  if (event.type === "result" && typeof event.content === "string" && !previous)
    return event.content;
  return previous;
}
