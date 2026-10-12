/**
 * SPEC-009 production envelope audit — READ-ONLY verifier (T-009-16 re-verification).
 *
 * Inspects `organizationId` / `clientId` on every client-scoped Firestore family and
 * reports envelope validity. It never writes documents, never starts an export, never
 * touches claims and never invokes the backup script (`spec009-firestore-backup.mjs`).
 *
 * Authentication (production): a short-lived access token for the read-only audit
 * identity, minted in memory by `gcloud auth print-access-token
 * --impersonate-service-account=<email>`. No Admin JSON key is read or accepted; the
 * token is never printed or written to disk.
 *
 * Usage:
 *   npm run spec009:prod:audit -- --project aurora-postura-app \
 *     --impersonate-service-account postura-prod-audit-ro@aurora-postura-app.iam.gserviceaccount.com
 *
 * Local emulator (no credentials):
 *   npm run spec009:prod:audit -- --project demo-aurora-e2e --emulator-host 127.0.0.1:8080
 *
 * Optional:
 *   --report-file <path>   JSON report; must be outside the repository.
 *
 * Exit codes: see AUDIT_EXIT.
 */
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const READ_ONLY_AUDIT_IDENTITY = 'postura-prod-audit-ro@aurora-postura-app.iam.gserviceaccount.com';

export const ENVELOPE_FIELDS = Object.freeze(['organizationId', 'clientId']);

export const AUDIT_EXIT = Object.freeze({
  OK: 0,
  INVALID_ENVELOPES: 2,
  AUTH_PERMISSION: 3,
  NETWORK_API: 4,
  CONFIGURATION: 5,
});

/** Flags of the historical Admin-key workflow; refused so a key can never be selected. */
export const REFUSED_KEY_FLAGS = Object.freeze(['--key-file', '--credentials', '--service-account-key']);

const PAGE_SIZE = 300;
const MAX_INVALID_SAMPLES = 50;

const SUBCOLLECTION_SEMANTICS =
  'organizationId == parent clients/{clientId}.organizationId AND clientId == path {clientId}';

function subcollection(family, note) {
  return Object.freeze({
    family,
    path: `clients/{clientId}/${family}/{docId}`,
    scope: 'CLIENT_SUBCOLLECTION',
    requiresOrganizationId: true,
    requiresClientId: true,
    semantics: note ? `${SUBCOLLECTION_SEMANTICS} (${note})` : SUBCOLLECTION_SEMANTICS,
    absentCountsAsZeroValid: true,
  });
}

/**
 * Families audited, derived from `firestore.rules` at HEAD: every
 * `clients/{clientId}/<family>` match reads through `existingSubEnvelopeValid`,
 * which requires both envelope fields; the root client requires `organizationId`.
 */
export const ENVELOPE_FAMILY_MATRIX = Object.freeze([
  Object.freeze({
    family: 'clients',
    path: 'clients/{clientId}',
    scope: 'ROOT',
    requiresOrganizationId: true,
    requiresClientId: false,
    semantics: 'non-empty organizationId; clientId is the document id',
    absentCountsAsZeroValid: true,
  }),
  subcollection('sources'),
  subcollection('signals'),
  subcollection('curation'),
  subcollection('theses'),
  subcollection('recommendations'),
  subcollection('campaigns'),
  subcollection('campaignMilestones'),
  subcollection('advices'),
  subcollection('deliveries'),
  subcollection('notifications'),
  subcollection('tasks'),
  subcollection('contents'),
  subcollection('opportunities'),
  subcollection('profile', 'fixed doc id "data"'),
  subcollection('dossier', 'fixed doc id "data"'),
  subcollection('evidence'),
  subcollection('results'),
  subcollection('feedbackEvents'),
  subcollection('signalOutcomes'),
  subcollection('proofWallItems'),
  subcollection('aiRuns'),
  subcollection('strategicBriefs', 'T604 ADMIN-only'),
  subcollection('strategicBriefHistory', 'T604 ADMIN-only, append-only'),
  subcollection('strategicBriefOverrides', 'T604 ADMIN-only, append-only'),
]);

