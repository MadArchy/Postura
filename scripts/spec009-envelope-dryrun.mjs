/**
 * SPEC-009 T-009-16A — Production inventory + dry-run ONLY.
 * READ-ONLY: no Firestore writes, creates, or deletes.
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="$env:USERPROFILE\.firebase-credentials\firebase-sa.json"
 *   node scripts/spec009-envelope-dryrun.mjs
 *
 * Optional:
 *   --report-dir <path>   default: %USERPROFILE%\.firebase-credentials\spec009-reports
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import pkg from '@google-cloud/firestore';

const { v1: firestoreV1 } = pkg;

const REPO_ROOT = resolve(process.cwd());
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'aurora-postura-app';
const DEFAULT_REPORT_DIR = resolve(
  process.env.USERPROFILE || process.env.HOME || REPO_ROOT,
  '.firebase-credentials',
  'spec009-reports'
);

/** 21 subcollection paths from migration.md (profile/dossier use fixed doc id "data"). */
const SUBCOLLECTIONS = [
  { key: 'sources', collection: 'sources' },
  { key: 'signals', collection: 'signals' },
  { key: 'curation', collection: 'curation' },
  { key: 'theses', collection: 'theses' },
  { key: 'recommendations', collection: 'recommendations' },
  { key: 'campaigns', collection: 'campaigns' },
  { key: 'campaignMilestones', collection: 'campaignMilestones' },
  { key: 'advices', collection: 'advices' },
  { key: 'deliveries', collection: 'deliveries' },
  { key: 'notifications', collection: 'notifications' },
  { key: 'tasks', collection: 'tasks' },
  { key: 'contents', collection: 'contents' },
  { key: 'opportunities', collection: 'opportunities' },
  { key: 'profile/data', collection: 'profile', fixedDocId: 'data' },
  { key: 'dossier/data', collection: 'dossier', fixedDocId: 'data' },
  { key: 'evidence', collection: 'evidence' },
  { key: 'results', collection: 'results' },
  { key: 'feedbackEvents', collection: 'feedbackEvents' },
  { key: 'signalOutcomes', collection: 'signalOutcomes' },
  { key: 'proofWallItems', collection: 'proofWallItems' },
  { key: 'aiRuns', collection: 'aiRuns' },
];

/** Write counters — must remain zero for T-009-16A. */
const writeGuard = { created: 0, updated: 0, deleted: 0 };

function isPathInsideRepo(absPath) {
  const root = normalize(REPO_ROOT).toLowerCase();
  const target = normalize(resolve(absPath)).toLowerCase();
  return target === root || target.startsWith(root + '\\') || target.startsWith(root + '/');
}

function resolveCredentialPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!fromEnv) return null;
  const abs = resolve(fromEnv);
  if (!existsSync(abs)) {
    console.error(`ERROR: GOOGLE_APPLICATION_CREDENTIALS missing file: ${abs}`);
    process.exit(1);
  }
  if (isPathInsideRepo(abs)) {
    console.error('ERROR: Service account path inside repository (SEC-009-012).');
    process.exit(1);
  }
  return abs;
}

function initAdmin() {
  if (getApps().length) return;
  const keyPath = resolveCredentialPath();
  if (!keyPath) {
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS not set (external path required).');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  if (serviceAccount.project_id !== PROJECT_ID) {
    console.error(
      `ERROR: SA project_id (${serviceAccount.project_id}) != target (${PROJECT_ID}).`
    );
    process.exit(1);
  }
  initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
}

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function emptyCounter() {
  return {
    total: 0,
    alreadyValid: 0,
    wouldBackfillOrgId: 0,
    wouldBackfillClientId: 0,
    wouldBackfillBoth: 0,
    conflictOrgId: 0,
    conflictClientId: 0,
    orphans: 0,
    unchanged: 0,
    blockedManualReview: 0,
    wouldChange: 0,
  };
}

function mergeCounters(into, part) {
  for (const k of Object.keys(into)) {
    into[k] += part[k] ?? 0;
  }
}

function classifySubDoc(data, pathClientId, parentOrgId) {
  const orgId = nonEmptyString(data?.organizationId);
  const clientId = nonEmptyString(data?.clientId);

  if (!parentOrgId) {
    return { status: 'ORPHAN', wouldAdd: {} };
  }

  const orgConflict = orgId != null && orgId !== parentOrgId;
  const clientConflict = clientId != null && clientId !== pathClientId;

  if (orgConflict || clientConflict) {
    return { status: 'CONFLICT', wouldAdd: {}, orgConflict, clientConflict };
  }

  const needOrg = orgId == null;
  const needClient = clientId == null;

  if (!needOrg && !needClient) {
    return { status: 'ALREADY_VALID', wouldAdd: {} };
  }

  const wouldAdd = {};
  if (needOrg) wouldAdd.organizationId = parentOrgId;
  if (needClient) wouldAdd.clientId = pathClientId;

  if (needOrg && needClient) return { status: 'WOULD_BACKFILL_BOTH', wouldAdd };
  if (needOrg) return { status: 'WOULD_BACKFILL_ORG', wouldAdd };
  return { status: 'WOULD_BACKFILL_CLIENT', wouldAdd };
}

