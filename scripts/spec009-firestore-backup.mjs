/**
 * SPEC-009 T-009-16A.1 — Managed Firestore export (backup closure).
 * READ-ONLY for application documents — export API only.
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="$env:USERPROFILE\.firebase-credentials\firebase-sa.json"
 *   node scripts/spec009-firestore-backup.mjs
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import pkg from '@google-cloud/firestore';
import { GoogleAuth } from 'google-auth-library';

const { v1: firestoreV1 } = pkg;

const REPO_ROOT = resolve(process.cwd());
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'aurora-postura-app';
const REPORT_DIR = resolve(
  process.env.USERPROFILE || process.env.HOME || REPO_ROOT,
  '.firebase-credentials',
  'spec009-reports'
);

function isPathInsideRepo(absPath) {
  const root = normalize(REPO_ROOT).toLowerCase();
  const target = normalize(resolve(absPath)).toLowerCase();
  return target === root || target.startsWith(root + '\\') || target.startsWith(root + '/');
}

function resolveCredentialPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!fromEnv) {
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS not set.');
    process.exit(1);
  }
  const abs = resolve(fromEnv);
  if (!existsSync(abs)) {
    console.error(`ERROR: credential file missing: ${abs}`);
    process.exit(1);
  }
  if (isPathInsideRepo(abs)) {
    console.error('ERROR: credential path inside repository.');
    process.exit(1);
  }
  return abs;
}

function verifyProjectFromSa(keyPath) {
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  if (sa.project_id !== PROJECT_ID) {
    console.error(`ERROR: SA project_id (${sa.project_id}) != ${PROJECT_ID}`);
    process.exit(1);
  }
  return sa.project_id;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseGsUri(uri) {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!m) return null;
  return { bucket: m[1], prefix: m[2] };
}

async function pollOperation(adminClient, operationName, maxWaitMs = 600_000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const [op] = await adminClient.checkExportDocumentsProgress(operationName);
    if (op.done) {
      if (op.error) {
        throw new Error(op.error.message || JSON.stringify(op.error));
      }
      return op;
    }
    const pct = op.metadata?.progressDocuments?.completedWorkEstimate ?? '?';
    process.stdout.write(`  export progress… done=${op.done} estimate=${pct}\r`);
    await sleep(5000);
  }
  throw new Error(`Export timed out after ${maxWaitMs}ms`);
}

async function validateExportOutput(outputUriPrefix) {
  const parsed = parseGsUri(outputUriPrefix);
  if (!parsed) throw new Error(`Invalid output URI: ${outputUriPrefix}`);
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const url =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(parsed.bucket)}/o` +
    `?prefix=${encodeURIComponent(parsed.prefix)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GCS list failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const names = (data.items || []).map((item) => item.name);
  const hasMetadata = names.some((n) => n.endsWith('.export_metadata'));
  const hasOverall = names.some((n) => n.endsWith('.overall_export_metadata'));
  return {
    bucket: parsed.bucket,
    prefix: parsed.prefix,
    fileCount: names.length,
    hasExportMetadata: hasMetadata,
    hasOverallExportMetadata: hasOverall,
    verified: names.length > 0 && (hasMetadata || hasOverall),
  };
}

async function main() {
  const keyPath = resolveCredentialPath();
  verifyProjectFromSa(keyPath);
  mkdirSync(REPORT_DIR, { recursive: true });

  const adminClient = new firestoreV1.FirestoreAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const databaseName = adminClient.databasePath(PROJECT_ID, '(default)');

  // Dedicated prefix — never overwrite prior backups (unique timestamp folder).
  const bucket = `${PROJECT_ID}.appspot.com`;
  const outputUriPrefix = `gs://${bucket}/spec009-backups/${timestamp}`;

  console.log('\n=== SPEC-009 T-009-16A.1 — Firestore managed export ===\n');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Target: production (default database)`);
  console.log(`Output: ${outputUriPrefix}`);
  console.log(`Credential: external (outside repo)\n`);

  let operationName;
  try {
    const [operation] = await adminClient.exportDocuments({
      name: databaseName,
      outputUriPrefix,
    });
    operationName = operation.name;
    console.log(`Operation started: ${operationName}\n`);
  } catch (err) {
    console.error('EXPORT START FAILED:', err.message || err);
    process.exit(1);
  }

  let completedOp;
  try {
    completedOp = await pollOperation(adminClient, operationName);
    console.log('\nExport operation: SUCCESS (done=true)\n');
  } catch (err) {
    console.error('EXPORT COMPLETION FAILED:', err.message || err);
    process.exit(1);
  }

  let validation;
  try {
    validation = await validateExportOutput(outputUriPrefix);
  } catch (err) {
    console.error('EXPORT VALIDATION FAILED:', err.message || err);
    process.exit(1);
  }

  if (!validation.verified) {
    console.error('EXPORT OUTPUT NOT VERIFIED — metadata files missing.');
    process.exit(1);
  }

  const report = {
    task: 'T-009-16A.1',
    projectId: PROJECT_ID,
    environment: 'production',
    timestamp,
    operationName,
    outputUriPrefix,
    scope: 'full Firestore (default) database — rollback scope for SPEC-009 envelope migration',
    status: 'VERIFIED',
    validation,
    applicationDataWrites: { created: 0, updated: 0, deleted: 0 },
    completedAt: new Date().toISOString(),
  };

  const reportPath = resolve(REPORT_DIR, `T-009-16A.1-backup-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('Backup: VERIFIED');
  console.log(`  operation: ${operationName}`);
  console.log(`  location: ${outputUriPrefix}`);
  console.log(`  files: ${validation.fileCount}`);
  console.log(`  report: ${reportPath}`);
  console.log('\nApplication data writes: 0\n');
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
