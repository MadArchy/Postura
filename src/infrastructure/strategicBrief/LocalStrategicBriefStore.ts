import { StrategicBriefError } from '../../application/strategicBrief/errors';
import type { BriefWriteUnit } from '../../application/strategicBrief';
import type {
  StrategicBrief,
  StrategicBriefHistoryRecord,
  StrategicBriefOverrideRecord,
} from '../../domain/strategicBriefCore';
import { persistenceError, rethrowGoverned } from './persistenceErrors';
import {
  cloneJson,
  historyIdentity,
  parseStoredBrief,
  parseStoredHistory,
  parseStoredOverride,
  peekId,
  peekTenant,
  sortedSignalKey,
} from './serialization';
import {
  BRIEF_CURRENT_STORE_SCHEMA,
  BRIEF_HISTORY_STORE_SCHEMA,
  BRIEF_OVERRIDE_STORE_SCHEMA,
  STRATEGIC_BRIEF_CURRENT_STORE_KEY,
  STRATEGIC_BRIEF_HISTORY_STORE_KEY,
  STRATEGIC_BRIEF_OVERRIDE_STORE_KEY,
} from './storeKeys';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoreSnapshot {
  briefs: Map<string, unknown>;
  history: unknown[];
  overrides: unknown[];
}

/** Every stored Brief record, across tenants, parsed fail-closed. */
export interface StrategicBriefRecordSet {
  briefs: StrategicBrief[];
  history: StrategicBriefHistoryRecord[];
  overrides: StrategicBriefOverrideRecord[];
}

/** Records read from a remote copy; each one is parsed before it is trusted. */
export interface RemoteStrategicBriefRecords {
  briefs: readonly unknown[];
  history: readonly unknown[];
  overrides: readonly unknown[];
}

export interface RemoteMergeResult {
  merged: number;
  rejected: number;
}

function parseOrUndefined<T>(parse: (raw: unknown) => T, raw: unknown): T | undefined {
  try {
    return parse(raw);
  } catch {
    return undefined;
  }
}

function remoteBriefWins(remote: StrategicBrief, local: StrategicBrief): boolean {
  if (remote.version !== local.version) return remote.version > local.version;
  return remote.updatedAt > local.updatedAt;
}

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function resolveStorage(explicit?: StorageLike): StorageLike {
  if (explicit) return explicit;
  const globalStore = (globalThis as { localStorage?: StorageLike }).localStorage;
  return globalStore ?? memoryStorage();
}

/**
 * Local-authoritative Strategic Brief store.
 * One coherent in-memory mutation + one persist of the three versioned keys.
 * This is not a distributed Firestore transaction.
 */
export class LocalStrategicBriefStore {
  private loaded = false;
  private briefs = new Map<string, unknown>();
  private history: unknown[] = [];
  private overrides: unknown[] = [];
  private readonly commitListeners = new Set<() => void>();

  constructor(private readonly kv: StorageLike = resolveStorage()) {}

  /** Notified after each successfully persisted write unit (not after remote merges). */
  subscribe(listener: () => void): () => void {
    this.commitListeners.add(listener);
    return () => {
      this.commitListeners.delete(listener);
    };
  }

  exportRecords(): StrategicBriefRecordSet {
    this.ensureLoaded();
    return {
      briefs: [...this.briefs.values()].map((raw) => parseStoredBrief(raw)),
      history: this.history.map((raw) => parseStoredHistory(raw)),
      overrides: this.overrides.map((raw) => parseStoredOverride(raw)),
    };
  }

