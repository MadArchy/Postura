import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  assignPosturaClaims,
  CLAIM_ASSIGNMENT_DENIED_MESSAGE,
  ClaimAssignmentError,
  type ClaimAssignmentCaller,
  type ClaimAssignmentDeps,
  type ClaimAssignmentRequest,
  type TargetClaimsLookupResult,
} from '../functions/src/lib/assignPosturaClaims';
import type { PosturaAuthClaims } from '../functions/src/lib/posturaClaims';

const ORG_A = 'org_a';
const ORG_B = 'org_b';
const CLIENT_A = 'client_a';
const CLIENT_B = 'client_b';
const CALLER_UID = 'admin_a_uid';

const CLIENT_OWNERS: Record<string, string> = { [CLIENT_A]: ORG_A, [CLIENT_B]: ORG_B };
const USER_CLAIMS: Record<string, Record<string, unknown> | null> = {
  [CALLER_UID]: { role: 'ADMIN', organizationId: ORG_A, clientId: null },
  user_unbound: null,
  user_org_a_client: { role: 'CLIENT', organizationId: ORG_A, clientId: CLIENT_A },
  user_org_b: { role: 'ADMIN', organizationId: ORG_B, clientId: null },
};

const adminOrgA: ClaimAssignmentCaller = { role: 'ADMIN', organizationId: ORG_A };

function createDeps(overrides: Partial<ClaimAssignmentDeps> = {}) {
  const writes: Array<{ uid: string; claims: PosturaAuthClaims }> = [];
  const writeClaims = vi.fn(async (uid: string, claims: PosturaAuthClaims) => {
    writes.push({ uid, claims });
  });
  const clientLookups = vi.fn();
  const deps: ClaimAssignmentDeps = {
    async readTargetClaims(uid: string): Promise<TargetClaimsLookupResult> {
      return uid in USER_CLAIMS ? { found: true, customClaims: USER_CLAIMS[uid] } : { found: false };
    },
    clientOrganizations: {
      async findOwningOrganizationId(clientId: string) {
        clientLookups(clientId);
        return CLIENT_OWNERS[clientId] ?? null;
      },
    },
    writeClaims,
    ...overrides,
  };
  return { deps, writes, writeClaims, clientLookups };
}

async function expectRejected(
  caller: ClaimAssignmentCaller | null,
  request: ClaimAssignmentRequest,
  harness: ReturnType<typeof createDeps>,
  code: ClaimAssignmentError['code'],
  message?: string
) {
  const attempt = assignPosturaClaims(caller, request, harness.deps);
  await expect(attempt).rejects.toBeInstanceOf(ClaimAssignmentError);
  await expect(attempt).rejects.toMatchObject(message ? { code, message } : { code });
  expect(harness.writeClaims).not.toHaveBeenCalled();
  expect(harness.writes).toHaveLength(0);
}