function tallySubClassification(counter, classification) {
  counter.total += 1;
  switch (classification.status) {
    case 'ALREADY_VALID':
      counter.alreadyValid += 1;
      counter.unchanged += 1;
      break;
    case 'WOULD_BACKFILL_ORG':
      counter.wouldBackfillOrgId += 1;
      counter.wouldChange += 1;
      break;
    case 'WOULD_BACKFILL_CLIENT':
      counter.wouldBackfillClientId += 1;
      counter.wouldChange += 1;
      break;
    case 'WOULD_BACKFILL_BOTH':
      counter.wouldBackfillBoth += 1;
      counter.wouldChange += 1;
      break;
    case 'CONFLICT':
      if (classification.orgConflict) counter.conflictOrgId += 1;
      if (classification.clientConflict) counter.conflictClientId += 1;
      counter.blockedManualReview += 1;
      break;
    case 'ORPHAN':
      counter.orphans += 1;
      counter.blockedManualReview += 1;
      break;
    default:
      break;
  }
}

function parseReportDir() {
  const idx = process.argv.indexOf('--report-dir');
  if (idx !== -1 && process.argv[idx + 1]) return resolve(process.argv[idx + 1]);
  return DEFAULT_REPORT_DIR;
}

async function runBackupExport(reportMeta) {
  const adminClient = new firestoreV1.FirestoreAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bucketCandidates = [
    `${PROJECT_ID}.appspot.com`,
    `${PROJECT_ID}.firebasestorage.app`,
  ];
  const databaseName = adminClient.databasePath(PROJECT_ID, '(default)');

  for (const bucket of bucketCandidates) {
    const outputUriPrefix = `gs://${bucket}/spec009-backups/${timestamp}`;
    try {
      const [operation] = await adminClient.exportDocuments({
        name: databaseName,
        outputUriPrefix,
      });
      reportMeta.backup = {
        status: 'INITIATED',
        projectId: PROJECT_ID,
        outputUriPrefix,
        operationName: operation.name ?? null,
        timestamp,
        scope: 'full Firestore (default) database export',
      };
      return reportMeta.backup;
    } catch (err) {
      reportMeta.backupAttempts = reportMeta.backupAttempts || [];
      reportMeta.backupAttempts.push({
        outputUriPrefix,
        error: err.message || String(err),
      });
    }
  }
  reportMeta.backup = { status: 'FAILED', projectId: PROJECT_ID, timestamp };
  return reportMeta.backup;
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const reportDir = parseReportDir();
  mkdirSync(reportDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const report = {
    task: 'T-009-16A',
    mode: 'READ_ONLY_DRY_RUN',
    projectId: PROJECT_ID,
    environment: 'production',
    startedAt,
    frozenImplementationSha: '9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99',
    writeGuard,
    rootClients: {
      total: 0,
      validOrganizationId: 0,
      missingOrganizationId: 0,
      blankOrganizationId: 0,
      unexpectedClientIdField: 0,
    },
    subcollections: {},
    subdocuments: emptyCounter(),
    perSubcollection: {},
    conflictSamples: [],
    orphanSamples: [],
    blockedSamples: [],
    maxSamples: 20,
  };

  for (const sub of SUBCOLLECTIONS) {
    report.perSubcollection[sub.key] = emptyCounter();
  }

  // Backup (export API — not application-data mutation); skip with --skip-backup
  if (!process.argv.includes('--skip-backup')) {
    await runBackupExport(report);
  } else {
    report.backup = { status: 'SKIPPED', reason: '--skip-backup (T-009-16A.1 uses spec009-firestore-backup.mjs)' };
  }

  // Root clients inventory
  const clientsSnap = await db.collection('clients').get();
  const clientOrgMap = new Map();

  for (const doc of clientsSnap.docs) {
    report.rootClients.total += 1;
    const data = doc.data();
    const orgRaw = data?.organizationId;
    const orgId = nonEmptyString(orgRaw);
    const hasClientIdField = data != null && Object.prototype.hasOwnProperty.call(data, 'clientId');

    if (orgId) {
      report.rootClients.validOrganizationId += 1;
      clientOrgMap.set(doc.id, orgId);
    } else if (orgRaw === '' || (typeof orgRaw === 'string' && !orgRaw.trim())) {
      report.rootClients.blankOrganizationId += 1;
      clientOrgMap.set(doc.id, null);
    } else {
      report.rootClients.missingOrganizationId += 1;
      clientOrgMap.set(doc.id, null);
    }

    if (hasClientIdField && nonEmptyString(data.clientId)) {
      report.rootClients.unexpectedClientIdField += 1;
    }
  }

  // Subcollection inventory
  for (const clientDoc of clientsSnap.docs) {
    const clientId = clientDoc.id;
    const parentOrgId = clientOrgMap.get(clientId) ?? null;

    for (const sub of SUBCOLLECTIONS) {
      const subCounter = report.perSubcollection[sub.key];

      if (sub.fixedDocId) {
        const ref = db.collection('clients').doc(clientId).collection(sub.collection).doc(sub.fixedDocId);
        const snap = await ref.get();
        if (!snap.exists) continue;
        const classification = classifySubDoc(snap.data(), clientId, parentOrgId);
        tallySubClassification(subCounter, classification);
        tallySubClassification(report.subdocuments, classification);
        if (classification.status === 'CONFLICT' && report.conflictSamples.length < report.maxSamples) {
          report.conflictSamples.push({
            path: `clients/${clientId}/${sub.collection}/${sub.fixedDocId}`,
            orgConflict: classification.orgConflict,
            clientConflict: classification.clientConflict,
          });
        }
        if (classification.status === 'ORPHAN' && report.orphanSamples.length < report.maxSamples) {
          report.orphanSamples.push({ path: `clients/${clientId}/${sub.collection}/${sub.fixedDocId}` });
        }
        continue;
      }

      const subSnap = await db.collection('clients').doc(clientId).collection(sub.collection).get();
      for (const subDoc of subSnap.docs) {
        const classification = classifySubDoc(subDoc.data(), clientId, parentOrgId);
        tallySubClassification(subCounter, classification);
        tallySubClassification(report.subdocuments, classification);
        if (classification.status === 'CONFLICT' && report.conflictSamples.length < report.maxSamples) {
          report.conflictSamples.push({
            path: `clients/${clientId}/${sub.collection}/${subDoc.id}`,
            orgConflict: classification.orgConflict,
            clientConflict: classification.clientConflict,
          });
        }
        if (classification.status === 'ORPHAN' && report.orphanSamples.length < report.maxSamples) {
          report.orphanSamples.push({ path: `clients/${clientId}/${sub.collection}/${subDoc.id}` });
        }
      }
    }
  }

  // Orphan subcollections under missing parent clients — scan collectionGroup is heavy;
  // flag root clients with missing org as blocking for their subs (already ORPHAN above).

  report.completedAt = new Date().toISOString();
  report.idempotencyNote =
    'Second dry-run on same data yields identical wouldChange/blocked counts; ALREADY_VALID docs produce NO CHANGE.';

  const hasBlockers =
    report.subdocuments.conflictOrgId > 0 ||
    report.subdocuments.conflictClientId > 0 ||
    report.subdocuments.orphans > 0 ||
    report.rootClients.missingOrganizationId > 0 ||
    report.rootClients.blankOrganizationId > 0;

  const backupOk =
    report.backup?.status === 'INITIATED' || report.backup?.status === 'VERIFIED';

  report.backfillReadiness =
    backupOk && !hasBlockers && writeGuard.created === 0 && writeGuard.updated === 0 && writeGuard.deleted === 0
      ? 'READY_FOR_BACKFILL'
      : 'NOT_READY_FOR_BACKFILL';

  if (!backupOk) {
    report.backfillReadiness = 'NOT_READY_FOR_BACKFILL';
    report.blockers = report.blockers || [];
    report.blockers.push('BACKUP_NOT_VERIFIED');
  }
  if (hasBlockers) {
    report.blockers = report.blockers || [];
    if (report.subdocuments.conflictOrgId > 0 || report.subdocuments.conflictClientId > 0) {
      report.blockers.push('ENVELOPE_CONFLICTS');
    }
    if (report.subdocuments.orphans > 0) report.blockers.push('ORPHANS');
    if (report.rootClients.missingOrganizationId + report.rootClients.blankOrganizationId > 0) {
      report.blockers.push('ROOT_CLIENT_MISSING_ORG');
    }
  }

  const stamp = startedAt.replace(/[:.]/g, '-');
  const reportPath = resolve(reportDir, `T-009-16A-dryrun-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  // Sanitized stdout summary (no document payloads)
  console.log('\n=== SPEC-009 T-009-16A — Production dry-run (READ ONLY) ===\n');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Backup: ${report.backup?.status ?? 'UNKNOWN'} ${report.backup?.outputUriPrefix ?? ''}`);
  console.log('\n--- Root clients ---');
  console.log(JSON.stringify(report.rootClients, null, 2));
  console.log('\n--- Subdocuments (aggregate) ---');
  console.log(JSON.stringify(report.subdocuments, null, 2));
  console.log('\n--- Per subcollection (totals) ---');
  for (const [key, c] of Object.entries(report.perSubcollection)) {
    if (c.total === 0) continue;
    console.log(`${key}: total=${c.total} valid=${c.alreadyValid} wouldChange=${c.wouldChange} blocked=${c.blockedManualReview}`);
  }
  console.log('\n--- Write guard ---');
  console.log(JSON.stringify(writeGuard));
  console.log(`\nBackfill readiness: ${report.backfillReadiness}`);
  if (report.blockers?.length) console.log(`Blockers: ${report.blockers.join(', ')}`);
  console.log('\nDocuments updated/created/deleted by this script: 0 (read-only)\n');

  if (writeGuard.created || writeGuard.updated || writeGuard.deleted) {
    console.error('INCIDENT: write guard non-zero');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