export const STRATEGIC_BRIEF_FAMILIES = Object.freeze([
  'strategicBriefs',
  'strategicBriefHistory',
  'strategicBriefOverrides',
]);

export class ToolingError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'ToolingError';
    this.kind = kind;
  }
}

export function redactSecrets(text, secrets) {
  let out = String(text);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

export function parseCliArgs(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new ToolingError('CONFIGURATION', `Unexpected argument: ${arg}`);
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags.set(arg.slice(0, eq), arg.slice(eq + 1));
    } else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      flags.set(arg, argv[i + 1]);
      i += 1;
    } else {
      flags.set(arg, true);
    }
  }
  return flags;
}

const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const SERVICE_ACCOUNT_PATTERN = /^[a-z][a-z0-9-]{4,29}@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/;
const EMULATOR_HOST_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\]):\d{2,5}$/;

export function assertProjectId(value) {
  if (typeof value !== 'string' || !PROJECT_ID_PATTERN.test(value)) {
    throw new ToolingError('CONFIGURATION', '--project <projectId> is required (no default project).');
  }
  return value;
}

export function refuseKeyCredentials(flags) {
  for (const flag of REFUSED_KEY_FLAGS) {
    if (flags.has(flag)) {
      throw new ToolingError(
        'CONFIGURATION',
        `${flag} is refused: service-account JSON keys are not allowed; use --impersonate-service-account.`
      );
    }
  }
}

export function assertImpersonationIdentity(value) {
  if (typeof value !== 'string' || !SERVICE_ACCOUNT_PATTERN.test(value)) {
    throw new ToolingError(
      'CONFIGURATION',
      '--impersonate-service-account <email> is required for a non-emulator project.'
    );
  }
  if (/^firebase-adminsdk/i.test(value)) {
    throw new ToolingError('CONFIGURATION', 'Refusing a Firebase Admin SDK identity; use the read-only audit identity.');
  }
  return value;
}

export function isPathInsideRepo(absPath, repoRoot) {
  const root = normalize(resolve(repoRoot)).toLowerCase();
  const target = normalize(resolve(absPath)).toLowerCase();
  return target === root || target.startsWith(root + '\\') || target.startsWith(root + '/');
}

/** Mints a short-lived token in memory via gcloud; stdout/stderr are never echoed. */
export function fetchAccessTokenViaGcloud(serviceAccount, execFileImpl = execFile) {
  const args = ['auth', 'print-access-token'];
  if (serviceAccount) args.push(`--impersonate-service-account=${serviceAccount}`);
  const isWindows = process.platform === 'win32';
  return new Promise((resolvePromise, reject) => {
    execFileImpl(
      isWindows ? 'gcloud.cmd' : 'gcloud',
      args,
      { shell: isWindows, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        const token = typeof stdout === 'string' ? stdout.trim() : '';
        if (error || !token) {
          reject(new ToolingError('AUTH_PERMISSION', 'gcloud could not mint an access token for the selected identity.'));
          return;
        }
        resolvePromise(token);
      }
    );
  });
}

export function classifyHttpFailure(status) {
  return status === 401 || status === 403 ? 'AUTH_PERMISSION' : 'NETWORK_API';
}

