export const RELEASES_URL = "https://github.com/TinyPandaGame/deeptutor-mobile/releases";
const RELEASES_API = "https://api.github.com/repos/TinyPandaGame/deeptutor-mobile/releases?per_page=100";

// Notes remain inert native text. Full formatting and links are available on
// the explicit release-page button, without loading third-party images here.
export function readableReleaseNotes(markdown: string) {
  return markdown
    .replace(/!?\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^\n]+?)\*\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}

type Version = { core: string[]; pre: string[] };
export function parseVersion(value: string): Version | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(value);
  if (!match) return null;
  const pre = match[4]?.split(".") || [];
  if (pre.some(x => /^\d+$/.test(x) && x.length > 1 && x[0] === "0")) return null;
  return { core: match.slice(1, 4), pre };
}
const numericCompare = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
export function compareVersions(a: string, b: string): number | null {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) {
    const difference = numericCompare(x.core[i], y.core[i]);
    if (difference) return difference;
  }
  if (!x.pre.length || !y.pre.length) return x.pre.length ? -1 : y.pre.length ? 1 : 0;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const left = x.pre[i], right = y.pre[i];
    if (left === undefined || right === undefined) return left === undefined ? -1 : 1;
    if (left === right) continue;
    const ln = /^\d+$/.test(left), rn = /^\d+$/.test(right);
    if (ln && rn) return numericCompare(left, right);
    if (ln !== rn) return ln ? -1 : 1;
    return left < right ? -1 : 1;
  }
  return 0;
}

export type AppRelease = {
  tag: string; url: string; notes: string; published: string;
  preview: boolean; hasAndroidApk: boolean;
  otaAssets: { name: string; url: string }[];
};
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function parseReleases(payload: unknown): AppRelease[] {
  if (!Array.isArray(payload)) throw Error("版本信息格式异常，请稍后重试。");
  const releases: AppRelease[] = [];
  for (const value of payload) {
    const row = object(value);
    if (!row || row.draft !== false || typeof row.tag_name !== "string" ||
      !parseVersion(row.tag_name) || typeof row.prerelease !== "boolean" ||
      typeof row.published_at !== "string" || !Number.isFinite(Date.parse(row.published_at))) continue;
    const tag = row.tag_name;
    const url = `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
    // Construct official links ourselves; response content must never send the
    // learner to another repository, a script, or an arbitrary download host.
    if (row.html_url !== url || !Array.isArray(row.assets)) continue;
    const hasAndroidApk = row.assets.some(value => {
      const asset = object(value);
      return asset && asset.state === "uploaded" && typeof asset.name === "string" &&
        /\.apk$/i.test(asset.name) && typeof asset.size === "number" && asset.size > 0 &&
        asset.browser_download_url === `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
    });
    const otaAssets = row.assets.flatMap(value => {
      const asset = object(value);
      if (!asset || asset.state !== "uploaded" || typeof asset.name !== "string" ||
        !/^ota-(android|ios)-[\w.-]+\.json$/.test(asset.name) || typeof asset.size !== "number" || asset.size <= 0 || asset.size > 2_000_000) return [];
      const url = `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
      return asset.browser_download_url === url ? [{ name: asset.name, url }] : [];
    });
    releases.push({ tag, url, published: row.published_at, otaAssets,
      notes: typeof row.body === "string" ? row.body.slice(0, 12000) : "暂无更新说明。",
      preview: row.prerelease || !!parseVersion(tag)?.pre.length, hasAndroidApk: !!hasAndroidApk });
  }
  if (payload.length && !releases.length) throw Error("未找到可识别的版本，请到 GitHub 查看发布记录。");
  return releases;
}
export function newestRelease(releases: AppRelease[], includePreview: boolean) {
  return releases.filter(x => includePreview || !x.preview)
    .sort((a, b) => compareVersions(b.tag, a.tag) || 0)[0] || null;
}

export async function checkReleases(signal?: AbortSignal, fetcher: typeof fetch = fetch, timeoutMs = 15000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    if (controller.signal.aborted) throw Error("已取消检查。");
    // Independent of TutorClient: no service address, account, token or Cookie.
    const response = await fetcher(RELEASES_API, {
      signal: controller.signal, credentials: "omit", redirect: "error",
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (response.status === 403 || response.status === 429) throw Error("GitHub 检查次数暂时受限，请稍后再试。");
    if (!response.ok) throw Error(`暂时无法读取版本（${response.status}），请稍后重试。`);
    return parseReleases(await response.json());
  } catch (error) {
    if (controller.signal.aborted) throw Error(signal?.aborted ? "已取消检查。" : "连接 GitHub 超时，请检查网络后重试。");
    if (error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)) throw error;
    throw Error("暂时无法连接 GitHub，请检查网络后重试。");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
