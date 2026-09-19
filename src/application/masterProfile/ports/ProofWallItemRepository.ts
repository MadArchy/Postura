import type { ProofWallItem } from '../../../types';

/**
 * Narrow ProofWall item persistence. Load/save only.
 * Application owns readiness authorization and the pending/complete assignment.
 */
export interface ProofWallItemRepository {
  getProofWallItem(itemId: string): ProofWallItem | null;
  saveProofWallItem(item: ProofWallItem): void;
}
