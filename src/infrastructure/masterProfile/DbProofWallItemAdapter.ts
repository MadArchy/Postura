/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Master Profile strangler.
 * Wraps ProofWall item load/save only. Application owns readiness decisions.
 */

import type { ProofWallItemRepository } from '../../application/masterProfile';
import { dbService } from '../../services/db';

export function createDbProofWallItemRepository(): ProofWallItemRepository {
  return {
    getProofWallItem(itemId) {
      return dbService.getProofWallItem(itemId) ?? null;
    },
    saveProofWallItem(item) {
      dbService.saveProofWallItem(item);
    },
  };
}
