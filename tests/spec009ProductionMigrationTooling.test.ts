import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  AUDIT_EXIT,
  ENVELOPE_FAMILY_MATRIX,
  READ_ONLY_AUDIT_IDENTITY,
  STRATEGIC_BRIEF_FAMILIES,
  fetchAccessTokenViaGcloud,
  main as auditMain,
} from '../scripts/spec009-envelope-dryrun.mjs';
import { BACKUP_EXIT, main as backupMain } from '../scripts/spec009-firestore-backup.mjs';

const ROOT = resolve(__dirname, '..');
const FAKE_TOKEN = 'ya29.FAKE-TEST-TOKEN-0123456789';
const PROJECT = 'aurora-postura-app';
const PRIVATE_TEXT = 'PRIVATE-BUSINESS-PAYLOAD';
const PROD_ARGS = ['--project', PROJECT, '--impersonate-service-account', READ_ONLY_AUDIT_IDENTITY];

interface FakeDoc {
  id: string;
  organizationId?: string;
  clientId?: string;
}

interface FakeClient {
  organizationId?: string;
  missingDocument?: boolean;
  subs?: Record<string, FakeDoc[]>;
}

interface FetchCall {
  method: string;
  url: string;
  authorization: string | undefined;
}

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function respond(body: unknown, status = 200): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function docName(path: string) {
  return `projects/${PROJECT}/databases/(default)/documents/${path}`;
}

function stringFields(source: Record<string, string | undefined>, masked: string[] | null) {
  const fields: Record<string, { stringValue: string }> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (masked && !masked.includes(key)) continue;
    fields[key] = { stringValue: value };
  }
  return fields;
}

/** Fake Firestore REST surface; `honorMask: false` simulates a server returning payload anyway. */
function fakeFirestore(clients: Record<string, FakeClient>, options: { honorMask?: boolean; pageSize?: number } = {}) {
  const calls: FetchCall[] = [];
  const honorMask = options.honorMask ?? true;
  const pageSize = options.pageSize ?? Number.POSITIVE_INFINITY;

  const fetchImpl = vi.fn(async (url: string, init: { method: string; headers: Record<string, string> }) => {
    calls.push({ method: init.method, url, authorization: init.headers.Authorization });
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).split('/documents/')[1] ?? '';
    const masked = parsed.searchParams.getAll('mask.fieldPaths');
    const mask = honorMask && masked.length ? masked : null;

    if (init.method === 'POST' && path.endsWith(':listCollectionIds')) {
      const clientId = path.replace(':listCollectionIds', '').split('/')[1];
      return respond({ collectionIds: Object.keys(clients[clientId]?.subs ?? {}) });
    }
    if (init.method !== 'GET') return respond({ error: 'unexpected' }, 500);

    const segments = path.split('/');
    let docs: Array<Record<string, unknown>>;
    if (segments.length === 1 && segments[0] === 'clients') {
      const showMissing = parsed.searchParams.get('showMissing') === 'true';
      docs = Object.entries(clients)
        .filter(([, c]) => showMissing || !c.missingDocument)
        .map(([id, c]) =>
          c.missingDocument
            ? { name: docName(`clients/${id}`) }
            : {
                name: docName(`clients/${id}`),
                createTime: '2026-10-12T00:00:00Z',
                fields: stringFields({ organizationId: c.organizationId, title: PRIVATE_TEXT }, mask),
              }
        );
    } else if (segments.length === 3 && segments[0] === 'clients') {
      const [, clientId, family] = segments;
      docs = (clients[clientId]?.subs?.[family] ?? []).map((d) => ({
        name: docName(`clients/${clientId}/${family}/${d.id}`),
        createTime: '2026-10-12T00:00:00Z',
        fields: stringFields({ organizationId: d.organizationId, clientId: d.clientId, body: PRIVATE_TEXT }, mask),
      }));
    } else {
      return respond({ error: 'unexpected path' }, 500);
    }

    const offset = Number(parsed.searchParams.get('pageToken') ?? '0');
    const page = docs.slice(offset, offset + pageSize);
    const next = offset + pageSize < docs.length ? String(offset + pageSize) : undefined;
    return respond({ documents: page, ...(next ? { nextPageToken: next } : {}) });
  });

  return { fetchImpl, calls };
}

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l), text: () => [...out, ...err].join('\n') };
}

