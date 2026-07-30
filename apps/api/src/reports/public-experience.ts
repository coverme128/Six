export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function publicObservationFocus(value: unknown) {
  const focus = objectValue(value);
  const roles = Array.isArray(focus.roles) ? focus.roles.map((item) => {
    const role = objectValue(item);
    return {
      label: text(role.label),
      meaning: text(role.meaning),
      importance: text(role.importance) === "primary" ? "主要" : "辅助",
      lines: Array.isArray(role.lines) ? role.lines.map((lineItem) => {
        const line = objectValue(lineItem);
        return {
          position: line.position,
          branchName: text(line.branchName),
          sixRelationName: text(line.sixRelationName),
          moving: Boolean(line.moving),
          isWorld: Boolean(line.isWorld),
          isResponse: Boolean(line.isResponse),
          isVoid: Boolean(line.isVoid),
          monthText: text(line.monthText) ?? text(objectValue(line.monthInfluence).text),
          dayText: text(line.dayText) ?? text(objectValue(line.dayInfluence).text),
          changedText: text(line.changedText) ?? text(objectValue(objectValue(line.changed).returnInfluence).text)
        };
      }) : []
    };
  }) : [];
  if (!text(focus.summary) && !roles.length) return null;
  return {
    summary: text(focus.summary),
    selectionSource: focus.selectionSource === "system_auto" ? "系统自动" : "系统默认",
    userEditable: focus.userEditable === "professional_mode_only" ? "仅专业模式" : undefined,
    roles
  };
}

function publicViewModel(value: unknown) {
  const model = objectValue(value);
  return {
    ...model,
    observationFocus: publicObservationFocus(model.observationFocus)
  };
}

export function publicExperience(value: unknown) {
  const experience = objectValue(value);
  return {
    guidedViewModel: publicViewModel(experience.guidedViewModel),
    professionalViewModel: publicViewModel(experience.professionalViewModel)
  };
}
