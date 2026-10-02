"use client";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

export function RequestProgress({ label, detail, onPause }: { label: string; detail: string; onPause?: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [label]);
  return <div className="request-progress" aria-busy="true">
    <div role="status"><LoaderCircle size={18} aria-hidden="true" /><strong>{label}</strong></div>
    <span aria-live="off">已等待 {seconds} 秒</span>
    <p>{detail}</p>
    {seconds >= 30 ? <p>等待较久，可稍后继续；请勿重新起卦。</p> : null}
    {onPause ? <button type="button" className="text-link" onClick={onPause}>暂停等待，保留当前记录</button> : null}
  </div>;
}