/** Read-only HTTP client: any request other than a document read is an incident. */
function createReadOnlyClient({ baseUrl, accessToken, fetchImpl }) {
  async function request(method, url, body) {
    const isListCollectionIds = method === 'POST' && url.endsWith(':listCollectionIds');
    if (method !== 'GET' && !isListCollectionIds) {
      throw new ToolingError('CONFIGURATION', `INCIDENT: non-read request blocked (${method}).`);
    }
    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ToolingError('NETWORK_API', 'Firestore API request failed (network).');
    }
    if (!res.ok) {
      throw new ToolingError(classifyHttpFailure(res.status), `Firestore API returned HTTP ${res.status}.`);
    }
    return res.json();
  }

  const maskQuery = ENVELOPE_FIELDS.map((f) => `mask.fieldPaths=${f}`).join('&');

  return {
    async listDocuments(collectionPath, { showMissing = false } = {}) {
      const documents = [];
      let pageToken;
      do {
        let url = `${baseUrl}/documents/${collectionPath}?${maskQuery}&pageSize=${PAGE_SIZE}`;
        if (showMissing) url += '&showMissing=true';
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
        const page = await request('GET', url);
        for (const doc of page.documents ?? []) documents.push(doc);
        pageToken = page.nextPageToken;
      } while (pageToken);
      return documents;
    },
    async listCollectionIds(documentPath) {
      const ids = [];
      let pageToken;
      do {
        const page = await request('POST', `${baseUrl}/documents/${documentPath}:listCollectionIds`, {
          pageSize: 100,
          ...(pageToken ? { pageToken } : {}),
        });
        for (const id of page.collectionIds ?? []) ids.push(id);
        pageToken = page.nextPageToken;
      } while (pageToken);
      return ids;
    },
  };
}

