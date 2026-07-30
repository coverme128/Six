// @ts-nocheck
export function buildAdminViewModel(facts) {
  return {
    viewModelVersion: "ADMIN_VIEWMODEL_V1",
    reportId: facts.resultId,
    resultType: facts.resultType,
    rawFacts: facts.rawRefs,
    sourceVersions: facts.sourceVersions,
    audit: {
      factsVersion: facts.factsVersion,
      generatedAt: new Date().toISOString(),
    },
  };
}
