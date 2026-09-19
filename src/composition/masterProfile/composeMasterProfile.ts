import {
  createAddProfileFact,
  createApplyOnboardingStep,
  createConfirmProfileFact,
  createImportProfileFactsFromCv,
  createRejectProfileFact,
  createSetProofWallItemReadiness,
  createUpdateProfileFact,
  type MasterProfileRepository,
  type ProofWallItemRepository,
} from '../../application/masterProfile';
import {
  createDbMasterProfileRepository,
  createDbProofWallItemRepository,
} from '../../infrastructure/masterProfile';

export function composeMasterProfile(
  options: {
    profiles?: MasterProfileRepository;
    proofWall?: ProofWallItemRepository;
  } = {}
) {
  const profiles = options.profiles ?? createDbMasterProfileRepository();
  const proofWall = options.proofWall ?? createDbProofWallItemRepository();
  return {
    applyOnboardingStep: createApplyOnboardingStep({ profiles }),
    addProfileFact: createAddProfileFact({ profiles }),
    confirmProfileFact: createConfirmProfileFact({ profiles }),
    rejectProfileFact: createRejectProfileFact({ profiles }),
    updateProfileFact: createUpdateProfileFact({ profiles }),
    importProfileFactsFromCv: createImportProfileFactsFromCv({ profiles }),
    setProofWallItemReadiness: createSetProofWallItemReadiness({ profiles, proofWall }),
  };
}
