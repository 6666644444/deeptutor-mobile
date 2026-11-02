export type OtaState = {
  status: "disabled" | "idle" | "checking" | "downloading" | "ready" | "current" | "error";
  version?: string; message?: string;
};
export type OtaDriver = {
  enabled: boolean;
  check(): Promise<{ available: boolean; version?: string }>;
  download(): Promise<{ ready: boolean; version?: string }>;
  reload(): Promise<void>;
};

// No learning account or service client participates in application updates.
export class OtaController {
  snapshot: OtaState;
  private listeners = new Set<() => void>();
  private pending: Promise<void> | null = null;
  private lastCheck = 0;
  private driver: OtaDriver;
  constructor(driver: OtaDriver) { this.driver = driver; this.snapshot = { status: driver.enabled ? "idle" : "disabled" }; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private set(value: OtaState) { this.snapshot = value; this.listeners.forEach(fn => fn()); }
  check = (manual = false): Promise<void> => {
    if (!this.driver.enabled || this.snapshot.status === "ready") return Promise.resolve();
    if (this.pending) return this.pending;
    if (!manual && Date.now() - this.lastCheck < 60000) return Promise.resolve();
    this.lastCheck = Date.now();
    this.pending = this.run().finally(() => { this.pending = null; });
    return this.pending;
  };
  private async run() {
    this.set({ status: "checking" });
    try {
      const result = await this.driver.check();
      if (!result.available) { this.set({ status: "current" }); return; }
      this.set({ status: "downloading", version: result.version });
      const download = await this.driver.download();
      if (!download.ready) throw Error("Update not downloaded");
      this.set({ status: "ready", version: download.version || result.version });
    } catch {
      this.set({ status: "error", message: "暂时无法完成更新，继续使用当前版本。联网后可重试。" });
    }
  }
  restart = async () => {
    if (this.snapshot.status !== "ready") return;
    try { await this.driver.reload(); }
    catch { this.set({ ...this.snapshot, message: "请关闭并重新打开应用，让已下载的更新生效。" }); }
  };
}
