/**
 * SPEC-003 Phase 3 — versioned local-authoritative physical store names.
 * Formal names from brief-model.md / plan.md. Override store is the versioned sibling
 * (not named in the formal package; chosen to stay consistent and separable).
 *
 * Brief current/history/override stay OUT of dbService.saveAll / Firestore exportSnapshot.
 * Their Firestore copy is pushed in separate batches by services/firestore/strategicBriefSync.
 */

export const STRATEGIC_BRIEF_CURRENT_STORE_KEY = 'postura_strategic_brief_v1';
export const STRATEGIC_BRIEF_HISTORY_STORE_KEY = 'postura_strategic_brief_history_v1';
export const STRATEGIC_BRIEF_OVERRIDE_STORE_KEY = 'postura_strategic_brief_override_v1';

export const BRIEF_CURRENT_STORE_SCHEMA = 'brief-store-v1' as const;
export const BRIEF_HISTORY_STORE_SCHEMA = 'brief-history-store-v1' as const;
export const BRIEF_OVERRIDE_STORE_SCHEMA = 'brief-override-store-v1' as const;

export type BriefCurrentStoreSchema = typeof BRIEF_CURRENT_STORE_SCHEMA;
export type BriefHistoryStoreSchema = typeof BRIEF_HISTORY_STORE_SCHEMA;
export type BriefOverrideStoreSchema = typeof BRIEF_OVERRIDE_STORE_SCHEMA;
