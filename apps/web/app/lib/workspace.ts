let temporaryToken: string | undefined;

export function workspaceToken() {
  try {
    const stored = localStorage.getItem("six-workspace-token");
    if (stored && /^[a-f0-9]{64}$/.test(stored)) return stored;
    const token = temporaryToken ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("six-workspace-token", token);
    temporaryToken = token;
    return token;
  } catch {
    throw new Error("浏览器未允许保存匿名身份。请允许本站本地存储后继续，以免无法找回报告。");
  }
}

export async function workspaceFetch(url: string, options: RequestInit = {}, timeoutMs = 150000) {
  const headers = new Headers(options.headers);
  headers.set("x-six-workspace", workspaceToken());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  try { return await fetch(url, { ...options, headers, signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted) throw new Error("请求已暂停或等待超时。已记录的盘面不会重摇，可以继续重试。");
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
}
