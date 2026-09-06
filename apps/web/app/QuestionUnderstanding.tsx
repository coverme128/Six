"use client";

import { useState } from "react";
import type { QuestionUnderstanding } from "@six/shared";
import { apiBase, readError } from "./lib/api";

export type UnderstandingResult = { understanding: QuestionUnderstanding; understandingToken: string };

export async function understandQuestion(question: string, clarification = ""): Promise<UnderstandingResult> {
  const response = await fetch(`${apiBase()}/liuyao/questions/understand`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, clarification }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export function QuestionClarification({ result, busy, onAnswer }: {
  result: UnderstandingResult | null;
  busy: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  if (!result || !["CLARIFY", "SPLIT"].includes(result.understanding.status)) return null;
  return <fieldset className="question-clarification" disabled={busy}>
    <legend>{result.understanding.clarificationQuestion}</legend>
    <div className="clarification-options">
      {result.understanding.options.map((option) => <label key={option}>
        <input type="radio" name="question-clarification" checked={answer === option} onChange={() => setAnswer(option)} />
        <span>{option}</span>
      </label>)}
    </div>
    <label className="clarification-freeform">补充说明
      <input value={answer} maxLength={300} onChange={(event) => setAnswer(event.target.value)} />
    </label>
    <button type="button" className="primary-button" disabled={busy || !answer.trim()} onClick={() => onAnswer(answer.trim())}>
      {busy ? "正在理解" : "确认并继续"}
    </button>
  </fieldset>;
}