  /**
   * Folds a remote copy into the local store: a Brief keeps its highest version (newest
   * `updatedAt` on a tie); history and override audits are unioned by identity.
   * Malformed remote records, and Briefs whose tenant disagrees with the local copy, are rejected.
   */
  mergeRemoteRecords(remote: RemoteStrategicBriefRecords): RemoteMergeResult {
    this.ensureLoaded();
    const snapshot = this.snapshot();
    let merged = 0;
    let rejected = 0;
    try {
      for (const raw of remote.briefs) {
        const brief = parseOrUndefined(parseStoredBrief, raw);
        if (!brief) {
          rejected += 1;
          continue;
        }
        const existingRaw = this.briefs.get(brief.id);
        if (existingRaw) {
          const local = parseStoredBrief(existingRaw);
          if (local.organizationId !== brief.organizationId || local.clientId !== brief.clientId) {
            rejected += 1;
            continue;
          }
          if (!remoteBriefWins(brief, local)) continue;
        }
        this.briefs.set(brief.id, cloneJson(brief));
        merged += 1;
      }
      const knownHistory = new Set(this.history.map((raw) => historyIdentity(parseStoredHistory(raw))));
      for (const raw of remote.history) {
        const entry = parseOrUndefined(parseStoredHistory, raw);
        if (!entry) {
          rejected += 1;
          continue;
        }
        const identity = historyIdentity(entry);
        if (knownHistory.has(identity)) continue;
        knownHistory.add(identity);
        this.history.push(cloneJson(entry));
        merged += 1;
      }
      const knownOverrides = new Set(this.overrides.map((raw) => parseStoredOverride(raw).overrideId));
      for (const raw of remote.overrides) {
        const record = parseOrUndefined(parseStoredOverride, raw);
        if (!record) {
          rejected += 1;
          continue;
        }
        if (knownOverrides.has(record.overrideId)) continue;
        knownOverrides.add(record.overrideId);
        this.overrides.push(cloneJson(record));
        merged += 1;
      }
      if (merged > 0) this.persistAll();
    } catch (err) {
      this.restore(snapshot);
      try {
        this.persistAll();
      } catch {
        // Rollback persist is best-effort; in-memory already restored.
      }
      rethrowGoverned(err);
    }
    return { merged, rejected };
  }

  /** Test-only reset. Not part of production ports. */
  resetForTest(): void {
    this.briefs = new Map();
    this.history = [];
    this.overrides = [];
    this.loaded = true;
    try {
      this.kv.removeItem(STRATEGIC_BRIEF_CURRENT_STORE_KEY);
      this.kv.removeItem(STRATEGIC_BRIEF_HISTORY_STORE_KEY);
      this.kv.removeItem(STRATEGIC_BRIEF_OVERRIDE_STORE_KEY);
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  getById(briefId: string, tenant: { organizationId: string; clientId: string }): StrategicBrief | undefined {
    this.ensureLoaded();
    const raw = this.briefs.get(briefId);
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) {
      throw persistenceError('Malformed persisted StrategicBrief.');
    }
    if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
      return undefined;
    }
    return parseStoredBrief(raw);
  }

