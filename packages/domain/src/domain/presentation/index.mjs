import { buildDivinationResultFacts } from "./divinationResultFacts.mjs";
import { buildGuidedViewModel } from "./guidedViewModel.mjs";
import { buildProfessionalViewModel } from "./professionalViewModel.mjs";
import { buildAdminViewModel } from "./adminViewModel.mjs";
import { REPORT_PAGE_EXPERIENCE, VISIBILITY_MATRIX } from "./experienceContracts.mjs";
import { duplicatePresentationWarnings } from "./evidenceDeduplicator.mjs";

export function buildExperienceBundle({ result, type, includeAdmin = false }) {
  const facts = buildDivinationResultFacts({ result, type });
  const guidedViewModel = buildGuidedViewModel(facts);
  const professionalViewModel = buildProfessionalViewModel(facts);
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
    pageExperience,
    visibility: {
      guided: VISIBILITY_MATRIX.Guided,
      professional: VISIBILITY_MATRIX.Professional,
    },
    guidedViewModel,
    professionalViewModel,
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