function validClient(clientId: string, org = 'org_a'): FakeClient {
  return {
    organizationId: org,
    subs: {
      signals: [
        { id: 'sig_1', organizationId: org, clientId },
        { id: 'sig_2', organizationId: org, clientId },
      ],
      profile: [{ id: 'data', organizationId: org, clientId }],
      strategicBriefs: [{ id: 'brief_1', organizationId: org, clientId }],
    },
  };
}

async function runAudit(clients: Record<string, FakeClient>, opts: { honorMask?: boolean; pageSize?: number; args?: string[] } = {}) {
  const fake = fakeFirestore(clients, opts);
  const io = capture();
  const getAccessToken = vi.fn(async () => FAKE_TOKEN);
  const writeFile = vi.fn();
  const code = await auditMain(opts.args ?? PROD_ARGS, {
    fetchImpl: fake.fetchImpl,
    getAccessToken,
    stdout: io.stdout,
    stderr: io.stderr,
    writeFile,
    repoRoot: ROOT,
  });
  return { code, ...fake, io, getAccessToken, writeFile };
}

describe('SPEC-009 envelope family matrix', () => {
  it('covers the root client plus every client-scoped family matched in firestore.rules', () => {
    const rules = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8');
    const ruleFamilies = [...rules.matchAll(/match \/clients\/\{clientId\}\/(\w+)\/\{docId\}/g)].map((m) => m[1]);
    const subFamilies = ENVELOPE_FAMILY_MATRIX.filter((f) => f.scope === 'CLIENT_SUBCOLLECTION').map((f) => f.family);

    expect([...subFamilies].sort()).toEqual([...ruleFamilies].sort());
    expect(ENVELOPE_FAMILY_MATRIX).toHaveLength(ruleFamilies.length + 1);
    expect(ENVELOPE_FAMILY_MATRIX[0]).toMatchObject({
      family: 'clients',
      scope: 'ROOT',
      requiresOrganizationId: true,
      requiresClientId: false,
    });
    for (const f of ENVELOPE_FAMILY_MATRIX.slice(1)) {
      expect(f).toMatchObject({ requiresOrganizationId: true, requiresClientId: true, absentCountsAsZeroValid: true });
      expect(f.path).toBe(`clients/{clientId}/${f.family}/{docId}`);
    }
  });

  it('includes the three Strategic Brief families with their canonical paths', () => {
    expect(STRATEGIC_BRIEF_FAMILIES).toEqual(['strategicBriefs', 'strategicBriefHistory', 'strategicBriefOverrides']);
    const sync = readFileSync(resolve(ROOT, 'src/services/firestore/strategicBriefSync.ts'), 'utf8');
    for (const family of STRATEGIC_BRIEF_FAMILIES) {
      expect(sync).toContain(`'${family}'`);
      expect(ENVELOPE_FAMILY_MATRIX.find((f) => f.family === family)?.path).toBe(`clients/{clientId}/${family}/{docId}`);
    }
  });
});

