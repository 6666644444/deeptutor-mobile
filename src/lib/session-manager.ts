import { ApiError, TutorClient, type SavedLogin } from "./client.ts";
import { connection, scopedKey, serviceKey, type Connection } from "./connection.ts";
export type Storage = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void> };
type Profile = Connection & { account?: string };
type Registry = { active?: string; profiles: Profile[] };
export type Snapshot = { api: TutorClient | null; config: Connection | null; profiles: Profile[]; booting: boolean; bootError: string; needsConnection: boolean };
const REGISTRY = "dtm.registry.v1";
export class SessionManager {
  snapshot: Snapshot = { api: null, config: null, profiles: [], booting: true, bootError: "", needsConnection: true };
  private registry: Registry = { profiles: [] };
  private storage: Storage;
  private fetcher: typeof fetch;
  private epoch = 0;
  private pending: TutorClient | null = null;
  private writes: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(storage: Storage, fetcher: typeof fetch) { this.storage = storage; this.fetcher = fetcher; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(value: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...value }; for (const fn of this.listeners) fn(); }
  private write(fn: () => Promise<void>) { const result = this.writes.then(fn); this.writes = result.catch(() => {}); return result; }
  private persistRegistry(epoch: number) { return this.write(async () => { if (epoch === this.epoch) await this.storage.set(REGISTRY, JSON.stringify(this.registry)); }); }
  private begin(config = this.snapshot.config) {
    const epoch = ++this.epoch;
    this.pending?.close(); this.pending = null; this.snapshot.api?.close();
    this.update({ api: null, config, booting: true, bootError: "" });
    return epoch;
  }
  private current(epoch: number, client: TutorClient) { if (epoch !== this.epoch) { client.close(); throw new ApiError("连接已切换。"); } }
  private install(client: TutorClient, epoch: number) {
    this.current(epoch, client);
    this.pending = null;
    client.onRenewed = saved => this.saveLogin(saved, epoch);
    client.onExpired = () => {
      if (epoch === this.epoch) { void this.logout(true); }
    };
    this.update({ api: client, booting: false, needsConnection: false, bootError: "" });
  }
  private saveLogin(saved: SavedLogin, epoch: number) {
    return this.write(async () => {
      if (epoch !== this.epoch) return;
      await this.storage.set(scopedKey(saved.origin, saved.username), JSON.stringify(saved));
    });
  }
  async start() {
    const epoch = this.begin();
    try {
      await this.writes;
      const raw = await this.storage.get(REGISTRY);
      if (epoch !== this.epoch) return;
      if (raw) {
        const value = JSON.parse(raw) as Registry;
        if (!Array.isArray(value.profiles) || value.profiles.length > 8) throw Error("invalid");
        this.registry = { active: value.active, profiles: value.profiles.map(p => ({ ...connection(p.origin, p.kind), account: p.account })) };
      }
      this.update({ profiles: this.registry.profiles });
      const config = this.registry.profiles.find(p => p.origin === this.registry.active);
      if (config) await this.connect(config, false);
      else this.update({ booting: false, needsConnection: true });
    } catch { if (epoch === this.epoch) this.update({ booting: false, bootError: "无法读取本机连接记录。可重新设置连接。" }); }
  }
  async connect(config: Connection, throwErrors = true) {
    config = connection(config.origin, config.kind);
    const epoch = this.begin(config);
    const client = new TutorClient(config, null, this.fetcher); this.pending = client;
    try {
      const status = await client.probe(); this.current(epoch, client);
      const existing = this.registry.profiles.find(p => p.origin === config.origin);
      if (!existing && this.registry.profiles.length >= 8) throw new ApiError("最多保存 8 个服务，请先移除一个。");
      this.registry = { active: config.origin, profiles: existing ? this.registry.profiles.map(p => p.origin === config.origin ? { ...p, kind: config.kind } : p) : [...this.registry.profiles, config] };
      await this.persistRegistry(epoch); this.current(epoch, client);
      this.update({ profiles: this.registry.profiles, needsConnection: false });
      if (!status.enabled) { this.install(client, epoch); return; }
      if (existing?.account) {
        await this.writes;
        const raw = await this.storage.get(scopedKey(config.origin, existing.account)); this.current(epoch, client);
        if (raw) {
          const saved = JSON.parse(raw) as SavedLogin;
          if (saved.origin !== config.origin || saved.username !== existing.account || !saved.password || !saved.user?.user_id)
            throw new ApiError("登录记录身份不匹配，请重新登录。", 401);
          client.close();
          const restored = new TutorClient(config, saved, this.fetcher); this.pending = restored;
          restored.user = saved.user; restored.token = saved.token;
          restored.onRenewed = value => this.saveLogin(value, epoch);
          await restored.ensureSession(); this.current(epoch, restored);
          this.install(restored, epoch); return;
        }
      }
      client.close(); this.pending = null; this.update({ booting: false });
    } catch (e) {
      if (epoch !== this.epoch) return;
      this.pending?.close(); this.pending = null;
      if (e instanceof ApiError && e.status === 401) { await this.logout(true); }
      else this.update({ booting: false, bootError: (e as Error).message });
      if (throwErrors) throw e;
    }
  }
  async login(username: string, password: string) {
    const config = this.snapshot.config;
    if (!config) throw new ApiError("请先连接服务。");
    const epoch = this.begin(config);
    const client = new TutorClient(config, { username: username.trim(), password }, this.fetcher); this.pending = client;
    this.update({ booting: false });
    try {
      const state = await client.probe(); this.current(epoch, client);
      if (!state.enabled) { this.install(client, epoch); return; }
      const saved = await client.login(); this.current(epoch, client);
      const previousAccount = this.registry.profiles.find(p => p.origin === config.origin)?.account;
      await this.saveLogin(saved, epoch); this.current(epoch, client);
      if (previousAccount && previousAccount !== saved.username) {
        await this.write(() => this.storage.remove(scopedKey(config.origin, previousAccount)));
        this.current(epoch, client);
      }
      this.registry.profiles = this.registry.profiles.map(p => p.origin === config.origin ? { ...p, account: saved.username } : p);
      await this.persistRegistry(epoch); this.current(epoch, client);
      this.update({ profiles: this.registry.profiles }); this.install(client, epoch);
    } catch (e) { client.close(); if (epoch === this.epoch) { this.pending = null; this.update({ booting: false }); } throw e; }
  }
  async savedCredentials() {
    const { api, config } = this.snapshot;
    if (!api || !config || api.mode === "anonymous") return null;
    const epoch = this.epoch;
    await this.writes;
    const raw = await this.storage.get(scopedKey(config.origin, api.user!.username));
    this.current(epoch, api);
    const saved = raw ? JSON.parse(raw) as SavedLogin : null;
    if (!saved || saved.origin !== config.origin || saved.user.user_id !== api.user?.user_id) throw new ApiError("请重新登录。");
    return saved;
  }
  async logout(expired = false) {
    const config = this.snapshot.config;
    const account = this.registry.profiles.find(p => p.origin === config?.origin)?.account;
    const anonymous = this.snapshot.api?.mode === "anonymous";
    const epoch = this.begin(config);
    if (config && account) await this.write(() => this.storage.remove(scopedKey(config.origin, account)));
    if (epoch !== this.epoch) return;
    this.registry.profiles = this.registry.profiles.map(p => p.origin === config?.origin ? { origin: p.origin, kind: p.kind } : p);
    if (anonymous) this.registry.active = undefined;
    await this.persistRegistry(epoch);
    if (epoch !== this.epoch) return;
    this.update({ booting: false, profiles: this.registry.profiles, needsConnection: anonymous || !config,
      bootError: expired ? "登录或服务设置已变化，请重新连接并登录。" : "" });
  }
  editConnections() {
    this.begin(); this.update({ booting: false, bootError: "", needsConnection: true });
  }
  async forget(origin: string) {
    const profile = this.registry.profiles.find(p => p.origin === origin);
    const epoch = this.begin(null);
    // Only one remembered account per service is retained. Old account records
    // are removed by logout before a replacement account can sign in.
    if (profile?.account) await this.write(() => this.storage.remove(scopedKey(origin, profile.account!)));
    if (epoch !== this.epoch) return;
    this.registry = { profiles: this.registry.profiles.filter(p => p.origin !== origin) };
    await this.persistRegistry(epoch);
    if (epoch === this.epoch) this.update({ profiles: this.registry.profiles, booting: false, needsConnection: true });
  }
  dispose() { ++this.epoch; this.pending?.close(); this.snapshot.api?.close(); }
}
export { serviceKey };
