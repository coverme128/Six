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
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  try { return await fetch(url, { ...options, headers, signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted) throw new Error(timedOut ? "等待服务响应超时，请重试当前请求。" : "已暂停等待。服务端可能仍在处理，请继续原请求确认结果。");
    if (error instanceof TypeError) throw new Error("暂时无法连接服务，请检查网络后重试。");
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
}