describe('SPEC-009 envelope audit — read-only behaviour', () => {
  it('passes with exit 0 when every envelope is valid', async () => {
    const r = await runAudit({ c1: validClient('c1'), c2: validClient('c2') });
    expect(r.code).toBe(AUDIT_EXIT.OK);
    const text = r.io.out.join('\n');
    expect(text).toContain('ROOT CLIENTS SCANNED = 2');
    expect(text).toContain('SUBDOCUMENTS SCANNED = 8');
    expect(text).toContain('VALID = 8');
    expect(text).toContain('AFFECTED FAMILIES = NONE');
    expect(text).toContain('RESULT = ALL_ENVELOPES_VALID');
  });

  it('only issues document reads: no write, export, backup, rules deploy or backfill', async () => {
    const r = await runAudit({ c1: validClient('c1') });
    expect(r.calls.length).toBeGreaterThan(0);
    for (const call of r.calls) {
      const isRead = call.method === 'GET' || (call.method === 'POST' && call.url.endsWith(':listCollectionIds'));
      expect(isRead).toBe(true);
      expect(call.url).not.toMatch(/exportDocuments|:commit|:batchWrite|:beginTransaction|storage\.googleapis|firebaserules/);
    }
    expect(r.writeFile).not.toHaveBeenCalled();

    const source = readFileSync(resolve(ROOT, 'scripts/spec009-envelope-dryrun.mjs'), 'utf8');
    const imports = source.split('\n').filter((line) => /^import\b|\bimport\(/.test(line));
    expect(imports.join('\n')).not.toMatch(/spec009-firestore-backup|firebase-admin|@google-cloud/);
    expect(source).not.toMatch(/exportDocuments|firebase deploy|batchWrite|cert\(/);
  });

  it('does not require or accept an Admin JSON key', async () => {
    const r = await runAudit({ c1: validClient('c1') });
    expect(r.code).toBe(AUDIT_EXIT.OK);
    expect(r.getAccessToken).toHaveBeenCalledWith(READ_ONLY_AUDIT_IDENTITY);

    for (const flag of ['--key-file', '--credentials', '--service-account-key']) {
      const refused = await runAudit({ c1: validClient('c1') }, { args: [...PROD_ARGS, flag, 'C:/keys/firebase-sa.json'] });
      expect(refused.code).toBe(AUDIT_EXIT.CONFIGURATION);
      expect(refused.calls).toHaveLength(0);
    }

    const admin = await runAudit(
      { c1: validClient('c1') },
      { args: ['--project', PROJECT, '--impersonate-service-account', `firebase-adminsdk-fbsvc@${PROJECT}.iam.gserviceaccount.com`] }
    );
    expect(admin.code).toBe(AUDIT_EXIT.CONFIGURATION);
    expect(admin.getAccessToken).not.toHaveBeenCalled();
  });

  it('requires an explicit project and impersonated identity', async () => {
    const noProject = await runAudit({}, { args: ['--impersonate-service-account', READ_ONLY_AUDIT_IDENTITY] });
    expect(noProject.code).toBe(AUDIT_EXIT.CONFIGURATION);
    const noIdentity = await runAudit({}, { args: ['--project', PROJECT] });
    expect(noIdentity.code).toBe(AUDIT_EXIT.CONFIGURATION);
    expect(noIdentity.getAccessToken).not.toHaveBeenCalled();
    const remoteEmulator = await runAudit({}, { args: ['--project', PROJECT, '--emulator-host', 'example.com:8080'] });
    expect(remoteEmulator.code).toBe(AUDIT_EXIT.CONFIGURATION);
    const insideRepo = await runAudit({}, { args: [...PROD_ARGS, '--report-file', resolve(ROOT, 'report.json')] });
    expect(insideRepo.code).toBe(AUDIT_EXIT.CONFIGURATION);
  });

  it('never prints the access token, even when requests fail', async () => {
    const ok = await runAudit({ c1: validClient('c1') });
    expect(ok.calls.every((c) => c.authorization === `Bearer ${FAKE_TOKEN}`)).toBe(true);
    expect(ok.io.text()).not.toContain(FAKE_TOKEN);

    const io = capture();
    const code = await auditMain(PROD_ARGS, {
      fetchImpl: vi.fn(async () => {
        throw new Error(`socket closed for Bearer ${FAKE_TOKEN}`);
      }),
      getAccessToken: async () => FAKE_TOKEN,
      stdout: io.stdout,
      stderr: io.stderr,
    });
    expect(code).toBe(AUDIT_EXIT.NETWORK_API);
    expect(io.text()).not.toContain(FAKE_TOKEN);
  });

  it('requests only organizationId and clientId and never emits business payload', async () => {
    const r = await runAudit({ c1: validClient('c1') }, { honorMask: false, args: [...PROD_ARGS, '--report-file', 'C:/outside-repo/report.json'] });
    expect(r.code).toBe(AUDIT_EXIT.OK);
    for (const call of r.calls.filter((c) => c.method === 'GET')) {
      expect(new URL(call.url).searchParams.getAll('mask.fieldPaths')).toEqual(['organizationId', 'clientId']);
    }
    expect(r.io.text()).not.toContain(PRIVATE_TEXT);
    expect(r.writeFile).toHaveBeenCalledTimes(1);
    expect(String(r.writeFile.mock.calls[0][1])).not.toContain(PRIVATE_TEXT);
  });

  it('follows pagination', async () => {
    const r = await runAudit({ c1: validClient('c1') }, { pageSize: 1 });
    expect(r.code).toBe(AUDIT_EXIT.OK);
    expect(r.io.out.join('\n')).toContain('SUBDOCUMENTS SCANNED = 4');
    expect(r.calls.some((c) => c.url.includes('pageToken=1'))).toBe(true);
  });
});

describe('SPEC-009 envelope audit — classification', () => {
  it('flags a document missing organizationId', async () => {
    const r = await runAudit({ c1: { organizationId: 'org_a', subs: { signals: [{ id: 's1', clientId: 'c1' }] } } });
    expect(r.code).toBe(AUDIT_EXIT.INVALID_ENVELOPES);
    const text = r.io.out.join('\n');
    expect(text).toContain('MISSING ORGANIZATION ID = 1');
    expect(text).toContain('INVALID MISSING_ORGANIZATION_ID clients/c1/signals/s1');
    expect(text).toContain('AFFECTED FAMILIES = signals');
  });

  it('flags a document missing clientId', async () => {
    const r = await runAudit({ c1: { organizationId: 'org_a', subs: { tasks: [{ id: 't1', organizationId: 'org_a' }] } } });
    expect(r.code).toBe(AUDIT_EXIT.INVALID_ENVELOPES);
    expect(r.io.out.join('\n')).toContain('MISSING CLIENT ID = 1');
  });

  it('flags a document missing both envelope fields', async () => {
    const r = await runAudit({ c1: { organizationId: 'org_a', subs: { advices: [{ id: 'a1' }] } } });
    expect(r.code).toBe(AUDIT_EXIT.INVALID_ENVELOPES);
    expect(r.io.out.join('\n')).toContain('MISSING BOTH = 1');
  });

  it('detects organization and client conflicts instead of counting them as valid', async () => {
    const r = await runAudit({
      c1: {
        organizationId: 'org_a',
        subs: {
          signals: [
            { id: 's1', organizationId: 'org_b', clientId: 'c1' },
            { id: 's2', organizationId: 'org_a', clientId: 'c2' },
          ],
        },
      },
    });
    expect(r.code).toBe(AUDIT_EXIT.INVALID_ENVELOPES);
    const text = r.io.out.join('\n');
    expect(text).toContain('VALID = 0');
    expect(text).toContain('ORGANIZATION CONFLICTS = 1');
    expect(text).toContain('CLIENT CONFLICTS = 1');
  });

  it('classifies subdocuments under a root client without organizationId or without a document as orphans', async () => {
    const r = await runAudit({
      c1: { subs: { signals: [{ id: 's1', organizationId: 'org_a', clientId: 'c1' }] } },
      ghost: { missingDocument: true, subs: { tasks: [{ id: 't1', organizationId: 'org_a', clientId: 'ghost' }] } },
    });
    expect(r.code).toBe(AUDIT_EXIT.INVALID_ENVELOPES);
    const text = r.io.out.join('\n');
    expect(text).toContain('ROOT CLIENTS MISSING ORGANIZATION ID = 1');
    expect(text).toContain('ORPHANS = 2');
    expect(text).toContain('AFFECTED FAMILIES = clients, signals, tasks');
  });

  it('treats configured families with zero documents as 0 valid documents', async () => {
    const r = await runAudit({ c1: { organizationId: 'org_a', subs: {} } });
    expect(r.code).toBe(AUDIT_EXIT.OK);
    expect(r.io.out.join('\n')).toContain('SUBDOCUMENTS SCANNED = 0');
    const subFamilyCount = ENVELOPE_FAMILY_MATRIX.length - 1;
    expect(r.calls.filter((c) => c.method === 'GET' && c.url.includes('/documents/clients/c1/'))).toHaveLength(subFamilyCount);
  });

  it('audits the Strategic Brief families', async () => {
    const r = await runAudit({
      c1: {
        organizationId: 'org_a',
        subs: {
          strategicBriefs: [{ id: 'b1', organizationId: 'org_a', clientId: 'c1' }],
          strategicBriefHistory: [{ id: 'h1', organizationId: 'org_a' }],
          strategicBriefOverrides: [{ id: 'o1', organizationId: 'org_b', clientId: 'c1' }],
        },
      },
    });
    for (const family of STRATEGIC_BRIEF_FAMILIES) {
      expect(r.calls.some((c) => c.url.includes(`/documents/clients/c1/${family}?`))).toBe(true);
    }
    expect(r.code).toBe(AUDIT_EXIT.INVALID_ENVELOPES);
    expect(r.io.out.join('\n')).toContain('AFFECTED FAMILIES = strategicBriefHistory, strategicBriefOverrides');
  });

  it('fails with a permission error on 403 rather than reporting zero invalid documents', async () => {
    const io = capture();
    const code = await auditMain(PROD_ARGS, {
      fetchImpl: vi.fn(async () => respond({ error: { status: 'PERMISSION_DENIED' } }, 403)),
      getAccessToken: async () => FAKE_TOKEN,
      stdout: io.stdout,
      stderr: io.stderr,
    });
    expect(code).toBe(AUDIT_EXIT.AUTH_PERMISSION);
    expect(io.out).toHaveLength(0);
    expect(io.err.join('\n')).toContain('AUDIT FAILED [AUTH_PERMISSION]');
  });
});

describe('SPEC-009 token minting', () => {
  it('impersonates the selected identity through gcloud and hides its output on failure', async () => {
    const ok = vi.fn((_cmd: string, _args: string[], _opts: object, cb: (e: Error | null, out: string) => void) => cb(null, `${FAKE_TOKEN}\n`));
    await expect(fetchAccessTokenViaGcloud(READ_ONLY_AUDIT_IDENTITY, ok)).resolves.toBe(FAKE_TOKEN);
    expect(ok.mock.calls[0][1]).toEqual(['auth', 'print-access-token', `--impersonate-service-account=${READ_ONLY_AUDIT_IDENTITY}`]);

    const fail = vi.fn((_cmd: string, _args: string[], _opts: object, cb: (e: Error | null, out: string) => void) =>
      cb(new Error(`denied ${FAKE_TOKEN}`), FAKE_TOKEN)
    );
    await expect(fetchAccessTokenViaGcloud(READ_ONLY_AUDIT_IDENTITY, fail)).rejects.toMatchObject({ kind: 'AUTH_PERMISSION' });
    await fetchAccessTokenViaGcloud(READ_ONLY_AUDIT_IDENTITY, fail).catch((e: Error) => expect(e.message).not.toContain(FAKE_TOKEN));
  });
});

describe('SPEC-009 Firestore backup — separate and explicit', () => {
  const BACKUP_ARGS = ['--project', PROJECT, '--output-uri-prefix', 'gs://aurora-backups/spec009-backups'];
  const OP = `projects/${PROJECT}/databases/(default)/operations/ASA1`;

  function backupFetch(opStates: Array<Record<string, unknown>>, gcsItems: string[] = ['x/x.overall_export_metadata']) {
    const calls: FetchCall[] = [];
    let polls = 0;
    const fetchImpl = vi.fn(async (url: string, init: { method: string; headers: Record<string, string> }) => {
      calls.push({ method: init.method, url, authorization: init.headers.Authorization });
      if (url.endsWith(':exportDocuments')) return respond({ name: OP });
      if (url.includes('/operations/')) return respond(opStates[Math.min(polls++, opStates.length - 1)]);
      if (url.startsWith('https://storage.googleapis.com/')) return respond({ items: gcsItems.map((name) => ({ name })) });
      return respond({}, 500);
    });
    return { fetchImpl, calls };
  }

  async function runBackup(args: string[], fetchImpl = vi.fn()) {
    const io = capture();
    const getAccessToken = vi.fn(async () => FAKE_TOKEN);
    const code = await backupMain(args, {
      fetchImpl,
      getAccessToken,
      stdout: io.stdout,
      stderr: io.stderr,
      now: () => new Date('2026-10-12T17:00:00.000Z'),
      sleep: async () => undefined,
      pollMs: 1,
      maxWaitMs: 3,
    });
    return { code, io, getAccessToken, fetchImpl };
  }

  it('running the audit never invokes the backup', async () => {
    const r = await runAudit({ c1: validClient('c1') });
    expect(r.calls.some((c) => c.url.includes('exportDocuments'))).toBe(false);
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['spec009:prod:audit']).toBe('node scripts/spec009-envelope-dryrun.mjs');
    expect(pkg.scripts['spec009:prod:backup']).toBe('node scripts/spec009-firestore-backup.mjs');
    for (const [name, command] of Object.entries(pkg.scripts)) {
      const touchesSpec009 = name.startsWith('spec009') || command.includes('spec009');
      if (touchesSpec009) {
        expect(command).not.toMatch(/&&|;|firebase deploy|backfill/);
      }
    }
    expect(Object.keys(pkg.scripts).some((name) => /backfill/i.test(name))).toBe(false);
  });

  it('defaults to plan-only mode with no token and no request', async () => {
    const r = await runBackup(BACKUP_ARGS);
    expect(r.code).toBe(BACKUP_EXIT.OK);
    expect(r.fetchImpl).not.toHaveBeenCalled();
    expect(r.getAccessToken).not.toHaveBeenCalled();
    expect(r.io.out.join('\n')).toContain('MODE = PLAN ONLY');
    expect(r.io.out.join('\n')).toContain('OUTPUT = gs://aurora-backups/spec009-backups/2026-10-12T17-00-00-000Z');
  });

  it('requires an explicit project, destination and Blaze confirmation before exporting', async () => {
    expect((await runBackup(['--output-uri-prefix', 'gs://aurora-backups/p'])).code).toBe(BACKUP_EXIT.CONFIGURATION);
    expect((await runBackup(['--project', PROJECT])).code).toBe(BACKUP_EXIT.CONFIGURATION);
    const unconfirmed = await runBackup([...BACKUP_ARGS, '--execute']);
    expect(unconfirmed.code).toBe(BACKUP_EXIT.CONFIGURATION);
    expect(unconfirmed.fetchImpl).not.toHaveBeenCalled();
    const keyed = await runBackup([...BACKUP_ARGS, '--execute', '--confirm-blaze', '--key-file', 'C:/k.json']);
    expect(keyed.code).toBe(BACKUP_EXIT.CONFIGURATION);
    expect(keyed.fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces the operation id and verifies a successful export', async () => {
    const fake = backupFetch([{ name: OP, done: false }, { name: OP, done: true, response: {} }]);
    const r = await runBackup([...BACKUP_ARGS, '--execute', '--confirm-blaze'], fake.fetchImpl);
    expect(r.code).toBe(BACKUP_EXIT.OK);
    const text = r.io.out.join('\n');
    expect(text).toContain(`OPERATION = ${OP}`);
    expect(text).toContain('BACKUP = VERIFIED');
    expect(r.io.text()).not.toContain(FAKE_TOKEN);
  });

  it('returns a hard-stop exit when the export operation fails', async () => {
    const fake = backupFetch([{ name: OP, done: true, error: { message: 'billing must be enabled' } }]);
    const r = await runBackup([...BACKUP_ARGS, '--execute', '--confirm-blaze'], fake.fetchImpl);
    expect(r.code).toBe(BACKUP_EXIT.EXPORT_FAILED);
    expect(r.io.err.join('\n')).toContain('CUTOVER-E HARD STOP');
    expect(fake.calls.some((c) => c.url.startsWith('https://storage.googleapis.com/'))).toBe(false);
  });

  it('returns non-zero when the export output cannot be verified or is still pending', async () => {
    const unverified = backupFetch([{ name: OP, done: true, response: {} }], []);
    expect((await runBackup([...BACKUP_ARGS, '--execute', '--confirm-blaze'], unverified.fetchImpl)).code).toBe(
      BACKUP_EXIT.EXPORT_FAILED
    );
    const pending = backupFetch([{ name: OP, done: false }]);
    expect((await runBackup([...BACKUP_ARGS, '--execute', '--confirm-blaze'], pending.fetchImpl)).code).toBe(
      BACKUP_EXIT.EXPORT_PENDING
    );
  });

  it('maps a 403 on export start to a permission failure', async () => {
    const denied = vi.fn(async () => respond({}, 403));
    const r = await runBackup([...BACKUP_ARGS, '--execute', '--confirm-blaze'], denied);
    expect(r.code).toBe(BACKUP_EXIT.AUTH_PERMISSION);
  });

  it('verifies an existing operation without starting a new export', async () => {
    const fake = backupFetch([{ name: OP, done: true, response: {} }]);
    const r = await runBackup(['--project', PROJECT, '--verify-operation', OP], fake.fetchImpl);
    expect(r.code).toBe(BACKUP_EXIT.OK);
    expect(fake.calls.every((c) => c.method === 'GET')).toBe(true);
    expect(fake.calls.some((c) => c.url.includes('exportDocuments'))).toBe(false);
  });
});