describe('A31 — setPosturaClaims organization/client binding', () => {
  it('denies an ORG-A ADMIN escalating itself to ADMIN of ORG-B', async () => {
    const harness = createDeps();
    await expectRejected(
      adminOrgA,
      { uid: CALLER_UID, role: 'ADMIN', organizationId: ORG_B },
      harness,
      'permission-denied',
      CLAIM_ASSIGNMENT_DENIED_MESSAGE
    );
  });

  it('denies reassigning a user already bound to ORG-B, into either organization', async () => {
    const harness = createDeps();
    await expectRejected(
      adminOrgA,
      { uid: 'user_org_b', role: 'ADMIN', organizationId: ORG_A },
      harness,
      'permission-denied',
      CLAIM_ASSIGNMENT_DENIED_MESSAGE
    );
    await expectRejected(
      adminOrgA,
      { uid: 'user_org_b', role: 'ADMIN', organizationId: ORG_B },
      harness,
      'permission-denied',
      CLAIM_ASSIGNMENT_DENIED_MESSAGE
    );
  });

  it('denies a body organizationId that differs from the caller token, regardless of target', async () => {
    const harness = createDeps();
    for (const uid of ['user_unbound', 'user_org_a_client', CALLER_UID]) {
      await expectRejected(adminOrgA, { uid, role: 'CLIENT', organizationId: ORG_B, clientId: CLIENT_B }, harness, 'permission-denied');
    }
    expect(harness.clientLookups).not.toHaveBeenCalled();
  });

  it('denies CLIENT claims referencing a client owned by ORG-B', async () => {
    const harness = createDeps();
    await expectRejected(
      adminOrgA,
      { uid: 'user_unbound', role: 'CLIENT', organizationId: ORG_A, clientId: CLIENT_B },
      harness,
      'permission-denied',
      CLAIM_ASSIGNMENT_DENIED_MESSAGE
    );
    expect(harness.clientLookups).toHaveBeenCalledWith(CLIENT_B);
  });

  it('denies CLIENT claims referencing a nonexistent client with the same message', async () => {
    const harness = createDeps();
    await expectRejected(
      adminOrgA,
      { uid: 'user_unbound', role: 'CLIENT', organizationId: ORG_A, clientId: 'client_missing' },
      harness,
      'permission-denied',
      CLAIM_ASSIGNMENT_DENIED_MESSAGE
    );
  });

  it('denies an unknown target uid with the same message (no enumeration)', async () => {
    const harness = createDeps();
    await expectRejected(
      adminOrgA,
      { uid: 'user_missing', role: 'ADMIN', organizationId: ORG_A },
      harness,
      'permission-denied',
      CLAIM_ASSIGNMENT_DENIED_MESSAGE
    );
  });

  it('allows same-org CLIENT provisioning of an unbound user with canonical claims', async () => {
    const harness = createDeps();
    const claims = await assignPosturaClaims(
      adminOrgA,
      { uid: 'user_unbound', role: 'CLIENT', organizationId: ORG_A, clientId: CLIENT_A },
      harness.deps
    );
    expect(claims).toEqual({ role: 'CLIENT', organizationId: ORG_A, clientId: CLIENT_A });
    expect(harness.writes).toEqual([{ uid: 'user_unbound', claims }]);
  });

  it('allows same-org ADMIN assignment and keeps clientId null for ADMIN', async () => {
    const harness = createDeps();
    const claims = await assignPosturaClaims(
      adminOrgA,
      { uid: 'user_unbound', role: 'ADMIN', organizationId: ORG_A, clientId: CLIENT_A },
      harness.deps
    );
    expect(claims).toEqual({ role: 'ADMIN', organizationId: ORG_A, clientId: null });
    expect(harness.writes).toEqual([{ uid: 'user_unbound', claims }]);
    expect(harness.clientLookups).not.toHaveBeenCalled();
  });

  it('allows maintaining an already ORG-A-bound user (CLIENT promoted to ADMIN, caller re-stamped)', async () => {
    const harness = createDeps();
    await assignPosturaClaims(adminOrgA, { uid: 'user_org_a_client', role: 'ADMIN', organizationId: ORG_A }, harness.deps);
    await assignPosturaClaims(adminOrgA, { uid: CALLER_UID, role: 'ADMIN', organizationId: ORG_A }, harness.deps);
    expect(harness.writes.map((w) => w.uid)).toEqual(['user_org_a_client', CALLER_UID]);
    expect(harness.writes.every((w) => w.claims.organizationId === ORG_A)).toBe(true);
  });

  it('fails closed when the target Auth lookup errors', async () => {
    const harness = createDeps({
      async readTargetClaims() {
        throw new Error('auth backend unavailable');
      },
    });
    await expectRejected(adminOrgA, { uid: 'user_unbound', role: 'ADMIN', organizationId: ORG_A }, harness, 'unavailable');
  });

  it('fails closed when the client ownership lookup errors', async () => {
    const harness = createDeps({
      clientOrganizations: {
        async findOwningOrganizationId() {
          throw new Error('firestore unavailable');
        },
      },
    });
    await expectRejected(
      adminOrgA,
      { uid: 'user_unbound', role: 'CLIENT', organizationId: ORG_A, clientId: CLIENT_A },
      harness,
      'unavailable'
    );
  });

  it('keeps CLIENT, unauthenticated and org-less callers denied', async () => {
    const harness = createDeps();
    const request = { uid: 'user_unbound', role: 'ADMIN', organizationId: ORG_A };
    await expectRejected({ role: 'CLIENT', organizationId: ORG_A }, request, harness, 'permission-denied', 'ADMIN required');
    await expectRejected(null, request, harness, 'permission-denied', 'ADMIN required');
    await expectRejected({ role: 'ADMIN', organizationId: '  ' }, request, harness, 'permission-denied', 'ADMIN required');
  });

  it('preserves claim-shape validation (missing org, CLIENT without clientId, unknown role, path-like clientId)', async () => {
    const harness = createDeps();
    await expectRejected(adminOrgA, { uid: 'user_unbound', role: 'ADMIN' }, harness, 'invalid-argument');
    await expectRejected(adminOrgA, { uid: 'user_unbound', role: 'CLIENT', organizationId: ORG_A }, harness, 'invalid-argument');
    await expectRejected(adminOrgA, { uid: 'user_unbound', role: 'SUPERUSER', organizationId: ORG_A }, harness, 'invalid-argument');
    await expectRejected(adminOrgA, { role: 'ADMIN', organizationId: ORG_A }, harness, 'invalid-argument');
    await expectRejected(
      adminOrgA,
      { uid: 'user_unbound', role: 'CLIENT', organizationId: ORG_A, clientId: `${CLIENT_A}/x/y` },
      harness,
      'permission-denied'
    );
  });

  it('wires the Cloud Function to the binding use-case and never calls setCustomUserClaims directly elsewhere', () => {
    const indexSource = readFileSync('functions/src/index.ts', 'utf8');
    const setClaimsBlock = indexSource.slice(indexSource.indexOf('export const setPosturaClaims'));
    expect(setClaimsBlock).toMatch(/assignPosturaClaims\(/);
    expect(indexSource.match(/setCustomUserClaims\(/g)).toHaveLength(1);
    expect(setClaimsBlock).toMatch(/writeClaims: \(uid, claims\) => getAuth\(\)\.setCustomUserClaims\(uid, claims\)/);
  });
});