function stringField(doc, field) {
  const value = doc?.fields?.[field]?.stringValue;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function lastSegment(name) {
  const parts = String(name).split('/');
  return parts[parts.length - 1];
}

export function classifySubDoc(fields, pathClientId, parentOrgId) {
  if (!parentOrgId) return { status: 'ORPHAN' };
  const orgId = fields.organizationId;
  const clientId = fields.clientId;
  const orgConflict = orgId != null && orgId !== parentOrgId;
  const clientConflict = clientId != null && clientId !== pathClientId;
  if (orgConflict || clientConflict) return { status: 'CONFLICT', orgConflict, clientConflict };
  if (orgId == null && clientId == null) return { status: 'MISSING_BOTH' };
  if (orgId == null) return { status: 'MISSING_ORGANIZATION_ID' };
  if (clientId == null) return { status: 'MISSING_CLIENT_ID' };
  return { status: 'VALID' };
}

function emptyFamilyCounter() {
  return {
    scanned: 0,
    valid: 0,
    missingOrganizationId: 0,
    missingClientId: 0,
    missingBoth: 0,
    organizationConflicts: 0,
    clientConflicts: 0,
    orphans: 0,
  };
}

/**
 * Runs the audit through an injected fetch implementation. Returns a deterministic
 * result; throws ToolingError on auth/network/configuration failure (never treats an
 * unreadable family as zero documents).
 */
export async function runEnvelopeAudit({ projectId, baseUrl, accessToken, fetchImpl }) {
  const client = createReadOnlyClient({ baseUrl, accessToken, fetchImpl });
  const subFamilies = ENVELOPE_FAMILY_MATRIX.filter((f) => f.scope === 'CLIENT_SUBCOLLECTION');
  const matrixNames = new Set(ENVELOPE_FAMILY_MATRIX.map((f) => f.family));

  const families = {};
  for (const f of subFamilies) families[f.family] = emptyFamilyCounter();
  const root = { scanned: 0, valid: 0, missingOrganizationId: 0, missingParentDocuments: 0 };
  const invalidSamples = [];
  const unmatrixedFamilies = new Set();

  const rootDocs = await client.listDocuments('clients', { showMissing: true });
  const parents = [];
  for (const doc of rootDocs) {
    const clientId = lastSegment(doc.name);
    if (!doc.createTime) {
      root.missingParentDocuments += 1;
      parents.push({ clientId, orgId: null });
      continue;
    }
    root.scanned += 1;
    const orgId = stringField(doc, 'organizationId');
    if (orgId) {
      root.valid += 1;
    } else {
      root.missingOrganizationId += 1;
      if (invalidSamples.length < MAX_INVALID_SAMPLES) {
        invalidSamples.push({ path: `clients/${clientId}`, status: 'ROOT_MISSING_ORGANIZATION_ID' });
      }
    }
    parents.push({ clientId, orgId });
  }

  for (const { clientId, orgId } of parents) {
    for (const id of await client.listCollectionIds(`clients/${clientId}`)) {
      if (!matrixNames.has(id)) unmatrixedFamilies.add(id);
    }
    for (const f of subFamilies) {
      const counter = families[f.family];
      const docs = await client.listDocuments(`clients/${clientId}/${f.family}`);
      for (const doc of docs) {
        const fields = {
          organizationId: stringField(doc, 'organizationId'),
          clientId: stringField(doc, 'clientId'),
        };
        const c = classifySubDoc(fields, clientId, orgId);
        counter.scanned += 1;
        if (c.status === 'VALID') counter.valid += 1;
        else if (c.status === 'MISSING_ORGANIZATION_ID') counter.missingOrganizationId += 1;
        else if (c.status === 'MISSING_CLIENT_ID') counter.missingClientId += 1;
        else if (c.status === 'MISSING_BOTH') counter.missingBoth += 1;
        else if (c.status === 'ORPHAN') counter.orphans += 1;
        else if (c.status === 'CONFLICT') {
          if (c.orgConflict) counter.organizationConflicts += 1;
          if (c.clientConflict) counter.clientConflicts += 1;
        }
        if (c.status !== 'VALID' && invalidSamples.length < MAX_INVALID_SAMPLES) {
          invalidSamples.push({ path: `clients/${clientId}/${f.family}/${lastSegment(doc.name)}`, status: c.status });
        }
      }
    }
  }

  const totals = emptyFamilyCounter();
  const affectedFamilies = [];
  for (const [name, c] of Object.entries(families)) {
    for (const key of Object.keys(totals)) totals[key] += c[key];
    if (c.scanned !== c.valid) affectedFamilies.push(name);
  }
  if (root.missingOrganizationId > 0) affectedFamilies.unshift('clients');

  const invalid = root.missingOrganizationId + (totals.scanned - totals.valid);

  return {
    mode: 'READ_ONLY_ENVELOPE_AUDIT',
    projectId,
    familyCount: ENVELOPE_FAMILY_MATRIX.length,
    rootClients: root,
    families,
    totals: {
      rootClientsScanned: root.scanned,
      subdocumentsScanned: totals.scanned,
      valid: totals.valid,
      missingOrganizationId: totals.missingOrganizationId,
      missingClientId: totals.missingClientId,
      missingBoth: totals.missingBoth,
      organizationConflicts: totals.organizationConflicts,
      clientConflicts: totals.clientConflicts,
      orphans: totals.orphans,
      rootClientsMissingOrganizationId: root.missingOrganizationId,
      affectedFamilies,
    },
    invalid,
    invalidSamples,
    unmatrixedFamilies: [...unmatrixedFamilies].sort(),
    writes: { created: 0, updated: 0, deleted: 0 },
    status: invalid === 0 ? 'ALL_ENVELOPES_VALID' : 'INVALID_ENVELOPES_FOUND',
  };
}

export function formatAuditSummary(result) {
  const t = result.totals;
  const lines = [
    '=== SPEC-009 envelope audit (READ ONLY) ===',
    `PROJECT = ${result.projectId}`,
    `FAMILIES IN MATRIX = ${result.familyCount}`,
    `ROOT CLIENTS SCANNED = ${t.rootClientsScanned}`,
    `ROOT CLIENTS MISSING ORGANIZATION ID = ${t.rootClientsMissingOrganizationId}`,
    `SUBDOCUMENTS SCANNED = ${t.subdocumentsScanned}`,
    `VALID = ${t.valid}`,
    `MISSING ORGANIZATION ID = ${t.missingOrganizationId}`,
    `MISSING CLIENT ID = ${t.missingClientId}`,
    `MISSING BOTH = ${t.missingBoth}`,
    `ORGANIZATION CONFLICTS = ${t.organizationConflicts}`,
    `CLIENT CONFLICTS = ${t.clientConflicts}`,
    `ORPHANS = ${t.orphans}`,
    `AFFECTED FAMILIES = ${t.affectedFamilies.length ? t.affectedFamilies.join(', ') : 'NONE'}`,
  ];
  for (const [name, c] of Object.entries(result.families)) {
    if (c.scanned > 0) lines.push(`  ${name}: scanned=${c.scanned} valid=${c.valid}`);
  }
  if (result.unmatrixedFamilies.length) {
    lines.push(`UNMATRIXED FAMILIES (not audited, no rule match) = ${result.unmatrixedFamilies.join(', ')}`);
  }
  for (const s of result.invalidSamples) lines.push(`  INVALID ${s.status} ${s.path}`);
  lines.push('DOCUMENTS WRITTEN = 0');
  lines.push(`RESULT = ${result.status}`);
  return lines.join('\n');
}

/**
 * CLI entry. Dependencies are injectable so tests never reach gcloud or the network.
 * Returns the exit code instead of exiting.
 */
export async function main(argv, deps = {}) {
  const {
    fetchImpl = globalThis.fetch,
    getAccessToken = fetchAccessTokenViaGcloud,
    stdout = (line) => console.log(line),
    stderr = (line) => console.error(line),
    writeFile = writeFileSync,
    repoRoot = process.cwd(),
  } = deps;
  const secrets = [];
  const out = (line) => stdout(redactSecrets(line, secrets));
  const err = (line) => stderr(redactSecrets(line, secrets));

  try {
    const flags = parseCliArgs(argv);
    refuseKeyCredentials(flags);
    const projectId = assertProjectId(flags.get('--project'));
    const emulatorHost = flags.get('--emulator-host');
    const reportFile = flags.get('--report-file');
    if (reportFile !== undefined) {
      if (typeof reportFile !== 'string') throw new ToolingError('CONFIGURATION', '--report-file needs a path.');
      if (isPathInsideRepo(reportFile, repoRoot)) {
        throw new ToolingError('CONFIGURATION', '--report-file must be outside the repository.');
      }
    }

    let baseUrl;
    let accessToken;
    if (emulatorHost !== undefined) {
      if (typeof emulatorHost !== 'string' || !EMULATOR_HOST_PATTERN.test(emulatorHost)) {
        throw new ToolingError('CONFIGURATION', '--emulator-host must be a loopback host:port.');
      }
      baseUrl = `http://${emulatorHost}/v1/projects/${projectId}/databases/(default)`;
      accessToken = 'owner';
    } else {
      const identity = assertImpersonationIdentity(flags.get('--impersonate-service-account'));
      if (identity !== READ_ONLY_AUDIT_IDENTITY) {
        err(`WARNING: ${identity} is not the frozen read-only audit identity (${READ_ONLY_AUDIT_IDENTITY}).`);
      }
      baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
      accessToken = await getAccessToken(identity);
      secrets.push(accessToken);
    }

    const result = await runEnvelopeAudit({ projectId, baseUrl, accessToken, fetchImpl });
    out(formatAuditSummary(result));
    if (typeof reportFile === 'string') {
      writeFile(resolve(reportFile), JSON.stringify(result, null, 2), 'utf8');
      out(`REPORT = ${resolve(reportFile)}`);
    }
    return result.invalid === 0 ? AUDIT_EXIT.OK : AUDIT_EXIT.INVALID_ENVELOPES;
  } catch (error) {
    const kind = error instanceof ToolingError ? error.kind : 'NETWORK_API';
    const message = error instanceof Error ? error.message : String(error);
    err(`AUDIT FAILED [${kind}]: ${message}`);
    return AUDIT_EXIT[kind] ?? AUDIT_EXIT.NETWORK_API;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
