const ALLOWED_AI_INPUT_KEYS = new Set([
  "question_context",
  "chart_facts",
  "matched_rule_findings",
  "timing_candidates",
  "knowledge_references",
  "engine_versions",
]);

const PUBLIC_OUTPUT_ROLES = new Set(["FACT", "SIGNAL", "CANDIDATE_OR_GUARDRAIL"]);

export class AiInputValidationError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "AiInputValidationError";
    this.details = details;
  }
}

function assert(condition, message, details = undefined) {
  if (!condition) {
    throw new AiInputValidationError(message, details);
  }
}

function collectRuleCodes(value, output = new Set()) {
  if (!value || typeof value !== "object") {
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRuleCodes(item, output);
    }
    return output;
  }
  if (typeof value.rule_code === "string") {
    output.add(value.rule_code);
  }
  if (Array.isArray(value.rule_codes)) {
    for (const code of value.rule_codes) {
      output.add(code);
    }
  }
  for (const nested of Object.values(value)) {
    collectRuleCodes(nested, output);
  }
  return output;
}

export function validateMatchedFindings(findings) {
  assert(Array.isArray(findings), "matched_rule_findings must be an array.");
  const matchedCodes = new Set();
  for (const finding of findings) {
    assert(typeof finding.rule_code === "string" && finding.rule_code.length > 0, "Finding is missing rule_code.", finding);
    assert(PUBLIC_OUTPUT_ROLES.has(finding.output_role), "Finding output_role must be explicit and public-safe.", finding);
    matchedCodes.add(finding.rule_code);
  }
  return matchedCodes;
}

export function validateAiInput(aiInput) {
  assert(aiInput && typeof aiInput === "object" && !Array.isArray(aiInput), "AI input must be an object.");
  for (const key of Object.keys(aiInput)) {
    assert(ALLOWED_AI_INPUT_KEYS.has(key), "AI input contains a disallowed source key.", { key });
  }

  const matchedCodes = validateMatchedFindings(aiInput.matched_rule_findings ?? []);
  const allReferencedCodes = collectRuleCodes({
    chart_facts: aiInput.chart_facts,
    timing_candidates: aiInput.timing_candidates,
    knowledge_references: aiInput.knowledge_references,
  });

  for (const code of allReferencedCodes) {
    assert(matchedCodes.has(code), "AI input references a rule code that is not in matched findings.", {
      rule_code: code,
    });
  }

  return {
    matchedRuleCodes: matchedCodes,
    allowedKeys: [...ALLOWED_AI_INPUT_KEYS],
  };
}
