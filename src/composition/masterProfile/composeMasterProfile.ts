import {
  createAddProfileFact,
  createApplyOnboardingStep,
  createConfirmProfileFact,
  createImportProfileFactsFromCv,
  createRejectProfileFact,
  createUpdateProfileFact,
  type MasterProfileRepository,
} from '../../application/masterProfile';
import { createDbMasterProfileRepository } from '../../infrastructure/masterProfile';

export function composeMasterProfile(options: { profiles?: MasterProfileRepository } = {}) {
  const profiles = options.profiles ?? createDbMasterProfileRepository();
  return {
    applyOnboardingStep: createApplyOnboardingStep({ profiles }),
    addProfileFact: createAddProfileFact({ profiles }),
    confirmProfileFact: createConfirmProfileFact({ profiles }),
    rejectProfileFact: createRejectProfileFact({ profiles }),
    updateProfileFact: createUpdateProfileFact({ profiles }),
    importProfileFactsFromCv: createImportProfileFactsFromCv({ profiles }),
  };
}
