import assert from "node:assert/strict";
import test from "node:test";
import { workspaceFetch } from "../apps/web/app/lib/workspace";

test("request failures distinguish timeout, explicit pause and network loss", async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "a".repeat(64) } });
  const fetch = t.mock.method(globalThis, "fetch", async (_url: any, init: any) => new Promise<Response>((_resolve, reject) => {
    const fail = () => reject(new DOMException("aborted", "AbortError"));
    if (init.signal.aborted) fail();
    else init.signal.addEventListener("abort", fail, { once: true });
  }));
  try {
    await assert.rejects(workspaceFetch("http://example.test", {}, 5), /超时/);
    const controller = new AbortController();
    const waiting = workspaceFetch("http://example.test", { signal: controller.signal });
    controller.abort();
    await assert.rejects(waiting, /已暂停等待.*服务端可能仍在处理/);
    fetch.mock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
    await assert.rejects(workspaceFetch("http://example.test"), /无法连接服务/);
  } finally {
    if (storage) Object.defineProperty(globalThis, "localStorage", storage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
