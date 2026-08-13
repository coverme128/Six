"use client";

import { useEffect, useState } from "react";
import { AppNav } from "../AppNav";
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
        const loaded = (await response.json()) as PublicSettings;
        setSettings({ ...loaded, defaultCastMethod: "liuyao_manual" });
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
      <AppNav current="settings" />

      <section className="hero compact">
        <p className="eyebrow">Preference</p>
        <h1>设置</h1>
        <p>这些偏好会影响起卦默认方式、术语深度和报告语言。匿名使用时仍尽量保持输入简单、结果可读。</p>
      </section>

      <section className="panel report-section">
        <h2>报告偏好</h2>
        <p className="section-kicker">修改后会作为后续报告的默认设置。</p>
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
