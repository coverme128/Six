// @ts-nocheck
import { buildDivinationResultFacts } from "./divinationResultFacts.js";
import { buildGuidedViewModel } from "./guidedViewModel.js";
import { buildProfessionalViewModel } from "./professionalViewModel.js";
import { buildAdminViewModel } from "./adminViewModel.js";
import { buildLiuyaoProductResultFacts } from "./productResultFacts.js";
import { REPORT_PAGE_EXPERIENCE, VISIBILITY_MATRIX } from "./experienceContracts.js";
import { duplicatePresentationWarnings } from "./evidenceDeduplicator.js";
import { selectContentExplanationSnippets } from "./contentExplanations.js";

export { deduplicateSignals } from "./evidenceDeduplicator.js";
export { PAGE_EXPERIENCE_CONTRACTS, PAGE_STATE_CONTRACT, REPORT_PAGE_EXPERIENCE, VISIBILITY_MATRIX } from "./experienceContracts.js";
export { TERMINOLOGY_REGISTRY } from "./terminologyRegistry.js";
export { formatRelationship, formatStatus } from "./terminologyFormatter.js";
export { LIUYAO_PRODUCT_RESULT_FACTS_VERSION, judgmentFactsSignature } from "./productResultFacts.js";

export function buildExperienceBundle({ result, type, includeAdmin = false }) {
  const facts = buildDivinationResultFacts({ result, type });
  const productResultFacts = type === "liuyao" ? (result.productResultFacts ?? buildLiuyaoProductResultFacts({ result, presentationFacts: facts })) : null;
  const viewFacts = productResultFacts ?? facts;
  const guidedViewModel = buildGuidedViewModel(viewFacts);
  const professionalViewModel = buildProfessionalViewModel(viewFacts);
  const pageExperience = {
    ...REPORT_PAGE_EXPERIENCE,
    visualHierarchy: { ...REPORT_PAGE_EXPERIENCE.visualHierarchy },
  };
  if (!includeAdmin) delete pageExperience.visualHierarchy.Admin;
  const bundle = {
    experienceVersion: "EXPERIENCE_ORCHESTRATION_V1",
    reportId: facts.resultId,
    reportType: facts.resultType,
    state: "COMPLETED",
    productClosureStatus: productResultFacts ? "LIUYAO_ASSESSMENT_RUNTIME_READY" : null,
    productResultFacts,
    pageExperience,
    visibility: {
      guided: VISIBILITY_MATRIX.Guided,
      professional: VISIBILITY_MATRIX.Professional,
    },
    guidedViewModel,
    professionalViewModel,
    contentExplanationSnippets: selectContentExplanationSnippets({ productResultFacts }),
    qa: {
      duplicatePresentationWarnings: duplicatePresentationWarnings(guidedViewModel),
      hasPrimaryAction: guidedViewModel.nextActions.length > 0,
    },
  };
  if (includeAdmin) {
    bundle.adminViewModel = buildAdminViewModel(facts);
    bundle.visibility.admin = VISIBILITY_MATRIX.Admin;
  }
  return bundle;
}
