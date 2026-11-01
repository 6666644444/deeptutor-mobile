import { safePath, type Connection } from "./connection.ts";
import type { SavedLogin } from "./client.ts";
export function moduleBootstrap(config: Connection, saved: SavedLogin | null, path: string) {
  const target = safePath(config, path);
  if (saved && saved.origin !== config.origin) throw Error("内嵌页面身份与服务不一致。");
  const literal = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const auth = saved ? `const login=await fetch(${literal(config.origin + "/api/auth/login")},{method:'POST',redirect:'error',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(${literal({ username: saved.username, password: saved.password })})});if(!login.ok)throw Error();const user=await login.json();if(user.user_id!==${literal(saved.user.user_id)})throw Error();` : "";
  const identity = saved ? `if(!status.enabled||!status.authenticated||status.user_id!==${literal(saved.user.user_id)})throw Error();` : "if(status.enabled||!status.authenticated||status.user_id!=='local-admin')throw Error();";
  // Only this isolated, script-free local document receives the password.
  // Server content receives its own HttpOnly Cookie, never injected credentials.
  return `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${config.origin}; script-src 'nonce-dt-bootstrap'; style-src 'unsafe-inline'"></head><body style="font-family:system-ui;padding:40px;color:#087F78;background:#F6F8F7"><p>正在打开学习内容…</p><script nonce="dt-bootstrap">(async()=>{try{${auth}const r=await fetch(${literal(config.origin + "/api/auth/status")},{credentials:'include',redirect:'error',cache:'no-store'});if(!r.ok)throw Error();const status=await r.json();${identity}try{localStorage.setItem('deeptutor-language','zh');localStorage.setItem('deeptutor-response-language','zh');}catch{}window.ReactNativeWebView.postMessage('authenticated');location.replace(${literal(target)});}catch{window.ReactNativeWebView.postMessage('login_failed');}})();</script></body></html>`;
}
