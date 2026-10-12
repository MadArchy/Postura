/**
 * SPEC-009 managed Firestore export (CUTOVER-E backup step) — separate from the audit.
 *
 * Default mode is PLAN ONLY: it validates inputs and prints what would run, with no
 * network call. A real export starts only with `--execute --confirm-blaze`; the managed
 * export needs billing (Blaze) and an existing bucket in a location compatible with the
 * database (`nam5` → `US` multi-region). Billing is NOT assumed to be enabled.
 *
 * Authentication: short-lived token minted in memory by gcloud (active account, or
 * `--impersonate-service-account <email>` with export permission). No JSON key.
 *
 * Usage:
 *   npm run spec009:prod:backup -- --project aurora-postura-app \
 *     --output-uri-prefix gs://<bucket>/spec009-backups
 *   npm run spec009:prod:backup -- --project aurora-postura-app \
 *     --output-uri-prefix gs://<bucket>/spec009-backups --execute --confirm-blaze
 *   npm run spec009:prod:backup -- --project aurora-postura-app --verify-operation <operationName>
 *
 * Any non-zero exit is a CUTOVER-E hard stop: do not continue to audit/rules deploy.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ToolingError,
  assertImpersonationIdentity,
  assertProjectId,
  classifyHttpFailure,
  fetchAccessTokenViaGcloud,
  parseCliArgs,
  redactSecrets,
  refuseKeyCredentials,
} from './spec009-envelope-dryrun.mjs';

export const BACKUP_EXIT = Object.freeze({
  OK: 0,
  AUTH_PERMISSION: 3,
  NETWORK_API: 4,
  CONFIGURATION: 5,
  EXPORT_FAILED: 6,
  EXPORT_PENDING: 7,
});

const GS_PREFIX_PATTERN = /^gs:\/\/([a-z0-9][a-z0-9._-]{1,220}[a-z0-9])\/([A-Za-z0-9._\-/]+)$/;
const OPERATION_PATTERN = /^projects\/[a-z0-9-]+\/databases\/\(default\)\/operations\/[A-Za-z0-9_-]+$/;

export function parseOutputUriPrefix(value) {
  const m = typeof value === 'string' ? GS_PREFIX_PATTERN.exec(value.replace(/\/+$/, '')) : null;
  if (!m) {
    throw new ToolingError('CONFIGURATION', '--output-uri-prefix gs://<bucket>/<prefix> is required.');
  }
  return { bucket: m[1], prefix: m[2] };
}

export function timestampedOutputUri({ bucket, prefix }, now) {
  return `gs://${bucket}/${prefix}/${now.toISOString().replace(/[:.]/g, '-')}`;
}

function createClient({ accessToken, fetchImpl }) {
  return async function request(method, url, body) {
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
      throw new ToolingError('NETWORK_API', 'Google API request failed (network).');
    }
    if (!res.ok) {
      throw new ToolingError(classifyHttpFailure(res.status), `Google API returned HTTP ${res.status}.`);
    }
    return res.json();
  };
}

export async function startExport({ request, projectId, outputUriPrefix }) {
  const op = await request(
    'POST',
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
    { outputUriPrefix }
  );
  if (!op?.name) throw new ToolingError('EXPORT_FAILED', 'Export did not return an operation name.');
  return op.name;
}

export async function readOperation({ request, operationName }) {
  const op = await request('GET', `https://firestore.googleapis.com/v1/${operationName}`);
  if (!op.done) return { state: 'PENDING', operation: op };
  if (op.error) return { state: 'FAILED', operation: op, message: op.error.message ?? 'unknown export error' };
  return { state: 'SUCCESSFUL', operation: op };
}

export async function waitForOperation({ request, operationName, sleep, pollMs, maxWaitMs }) {
  let waited = 0;
  for (;;) {
    const result = await readOperation({ request, operationName });
    if (result.state !== 'PENDING') return result;
    if (waited >= maxWaitMs) return result;
    await sleep(pollMs);
    waited += pollMs;
  }
}

export async function verifyExportOutput({ request, outputUriPrefix }) {
  const { bucket, prefix } = parseOutputUriPrefix(outputUriPrefix);
  const listing = await request(
    'GET',
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(prefix)}`
  );
  const names = (listing.items ?? []).map((item) => item.name);
  const hasMetadata = names.some((n) => n.endsWith('.overall_export_metadata') || n.endsWith('.export_metadata'));
  return { fileCount: names.length, verified: names.length > 0 && hasMetadata };
}

export async function main(argv, deps = {}) {
  const {
    fetchImpl = globalThis.fetch,
    getAccessToken = fetchAccessTokenViaGcloud,
    stdout = (line) => console.log(line),
    stderr = (line) => console.error(line),
    now = () => new Date(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    pollMs = 5000,
    maxWaitMs = 30 * 60 * 1000,
  } = deps;
  const secrets = [];
  const out = (line) => stdout(redactSecrets(line, secrets));
  const err = (line) => stderr(redactSecrets(line, secrets));

  try {
    const flags = parseCliArgs(argv);
    refuseKeyCredentials(flags);
    const projectId = assertProjectId(flags.get('--project'));
    const identityFlag = flags.get('--impersonate-service-account');
    const identity = identityFlag === undefined ? null : assertImpersonationIdentity(identityFlag);
    const verifyOperation = flags.get('--verify-operation');

    const authorize = async () => {
      const token = await getAccessToken(identity);
      secrets.push(token);
      return createClient({ accessToken: token, fetchImpl });
    };

    if (verifyOperation !== undefined) {
      if (typeof verifyOperation !== 'string' || !OPERATION_PATTERN.test(verifyOperation)) {
        throw new ToolingError('CONFIGURATION', '--verify-operation needs a full Firestore operation name.');
      }
      const request = await authorize();
      const result = await readOperation({ request, operationName: verifyOperation });
      out(`OPERATION = ${verifyOperation}`);
      out(`EXPORT STATE = ${result.state}`);
      if (result.state === 'FAILED') {
        err(`EXPORT FAILED: ${result.message} — CUTOVER-E HARD STOP`);
        return BACKUP_EXIT.EXPORT_FAILED;
      }
      return result.state === 'SUCCESSFUL' ? BACKUP_EXIT.OK : BACKUP_EXIT.EXPORT_PENDING;
    }

    const outputUriPrefix = timestampedOutputUri(parseOutputUriPrefix(flags.get('--output-uri-prefix')), now());
    const execute = flags.get('--execute') === true;

    out('=== SPEC-009 Firestore managed export ===');
    out(`PROJECT = ${projectId}`);
    out('DATABASE = (default)');
    out(`OUTPUT = ${outputUriPrefix}`);
    out(`IDENTITY = ${identity ?? 'gcloud active account'}`);
    out('PREREQUISITES = Blaze billing confirmed by a human; bucket exists in a location compatible with the database');

    if (!execute) {
      out(`EQUIVALENT = gcloud firestore export ${outputUriPrefix} --project ${projectId}`);
      out('MODE = PLAN ONLY (no request sent). Re-run with --execute --confirm-blaze to export.');
      return BACKUP_EXIT.OK;
    }
    if (flags.get('--confirm-blaze') !== true) {
      throw new ToolingError(
        'CONFIGURATION',
        '--execute requires --confirm-blaze (human-confirmed Blaze billing; status is not assumed).'
      );
    }

    const request = await authorize();
    const operationName = await startExport({ request, projectId, outputUriPrefix });
    out(`OPERATION = ${operationName}`);
    const result = await waitForOperation({ request, operationName, sleep, pollMs, maxWaitMs });
    out(`EXPORT STATE = ${result.state}`);
    if (result.state === 'FAILED') {
      err(`EXPORT FAILED: ${result.message} — CUTOVER-E HARD STOP`);
      return BACKUP_EXIT.EXPORT_FAILED;
    }
    if (result.state === 'PENDING') {
      err(`EXPORT NOT FINISHED — verify later with --verify-operation ${operationName}; do not continue CUTOVER-E.`);
      return BACKUP_EXIT.EXPORT_PENDING;
    }
    const verification = await verifyExportOutput({ request, outputUriPrefix });
    out(`EXPORT FILES = ${verification.fileCount}`);
    if (!verification.verified) {
      err('EXPORT OUTPUT NOT VERIFIED (metadata missing) — CUTOVER-E HARD STOP');
      return BACKUP_EXIT.EXPORT_FAILED;
    }
    out('BACKUP = VERIFIED');
    return BACKUP_EXIT.OK;
  } catch (error) {
    const kind = error instanceof ToolingError ? error.kind : 'NETWORK_API';
    const message = error instanceof Error ? error.message : String(error);
    err(`BACKUP FAILED [${kind}]: ${message} — CUTOVER-E HARD STOP`);
    return BACKUP_EXIT[kind] ?? BACKUP_EXIT.NETWORK_API;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
