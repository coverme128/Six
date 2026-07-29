"use client";

import { useEffect, useState } from "react";
import { apiBase, readError, type PublicSettings } from "../lib/api";

const defaultSettings: PublicSettings = {
  timezone: "Asia/Shanghai",
  defaultCastMethod: "liuyao_manual",
  terminology: "beginner",
  reportLanguage: "zh-CN"
};

export function SettingsClient() {
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch(`${apiBase()}/settings`);
        if (!response.ok) throw new Error(await readError(response));
        setSettings((await response.json()) as PublicSettings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "暂时无法读取设置");
      }
    }
    loadSettings();
  }, []);

  async function saveSettings() {
    setStatus("");
    setError("");
    try {
      const response = await fetch(`${apiBase()}/settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error(await readError(response));
      setSettings((await response.json()) as PublicSettings);
      setStatus("设置已保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法保存设置");
    }
  }

  return (
    <main className="shell">
      <nav className="top-nav">
        <a href="/">起卦</a>
        <a href="/history">历史</a>
        <a href="/content">内容</a>
        <a href="/settings">设置</a>
      </nav>

      <section className="hero compact">
        <p className="eyebrow">Anonymous Beta</p>
        <h1>设置</h1>
        <p>当前为匿名本地设置，后续可迁入用户配置或设备配置表。</p>
      </section>

      <section className="panel report-section">
        <div className="workbench-form">
          <label>
            <span>时区</span>
            <input value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} />
          </label>
          <label>
            <span>默认起卦</span>
            <select
              value={settings.defaultCastMethod}
              onChange={(event) =>
                setSettings({ ...settings, defaultCastMethod: event.target.value as PublicSettings["defaultCastMethod"] })
              }
            >
              <option value="liuyao_manual">六爻手工</option>
              <option value="meihua_two_number">梅花两数</option>
            </select>
          </label>
          <label>
            <span>术语模式</span>
            <select
              value={settings.terminology}
              onChange={(event) => setSettings({ ...settings, terminology: event.target.value as PublicSettings["terminology"] })}
            >
              <option value="beginner">入门</option>
              <option value="professional">专业</option>
            </select>
          </label>
          <label>
            <span>报告语言</span>
            <select
              value={settings.reportLanguage}
              onChange={(event) =>
                setSettings({ ...settings, reportLanguage: event.target.value as PublicSettings["reportLanguage"] })
              }
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="button" onClick={saveSettings}>
              保存设置
            </button>
          </div>
        </div>
        {status ? <p className="empty">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