  findCurrentByScope(scope: {
    organizationId: string;
    clientId: string;
    thesisId: string;
    signalIds: readonly string[];
  }): StrategicBrief | undefined {
    this.ensureLoaded();
    const wantedSignals = sortedSignalKey(scope.signalIds);
    const matches: StrategicBrief[] = [];
    for (const raw of this.briefs.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        const id = peekId(raw);
        if (id) throw persistenceError('Malformed persisted StrategicBrief.');
        continue;
      }
      if (peeked.organizationId !== scope.organizationId || peeked.clientId !== scope.clientId) {
        continue;
      }
      const brief = parseStoredBrief(raw);
      if (brief.status === 'SUPERSEDED') continue;
      if (brief.thesisId !== scope.thesisId) continue;
      if (sortedSignalKey(brief.signalIds) !== wantedSignals) continue;
      matches.push(brief);
    }
    if (matches.length > 1) {
      throw persistenceError('Malformed persisted StrategicBrief.');
    }
    return matches[0];
  }

  commitWriteUnit(unit: BriefWriteUnit): void {
    this.ensureLoaded();
    const snapshot = this.snapshot();
    try {
      this.assertWriteUnitEnvelope(unit);
      this.applyWriteUnit(unit);
      this.persistAll();
    } catch (err) {
      this.restore(snapshot);
      try {
        this.persistAll();
      } catch {
        // Rollback persist is best-effort; in-memory already restored.
      }
      rethrowGoverned(err);
    }
    for (const listener of this.commitListeners) listener();
  }

  appendHistory(entry: StrategicBriefHistoryRecord): void {
    this.commitWriteUnit({ briefs: [], history: [entry] });
  }

  appendOverride(record: StrategicBriefOverrideRecord): void {
    this.commitWriteUnit({ briefs: [], history: [], overrideAudit: record });
  }

  /** Test/inspection helper — not a production port. */
  listHistory(): StrategicBriefHistoryRecord[] {
    this.ensureLoaded();
    return this.history.map((entry) => parseStoredHistory(entry));
  }

  /** Test/inspection helper — not a production port. */
  listOverrides(): StrategicBriefOverrideRecord[] {
    this.ensureLoaded();
    return this.overrides.map((entry) => parseStoredOverride(entry));
  }

  /** Test helper — count of physically stored current projections. */
  storedBriefCount(): number {
    this.ensureLoaded();
    return this.briefs.size;
  }

  /** List current Brief projections for a tenant (inspection / consumer listing). */
  listByTenant(tenant: { organizationId: string; clientId: string }): StrategicBrief[] {
    this.ensureLoaded();
    const results: StrategicBrief[] = [];
    for (const raw of this.briefs.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) continue;
      if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
        continue;
      }
      results.push(parseStoredBrief(raw));
    }
    return results;
  }

  private snapshot(): StoreSnapshot {
    return {
      briefs: new Map(this.briefs),
      history: [...this.history],
      overrides: [...this.overrides],
    };
  }

  private restore(snapshot: StoreSnapshot): void {
    this.briefs = snapshot.briefs;
    this.history = snapshot.history;
    this.overrides = snapshot.overrides;
  }

  private applyWriteUnit(unit: BriefWriteUnit): void {
    for (const brief of unit.briefs) {
      this.briefs.set(brief.id, cloneJson(brief));
    }
    for (const entry of unit.history) {
      this.appendHistoryRecord(entry);
    }
    if (unit.overrideAudit) {
      this.appendOverrideRecord(unit.overrideAudit);
    }
  }

  private appendHistoryRecord(entry: StrategicBriefHistoryRecord): void {
    const identity = historyIdentity(entry);
    const exists = this.history.some((raw) => historyIdentity(parseStoredHistory(raw)) === identity);
    if (exists) return;
    this.history.push(cloneJson(entry));
  }

  private appendOverrideRecord(record: StrategicBriefOverrideRecord): void {
    const exists = this.overrides.some((raw) => {
      const parsed = parseStoredOverride(raw);
      return parsed.overrideId === record.overrideId;
    });
    if (exists) return;
    this.overrides.push(cloneJson(record));
  }

  private assertWriteUnitEnvelope(unit: BriefWriteUnit): void {
    const entities: Array<{ organizationId: string; clientId: string; briefId?: string }> = [];
    for (const brief of unit.briefs) {
      entities.push({
        organizationId: brief.organizationId,
        clientId: brief.clientId,
        briefId: brief.id,
      });
    }
    for (const entry of unit.history) {
      entities.push({
        organizationId: entry.organizationId,
        clientId: entry.clientId,
        briefId: entry.briefId,
      });
    }
    if (unit.overrideAudit) {
      entities.push({
        organizationId: unit.overrideAudit.organizationId,
        clientId: unit.overrideAudit.clientId,
        briefId: unit.overrideAudit.briefId,
      });
    }
    if (entities.length === 0) return;

    const org = entities[0].organizationId;
    const client = entities[0].clientId;
    if (!org || !client) {
      throw new StrategicBriefError('TENANT_CONTEXT_INVALID', 'Write unit tenant envelope is required.');
    }
    for (const entity of entities) {
      if (entity.organizationId !== org || entity.clientId !== client) {
        throw new StrategicBriefError(
          'TENANT_CONTEXT_INVALID',
          'Write unit entities disagree on tenant identity.'
        );
      }
    }

    const unitBriefs = new Map(unit.briefs.map((brief) => [brief.id, brief]));
    for (const brief of unit.briefs) {
      const existingRaw = this.briefs.get(brief.id);
      if (!existingRaw) continue;
      const existing = peekTenant(existingRaw);
      if (!existing) {
        throw persistenceError('Malformed persisted StrategicBrief.');
      }
      if (existing.organizationId !== brief.organizationId || existing.clientId !== brief.clientId) {
        throw new StrategicBriefError(
          'TENANT_CONTEXT_INVALID',
          'Write unit tenant does not match stored Brief ownership.'
        );
      }
    }

    const historyAndAudit = [
      ...unit.history.map((entry) => ({ briefId: entry.briefId, organizationId: entry.organizationId, clientId: entry.clientId })),
      ...(unit.overrideAudit
        ? [
            {
              briefId: unit.overrideAudit.briefId,
              organizationId: unit.overrideAudit.organizationId,
              clientId: unit.overrideAudit.clientId,
            },
          ]
        : []),
    ];
    for (const ref of historyAndAudit) {
      const inUnit = unitBriefs.get(ref.briefId);
      if (inUnit) {
        if (inUnit.organizationId !== ref.organizationId || inUnit.clientId !== ref.clientId) {
          throw new StrategicBriefError(
            'TENANT_CONTEXT_INVALID',
            'Write unit history does not match Brief ownership.'
          );
        }
        continue;
      }
      const existingRaw = this.briefs.get(ref.briefId);
      if (!existingRaw) {
        throw new StrategicBriefError(
          'TENANT_CONTEXT_INVALID',
          'Write unit history does not match Brief ownership.'
        );
      }
      const existing = peekTenant(existingRaw);
      if (!existing || existing.organizationId !== ref.organizationId || existing.clientId !== ref.clientId) {
        throw new StrategicBriefError(
          'TENANT_CONTEXT_INVALID',
          'Write unit history does not match Brief ownership.'
        );
      }
    }
  }

  private persistAll(): void {
    const current = {
      schemaVersion: BRIEF_CURRENT_STORE_SCHEMA,
      briefs: [...this.briefs.values()],
    };
    const history = {
      schemaVersion: BRIEF_HISTORY_STORE_SCHEMA,
      entries: this.history,
    };
    const overrides = {
      schemaVersion: BRIEF_OVERRIDE_STORE_SCHEMA,
      records: this.overrides,
    };
    try {
      this.kv.setItem(STRATEGIC_BRIEF_CURRENT_STORE_KEY, JSON.stringify(current));
      this.kv.setItem(STRATEGIC_BRIEF_HISTORY_STORE_KEY, JSON.stringify(history));
      this.kv.setItem(STRATEGIC_BRIEF_OVERRIDE_STORE_KEY, JSON.stringify(overrides));
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.briefs = new Map();
    this.history = this.readEnvelope(
      STRATEGIC_BRIEF_HISTORY_STORE_KEY,
      BRIEF_HISTORY_STORE_SCHEMA,
      'entries'
    );
    this.overrides = this.readEnvelope(
      STRATEGIC_BRIEF_OVERRIDE_STORE_KEY,
      BRIEF_OVERRIDE_STORE_SCHEMA,
      'records'
    );
    const briefItems = this.readEnvelope(
      STRATEGIC_BRIEF_CURRENT_STORE_KEY,
      BRIEF_CURRENT_STORE_SCHEMA,
      'briefs'
    );
    for (const raw of briefItems) {
      const id = peekId(raw);
      if (!id) {
        throw persistenceError('Malformed persisted StrategicBrief.');
      }
      this.briefs.set(id, raw);
    }
    this.loaded = true;
  }

  private readEnvelope(key: string, expectedSchema: string, collectionField: string): unknown[] {
    let raw: string | null;
    try {
      raw = this.kv.getItem(key);
    } catch (err) {
      rethrowGoverned(err);
    }
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw persistenceError('Malformed persisted StrategicBrief store.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw persistenceError('Malformed persisted StrategicBrief store.');
    }
    const envelope = parsed as Record<string, unknown>;
    if (envelope.schemaVersion !== expectedSchema) {
      throw persistenceError('Malformed persisted StrategicBrief store.');
    }
    const collection = envelope[collectionField];
    if (!Array.isArray(collection)) {
      throw persistenceError('Malformed persisted StrategicBrief store.');
    }
    return collection;
  }
}

export function createLocalStrategicBriefStore(kv?: StorageLike): LocalStrategicBriefStore {
  return new LocalStrategicBriefStore(kv);
}
