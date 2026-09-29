import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isClientSubcollectionReadable } from '../src/services/firestore/sync';

const syncSource = readFileSync(resolve(process.cwd(), 'src/services/firestore/sync.ts'), 'utf8');

describe('Firestore subcollection reads are envelope-scoped (rules are not filters)', () => {
  it('ADMIN may read every client subcollection, including signalOutcomes', () => {
    const admin = { organizationId: 'org_aurora_01', isAdmin: true };
    expect(isClientSubcollectionReadable('signals', admin)).toBe(true);
    expect(isClientSubcollectionReadable('signalOutcomes', admin)).toBe(true);
  });

  it('CLIENT never queries ADMIN-only signalOutcomes', () => {
    const client = { organizationId: 'org_aurora_01', isAdmin: false };
    expect(isClientSubcollectionReadable('tasks', client)).toBe(true);
    expect(isClientSubcollectionReadable('signalOutcomes', client)).toBe(false);
  });

  it('no tenant scope means no subcollection reads (fail closed)', () => {
    expect(isClientSubcollectionReadable('tasks', null)).toBe(false);
  });

  it('pull and realtime listeners query with organizationId and clientId equality', () => {
    expect(syncSource).toMatch(/where\('organizationId', '==', scope\.organizationId\)/);
    expect(syncSource).toMatch(/where\('clientId', '==', clientId\)/);
    expect(syncSource).not.toMatch(/getDocs\(collection\(db,/);
    expect(syncSource).not.toMatch(/onSnapshot\(colRef/);
    expect(syncSource).toContain('getDocs(await scopedClientSubcollectionQuery(');
    expect(syncSource).toContain('onSnapshot(scopedQuery,');
  });

  it('profile and dossier singletons are read through the scoped query, not getDoc', () => {
    expect(syncSource).not.toMatch(/getDoc\(doc\(db, `\$\{clientDocPath\(clientId\)\}\/(profile|dossier)\/data`\)\)/);
    expect(syncSource).toContain("scopedClientSubcollectionQuery(db, clientId, 'profile', scope)");
    expect(syncSource).toContain("scopedClientSubcollectionQuery(db, clientId, 'dossier', scope)");
  });
});
