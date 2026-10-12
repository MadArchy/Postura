import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'aurora-postura-rules-test';
const ORG_ID = 'org_aurora_01';
const OTHER_ORG = 'org_other_99';

describe('firestore.rules (emulator) — SPEC-009 Phase 1', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'clients/client_juan_001'), {
        id: 'client_juan_001',
        organizationId: ORG_ID,
        displayName: 'Juan',
      });
      await setDoc(doc(db, 'clients/client_elena_002'), {
        id: 'client_elena_002',
        organizationId: ORG_ID,
        displayName: 'Elena',
      });
      await setDoc(doc(db, 'clients/client_other_org'), {
        id: 'client_other_org',
        organizationId: OTHER_ORG,
        displayName: 'Other Org Client',
      });
      await setDoc(doc(db, 'clients/client_juan_001/tasks/task_1'), {
        id: 'task_1',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        title: 'Revisar post',
        status: 'ASSIGNED',
      });
      await setDoc(doc(db, 'clients/client_juan_001/tasks/task_viewed'), {
        id: 'task_viewed',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        title: 'Vista',
        status: 'VIEWED',
      });
      await setDoc(doc(db, 'clients/client_juan_001/deliveries/pkg_1'), {
        id: 'pkg_1',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'SENT',
        title: 'Briefing',
      });
      await setDoc(doc(db, 'clients/client_juan_001/contents/c_article'), {
        id: 'c_article',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        title: 'Artículo',
        body: 'Draft',
        pipelineStatus: 'sent_to_client',
        status: 'CLIENT_REVIEW',
      });
      await setDoc(doc(db, 'clients/client_juan_001/contents/c_mgr'), {
        id: 'c_mgr',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        title: 'Mgr only',
        pipelineStatus: 'manager_review',
        status: 'IN_REVIEW',
      });
      await setDoc(doc(db, 'clients/client_juan_001/opportunities/opp_1'), {
        id: 'opp_1',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'SENT_TO_CLIENT',
        title: 'Opp',
      });
      await setDoc(doc(db, 'clients/client_juan_001/theses/th_1'), {
        id: 'th_1',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'UNDER_REVIEW',
        clientApprovalStatus: 'PENDING',
        title: 'Tesis',
        audiences: ['A'],
      });
      await setDoc(doc(db, 'clients/client_juan_001/theses/th_rev'), {
        id: 'th_rev',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'ACTIVE',
        clientApprovalStatus: 'PENDING',
        title: 'Old Title',
        expertIdentity: 'Old Expert',
        targetAudience: 'Old Audience',
        domain: 'Old Domain',
        objective: 'Old Objective',
        proofPoints: ['p1'],
        voiceAndTone: 'authoritative',
        complianceRules: '',
        audiences: [{ id: 'a1', name: 'A', tier: 'COMMERCIAL', weight: 50, keywords: [] }],
        pendingRevision: {
          proposed: {
            title: 'Proposed Title',
            expertIdentity: 'Proposed Expert',
            targetAudience: 'Proposed Audience',
            domain: 'Proposed Domain',
            objective: 'Proposed Objective',
            proofPoints: ['p2'],
            voiceAndTone: 'conversational',
            complianceRules: 'none',
            audiences: [{ id: 'a1', name: 'Proposed Aud', tier: 'COMMERCIAL', weight: 80, keywords: ['x'] }],
          },
          createdAt: '2026-08-01T00:00:00Z',
          createdBy: 'admin_uid',
        },
      });
      await setDoc(doc(db, 'clients/client_juan_001/theses/th_rev_multi'), {
        id: 'th_rev_multi',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'ACTIVE',
        clientApprovalStatus: 'PENDING',
        title: 'Multi Old',
        expertIdentity: 'Multi Expert',
        targetAudience: 'Multi Audience',
        secondaryAudience: 'Sec Old',
        domain: 'Multi Domain',
        objective: 'Multi Objective',
        differentiator: 'Diff Old',
        voiceAndTone: 'formal',
        complianceRules: 'old',
        identityCurrent: 'Id Old',
        perceptionTarget: 'Perc Old',
        priority: 'MEDIUM',
        audiences: [{ id: 'a1', name: 'A', tier: 'COMMERCIAL', weight: 40, keywords: [] }],
        pendingRevision: {
          proposed: {
            title: 'Multi Proposed',
            expertIdentity: 'Multi Expert New',
            targetAudience: 'Multi Audience New',
            secondaryAudience: 'Sec New',
            domain: 'Multi Domain New',
            objective: 'Multi Objective New',
            differentiator: 'Diff New',
            voiceAndTone: 'warm',
            complianceRules: 'new',
            identityCurrent: 'Id New',
            perceptionTarget: 'Perc New',
            priority: 'HIGH',
            audiences: [{ id: 'a1', name: 'A New', tier: 'COMMERCIAL', weight: 70, keywords: ['k'] }],
          },
          createdAt: '2026-08-01T00:00:00Z',
          createdBy: 'admin_uid',
        },
      });
      await setDoc(doc(db, 'clients/client_juan_001/profile/data'), {
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        identity: { displayName: 'Juan' },
        goals: {},
        audience: {},
        career: {},
        education: [],
        careerHistory: [],
        ventures: [],
        keyPublications: [],
        socialLinks: {},
        voicePreferences: {
          tone: 'authoritative',
          preferredPhrases: [],
          topicsToAvoid: [],
          complianceGuidelines: '',
        },
        onboardingCompleted: false,
        updatedAt: '2026-08-01T00:00:00Z',
      });
      await setDoc(doc(db, 'clients/client_juan_001/notifications/ntf_unread'), {
        id: 'ntf_unread',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        userId: 'manager_uid',
        type: 'BRIEFING',
        title: 'Ack needed',
        body: 'Please ack',
        read: false,
        createdAt: '2026-08-01T00:00:00Z',
      });
      await setDoc(doc(db, 'clients/client_juan_001/signalOutcomes/so_1'), {
        id: 'so_1',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        signalId: 'sig_1',
      });
      await setDoc(doc(db, 'clients/client_other_org/tasks/task_x'), {
        id: 'task_x',
        organizationId: OTHER_ORG,
        clientId: 'client_other_org',
        title: 'Alien task',
        status: 'ASSIGNED',
      });
      await setDoc(doc(db, 'auditLogs/log_same'), {
        id: 'log_same',
        organizationId: ORG_ID,
        action: 'TEST',
      });
      await setDoc(doc(db, 'auditLogs/log_other'), {
        id: 'log_other',
        organizationId: OTHER_ORG,
        action: 'TEST',
      });
    });
  });

  it('unauthenticated read DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'clients/client_juan_001')));
  });

  it('ADMIN same-org read ALLOW', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'clients/client_juan_001')));
  });

  it('ADMIN cross-org read DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertFails(getDoc(doc(adminDb, 'clients/client_other_org')));
    await assertFails(getDoc(doc(adminDb, 'clients/client_other_org/tasks/task_x')));
  });

  it('ADMIN cross-org write DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, 'clients/client_other_org/signals/sig_x'), {
        id: 'sig_x',
        clientId: 'client_other_org',
        title: 'cross',
      })
    );
    await assertFails(
      updateDoc(doc(adminDb, 'clients/client_other_org'), { displayName: 'Hacked' })
    );
  });

  it('CLIENT own client read ALLOW', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertSucceeds(getDoc(doc(juanDb, 'clients/client_juan_001')));
    await assertSucceeds(getDoc(doc(juanDb, 'clients/client_juan_001/tasks/task_1')));
  });

  it('CLIENT other client read DENY', async () => {
    const elenaDb = testEnv
      .authenticatedContext('elena_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_elena_002',
      })
      .firestore();
    await assertFails(getDoc(doc(elenaDb, 'clients/client_juan_001/tasks/task_1')));
    await assertFails(getDoc(doc(elenaDb, 'clients/client_juan_001')));
  });

  it('CLIENT cross-org read DENY', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertFails(getDoc(doc(juanDb, 'clients/client_other_org')));
  });

  it('CREATE client without organizationId DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, 'clients/client_no_org'), {
        id: 'client_no_org',
        displayName: 'Missing org',
      })
    );
  });

  it('CREATE client with wrong organizationId DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, 'clients/client_wrong_org'), {
        id: 'client_wrong_org',
        organizationId: OTHER_ORG,
        displayName: 'Wrong org',
      })
    );
  });

  it('UPDATE organizationId DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertFails(
      updateDoc(doc(adminDb, 'clients/client_juan_001'), { organizationId: OTHER_ORG })
    );
    await assertFails(
      updateDoc(doc(adminDb, 'clients/client_juan_001/tasks/task_1'), {
        organizationId: OTHER_ORG,
      })
    );
  });

  it('UPDATE clientId on task DENY', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertFails(
      updateDoc(doc(juanDb, 'clients/client_juan_001/tasks/task_1'), {
        clientId: 'client_elena_002',
      })
    );
  });

  it('DELETE cross-org DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertFails(deleteDoc(doc(adminDb, 'clients/client_other_org/tasks/task_x')));
    await assertFails(deleteDoc(doc(adminDb, 'clients/client_other_org')));
  });

  it('permite al cliente actualizar su tarea (same-org)', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertSucceeds(
      updateDoc(doc(juanDb, 'clients/client_juan_001/tasks/task_1'), { status: 'IN_PROGRESS' })
    );
  });

  it('impide al cliente crear señales (solo manager)', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertFails(
      setDoc(doc(juanDb, 'clients/client_juan_001/signals/sig_1'), {
        id: 'sig_1',
        clientId: 'client_juan_001',
        title: 'Intento cliente',
      })
    );
  });

  it('permite ACK de entrega por el cliente', async () => {
    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();
    await assertSucceeds(
      updateDoc(doc(juanDb, 'clients/client_juan_001/deliveries/pkg_1'), {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: serverTimestamp(),
      })
    );
  });

  it('permite al admin escribir aiRuns del cliente (same-org)', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, 'clients/client_juan_001/aiRuns/run_1'), {
        id: 'run_1',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        agent: 'TOPIC_AGENT',
        status: 'SUCCESS',
      })
    );
  });

  it('permite al cliente leer aiRuns propios pero no escribirlos', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'clients/client_juan_001/aiRuns/run_1'), {
        id: 'run_1',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        agent: 'TOPIC_AGENT',
        status: 'SUCCESS',
      });
    });

    const juanDb = testEnv
      .authenticatedContext('juan_uid', {
        role: 'CLIENT',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
      .firestore();

    await assertSucceeds(getDoc(doc(juanDb, 'clients/client_juan_001/aiRuns/run_1')));
    await assertFails(
      setDoc(doc(juanDb, 'clients/client_juan_001/aiRuns/run_2'), {
        id: 'run_2',
        clientId: 'client_juan_001',
        agent: 'TOPIC_AGENT',
      })
    );
  });

  it('Q1 same-org clients query/list ALLOW', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    const q = query(collection(adminDb, 'clients'), where('organizationId', '==', ORG_ID));
    await assertSucceeds(getDocs(q));
  });

  it('Q1 unscoped clients list DENY (Rules are not filters)', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertFails(getDocs(collection(adminDb, 'clients')));
  });

  it('Q1 cross-org clients query DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    const q = query(collection(adminDb, 'clients'), where('organizationId', '==', OTHER_ORG));
    await assertFails(getDocs(q));
  });

  it('auditLogs same-org ADMIN read ALLOW; cross-org DENY', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
      .firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'auditLogs/log_same')));
    await assertFails(getDoc(doc(adminDb, 'auditLogs/log_other')));
  });

  const juanClaims = {
    role: 'CLIENT' as const,
    organizationId: ORG_ID,
    clientId: 'client_juan_001',
  };

  function juanDb() {
    return testEnv.authenticatedContext('juan_uid', juanClaims).firestore();
  }

  it('CLIENT field outside allowlist DENY', async () => {
    await assertFails(updateDoc(doc(juanDb(), 'clients/client_juan_001/tasks/task_1'), { title: 'Hacked' }));
  });

  it('CLIENT mutating organizationId DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/tasks/task_1'), { organizationId: OTHER_ORG })
    );
  });

  it('CLIENT mutating clientId DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/tasks/task_1'), { clientId: 'client_elena_002' })
    );
  });

  it('Delivery invalid transition DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/deliveries/pkg_1'), {
        status: 'DRAFT',
        acknowledgedAt: serverTimestamp(),
      })
    );
  });

  it('Task invalid transition DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/tasks/task_1'), { status: 'REJECTED' })
    );
  });

  it('Task valid transitions ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/tasks/task_1'), { status: 'VIEWED' })
    );
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/tasks/task_viewed'), {
        status: 'COMPLETED',
        completedAt: serverTimestamp(),
      })
    );
  });

  it('Content valid CLIENT transitions ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/contents/c_article'), {
        pipelineStatus: 'client_in_progress',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Content manager-only transition DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/contents/c_mgr'), {
        pipelineStatus: 'manager_finalizing',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Opportunity valid accept/reject ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/opportunities/opp_1'), {
        status: 'IN_PROGRESS',
        clientDecision: 'ACCEPTED',
      })
    );
  });

  it('Opportunity illegal transition DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'clients/client_juan_001/opportunities/opp_done'), {
        id: 'opp_done',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'COMPLETED',
      });
    });
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/opportunities/opp_done'), {
        status: 'IN_PROGRESS',
      })
    );
  });

  it('Thesis approval workflow ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_1'), {
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
      })
    );
  });

  it('Thesis pendingRevision apply ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_rev'), {
        title: 'Proposed Title',
        expertIdentity: 'Proposed Expert',
        targetAudience: 'Proposed Audience',
        domain: 'Proposed Domain',
        objective: 'Proposed Objective',
        proofPoints: ['p2'],
        voiceAndTone: 'conversational',
        complianceRules: 'none',
        audiences: [{ id: 'a1', name: 'Proposed Aud', tier: 'COMMERCIAL', weight: 80, keywords: ['x'] }],
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
        pendingRevision: null,
      })
    );
  });

  it('Thesis pendingRevision proposes X but CLIENT writes Y DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_rev'), {
        title: 'Arbitrary Y Title',
        expertIdentity: 'Proposed Expert',
        targetAudience: 'Proposed Audience',
        domain: 'Proposed Domain',
        objective: 'Proposed Objective',
        proofPoints: ['p2'],
        voiceAndTone: 'conversational',
        complianceRules: 'none',
        audiences: [{ id: 'a1', name: 'Proposed Aud', tier: 'COMMERCIAL', weight: 80, keywords: ['x'] }],
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
        pendingRevision: null,
      })
    );
  });

  it('Thesis F-009-B single strategic field valid apply ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'clients/client_juan_001/theses/th_one'), {
        id: 'th_one',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'ACTIVE',
        clientApprovalStatus: 'PENDING',
        title: 'One Old',
        audiences: ['A'],
        pendingRevision: {
          proposed: { title: 'One Proposed' },
          createdAt: '2026-08-01T00:00:00Z',
          createdBy: 'admin_uid',
        },
      });
    });
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_one'), {
        title: 'One Proposed',
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
        pendingRevision: null,
      })
    );
  });

  it('Thesis F-009-B multi-field apply with one mismatch DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_rev_multi'), {
        title: 'Multi Proposed',
        expertIdentity: 'Multi Expert New',
        targetAudience: 'Multi Audience New',
        secondaryAudience: 'Sec New',
        domain: 'Multi Domain New',
        objective: 'HACKED OBJECTIVE',
        differentiator: 'Diff New',
        voiceAndTone: 'warm',
        complianceRules: 'new',
        identityCurrent: 'Id New',
        perceptionTarget: 'Perc New',
        priority: 'HIGH',
        audiences: [{ id: 'a1', name: 'A New', tier: 'COMMERCIAL', weight: 70, keywords: ['k'] }],
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
        pendingRevision: null,
      })
    );
  });

  it('Thesis F-009-B multiple strategic fields valid apply ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_rev_multi'), {
        title: 'Multi Proposed',
        expertIdentity: 'Multi Expert New',
        targetAudience: 'Multi Audience New',
        secondaryAudience: 'Sec New',
        domain: 'Multi Domain New',
        objective: 'Multi Objective New',
        differentiator: 'Diff New',
        voiceAndTone: 'warm',
        complianceRules: 'new',
        identityCurrent: 'Id New',
        perceptionTarget: 'Perc New',
        priority: 'HIGH',
        audiences: [{ id: 'a1', name: 'A New', tier: 'COMMERCIAL', weight: 70, keywords: ['k'] }],
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
        pendingRevision: null,
      })
    );
  });

  it('Thesis F-009-B no pendingRevision strategic edit DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_1'), {
        title: 'No revision title',
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
      })
    );
  });

  it('Thesis strategic-field modification DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_1'), {
        audiences: ['Hacked'],
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
      })
    );
  });

  it('Thesis strategic field during invalid approval transition DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'clients/client_juan_001/theses/th_approved'), {
        id: 'th_approved',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'ACTIVE',
        clientApprovalStatus: 'APPROVED',
        title: 'Locked',
        audiences: ['A'],
      });
    });
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_approved'), {
        title: 'Hacked after approve',
        clientApprovalStatus: 'APPROVED',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Thesis organizationId mutation DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_1'), {
        organizationId: OTHER_ORG,
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
      })
    );
  });

  it('Thesis clientId mutation DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_1'), {
        clientId: 'client_elena_002',
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: serverTimestamp(),
      })
    );
  });

  it('Profile CLIENT allowlisted nested update ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/profile/data'), {
        identity: { displayName: 'Juan Updated', selfDescription: 'Lawyer' },
        onboardingCurrentStep: 2,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Profile CLIENT organizationId mutation DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/profile/data'), {
        organizationId: OTHER_ORG,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Profile CLIENT outside allowlist field DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/profile/data'), {
        managerNotes: 'secret',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Forged workflow timestamp DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/deliveries/pkg_1'), {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: '1999-01-01T00:00:00Z',
      })
    );
  });

  it('Forged stateHistory.at DENY on valid content transition', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/contents/c_article'), {
        pipelineStatus: 'client_in_progress',
        updatedAt: serverTimestamp(),
        stateHistory: [{ to: 'client_in_progress', at: '1999-01-01T00:00:00Z' }],
      })
    );
  });

  it('Content transition without stateHistory mutation ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/contents/c_article'), {
        pipelineStatus: 'client_in_progress',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Forged completedAt DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/tasks/task_viewed'), {
        status: 'COMPLETED',
        completedAt: '1999-01-01T00:00:00Z',
      })
    );
  });

  it('Forged clientApprovedAt DENY', async () => {
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/theses/th_1'), {
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: '1999-01-01T00:00:00Z',
        updatedAt: serverTimestamp(),
        updatedBy: 'juan_uid',
      })
    );
  });

  it('Forged submittedAt DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'clients/client_juan_001/opportunities/opp_prog'), {
        id: 'opp_prog',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        status: 'IN_PROGRESS',
        clientDecision: 'ACCEPTED',
      });
    });
    await assertFails(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/opportunities/opp_prog'), {
        status: 'COMPLETED',
        submittedAt: '1999-01-01T00:00:00Z',
      })
    );
  });

  it('Notification mark read ALLOW', async () => {
    await assertSucceeds(
      updateDoc(doc(juanDb(), 'clients/client_juan_001/notifications/ntf_unread'), { read: true })
    );
  });

  it('Arbitrary notification create DENY', async () => {
    await assertFails(
      setDoc(doc(juanDb(), 'clients/client_juan_001/notifications/ntf_bad'), {
        id: 'ntf_bad',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        userId: 'manager_uid',
        type: 'BRIEFING',
        title: 'x',
        body: 'y',
        read: false,
        createdAt: '2026-01-01T00:00:00Z',
        extraField: 'nope',
      })
    );
  });

  it('Approved manager-alert notification create ALLOW', async () => {
    await assertSucceeds(
      setDoc(doc(juanDb(), 'clients/client_juan_001/notifications/ntf_ok'), {
        id: 'ntf_ok',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
        userId: 'manager_uid',
        type: 'BRIEFING',
        title: 'Cliente acusó recibo',
        body: 'Juan ACK',
        href: '/deliveries',
        read: false,
        createdAt: serverTimestamp(),
      })
    );
  });

  it('signalOutcomes CLIENT read DENY', async () => {
    await assertFails(getDoc(doc(juanDb(), 'clients/client_juan_001/signalOutcomes/so_1')));
  });

  it('signalOutcomes CLIENT write DENY', async () => {
    await assertFails(
      setDoc(doc(juanDb(), 'clients/client_juan_001/signalOutcomes/so_2'), {
        id: 'so_2',
        organizationId: ORG_ID,
        clientId: 'client_juan_001',
      })
    );
  });

  describe('T-009-14e denormalized envelope', () => {
    it('root clients/{clientId} read ALLOW without duplicated clientId field', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertSucceeds(getDoc(doc(adminDb, 'clients/client_juan_001')));
    });

    it('CREATE subcollection missing organizationId DENY', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(
        setDoc(doc(adminDb, 'clients/client_juan_001/sources/src_no_org'), {
          id: 'src_no_org',
          clientId: 'client_juan_001',
          title: 'No org',
        })
      );
    });

    it('CREATE subcollection missing clientId DENY', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(
        setDoc(doc(adminDb, 'clients/client_juan_001/sources/src_no_client'), {
          id: 'src_no_client',
          organizationId: ORG_ID,
          title: 'No clientId',
        })
      );
    });

    it('CREATE subcollection path clientId != document clientId DENY', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(
        setDoc(doc(adminDb, 'clients/client_juan_001/sources/src_mismatch'), {
          id: 'src_mismatch',
          organizationId: ORG_ID,
          clientId: 'client_elena_002',
          title: 'Mismatch',
        })
      );
    });

    it('CREATE subcollection wrong organizationId DENY', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(
        setDoc(doc(adminDb, 'clients/client_juan_001/sources/src_wrong_org'), {
          id: 'src_wrong_org',
          organizationId: OTHER_ORG,
          clientId: 'client_juan_001',
          title: 'Wrong org',
        })
      );
    });

    it('READ subcollection missing organizationId DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'clients/client_juan_001/tasks/task_no_org'), {
          id: 'task_no_org',
          clientId: 'client_juan_001',
          status: 'ASSIGNED',
        });
      });
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(getDoc(doc(adminDb, 'clients/client_juan_001/tasks/task_no_org')));
    });

    it('READ subcollection missing clientId DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'clients/client_juan_001/tasks/task_no_client'), {
          id: 'task_no_client',
          organizationId: ORG_ID,
          status: 'ASSIGNED',
        });
      });
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(getDoc(doc(adminDb, 'clients/client_juan_001/tasks/task_no_client')));
    });

    it('DELETE cross-org subcollection DENY (envelope on resource)', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(deleteDoc(doc(adminDb, 'clients/client_other_org/tasks/task_x')));
    });
  });

  describe('T-009-14e ADMIN CREATE referential integrity', () => {
    it('A: ADMIN same-org CREATE under own client path ALLOW', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertSucceeds(
        setDoc(doc(adminDb, 'clients/client_juan_001/sources/src_ok'), {
          id: 'src_ok',
          organizationId: ORG_ID,
          clientId: 'client_juan_001',
          title: 'Valid same-org',
        })
      );
    });

    it('B: ADMIN org_A CREATE under alien client_B path DENY (forged token org in envelope)', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(
        setDoc(doc(adminDb, 'clients/client_other_org/signals/sig_alien'), {
          id: 'sig_alien',
          organizationId: ORG_ID,
          clientId: 'client_other_org',
          title: 'Alien path forged org',
        })
      );
    });

    it('C: ADMIN cross-org CREATE with correct alien envelope DENY', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(
        setDoc(doc(adminDb, 'clients/client_other_org/tasks/task_alien'), {
          id: 'task_alien',
          organizationId: OTHER_ORG,
          clientId: 'client_other_org',
          title: 'Cross-org honest envelope',
          status: 'ASSIGNED',
        })
      );
    });

    it('D: CLIENT own-path CREATE ALLOW (manager-alert notification)', async () => {
      await assertSucceeds(
        setDoc(doc(juanDb(), 'clients/client_juan_001/notifications/ntf_client_ok'), {
          id: 'ntf_client_ok',
          organizationId: ORG_ID,
          clientId: 'client_juan_001',
          userId: 'manager_uid',
          type: 'BRIEFING',
          title: 'Cliente alerta',
          body: 'OK',
          read: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    it('E: CLIENT other-client path CREATE DENY', async () => {
      const elenaDb = testEnv
        .authenticatedContext('elena_uid', {
          role: 'CLIENT',
          organizationId: ORG_ID,
          clientId: 'client_elena_002',
        })
        .firestore();
      await assertFails(
        setDoc(doc(elenaDb, 'clients/client_juan_001/feedbackEvents/fe_bad'), {
          id: 'fe_bad',
          organizationId: ORG_ID,
          clientId: 'client_juan_001',
          createdAt: serverTimestamp(),
        })
      );
    });

    it('F: READ remains envelope-only (no parent get on read)', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertSucceeds(getDoc(doc(adminDb, 'clients/client_juan_001/tasks/task_1')));
    });

    it('G: UPDATE remains envelope-only', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertSucceeds(
        updateDoc(doc(adminDb, 'clients/client_juan_001/tasks/task_1'), { title: 'Admin edit' })
      );
    });

    it('H: DELETE remains envelope-only', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'clients/client_juan_001/sources/src_del'), {
          id: 'src_del',
          organizationId: ORG_ID,
          clientId: 'client_juan_001',
          title: 'Delete me',
        });
      });
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertSucceeds(deleteDoc(doc(adminDb, 'clients/client_juan_001/sources/src_del')));
    });

    it('I: malformed envelope ADMIN CREATE DENY', async () => {
      const adminDb = testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
      await assertFails(
        setDoc(doc(adminDb, 'clients/client_juan_001/campaigns/cmp_bad'), {
          id: 'cmp_bad',
          clientId: 'client_juan_001',
          title: 'Missing org',
        })
      );
    });
  });

  describe('createdAt is write-once', () => {
    function adminDb() {
      return testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
    }

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'clients/client_juan_001/tasks/task_created'), {
          id: 'task_created',
          organizationId: ORG_ID,
          clientId: 'client_juan_001',
          title: 'Con createdAt',
          status: 'ASSIGNED',
          createdAt: '2026-08-01T00:00:00Z',
        });
        await setDoc(doc(db, 'clients/client_juan_001/tasks/task_null_created'), {
          id: 'task_null_created',
          organizationId: ORG_ID,
          clientId: 'client_juan_001',
          title: 'createdAt null',
          status: 'ASSIGNED',
          createdAt: null,
        });
      });
    });

    it('ADMIN subcollection CREATE with serverTimestamp createdAt ALLOW', async () => {
      await assertSucceeds(
        setDoc(doc(adminDb(), 'clients/client_juan_001/tasks/task_new'), {
          id: 'task_new',
          organizationId: ORG_ID,
          clientId: 'client_juan_001',
          title: 'Nueva',
          status: 'ASSIGNED',
          createdAt: serverTimestamp(),
        })
      );
    });

    it('ADMIN subcollection UPDATE changing createdAt DENY', async () => {
      await assertFails(
        updateDoc(doc(adminDb(), 'clients/client_juan_001/tasks/task_created'), {
          title: 'Editada',
          createdAt: serverTimestamp(),
        })
      );
    });

    it('ADMIN subcollection UPDATE preserving createdAt ALLOW', async () => {
      await assertSucceeds(
        updateDoc(doc(adminDb(), 'clients/client_juan_001/tasks/task_created'), {
          title: 'Editada',
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('ADMIN UPDATE replacing a null createdAt DENY', async () => {
      await assertFails(
        updateDoc(doc(adminDb(), 'clients/client_juan_001/tasks/task_null_created'), {
          createdAt: serverTimestamp(),
        })
      );
    });

    it('ADMIN UPDATE adding createdAt to a doc without it DENY', async () => {
      await assertFails(
        updateDoc(doc(adminDb(), 'clients/client_juan_001/tasks/task_1'), {
          createdAt: serverTimestamp(),
        })
      );
    });

    it('ADMIN root client UPDATE changing createdAt DENY; preserving ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), 'clients/client_juan_001'),
          { createdAt: '2026-08-01T00:00:00Z' },
          { merge: true }
        );
      });
      await assertFails(
        updateDoc(doc(adminDb(), 'clients/client_juan_001'), { createdAt: serverTimestamp() })
      );
      await assertSucceeds(
        updateDoc(doc(adminDb(), 'clients/client_juan_001'), {
          displayName: 'Juan J.',
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('CLIENT notification mark-read re-stamping createdAt DENY', async () => {
      await assertFails(
        updateDoc(doc(juanDb(), 'clients/client_juan_001/notifications/ntf_unread'), {
          read: true,
          createdAt: serverTimestamp(),
        })
      );
    });
  });

  describe('T604 Strategic Brief collections', () => {
    const BRIEFS = 'clients/client_juan_001/strategicBriefs';
    const HISTORY = 'clients/client_juan_001/strategicBriefHistory';
    const OVERRIDES = 'clients/client_juan_001/strategicBriefOverrides';

    function adminDb() {
      return testEnv
        .authenticatedContext('admin_uid', { role: 'ADMIN', organizationId: ORG_ID })
        .firestore();
    }

    function otherOrgAdminDb() {
      return testEnv
        .authenticatedContext('other_admin_uid', { role: 'ADMIN', organizationId: OTHER_ORG })
        .firestore();
    }

    const brief = (id: string, version: number) => ({
      id,
      organizationId: ORG_ID,
      clientId: 'client_juan_001',
      status: 'DRAFT',
      version,
      createdAt: '2026-10-01T00:00:00Z',
    });
    const historyEntry = {
      briefId: 'brief_1',
      version: 1,
      status: 'DRAFT',
      organizationId: ORG_ID,
      clientId: 'client_juan_001',
      changeType: 'CREATED',
      changedAt: '2026-10-01T00:00:00Z',
    };
    const override = (overrideId: string) => ({
      overrideId,
      briefId: 'brief_1',
      organizationId: ORG_ID,
      clientId: 'client_juan_001',
      reason: 'Ajuste',
    });

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, `${BRIEFS}/brief_1`), brief('brief_1', 2));
        await setDoc(doc(db, `${HISTORY}/hist_1`), historyEntry);
        await setDoc(doc(db, `${OVERRIDES}/ovr_1`), override('ovr_1'));
      });
    });

    it('ADMIN of the org creates, reads and lists Briefs ALLOW', async () => {
      await assertSucceeds(setDoc(doc(adminDb(), `${BRIEFS}/brief_2`), brief('brief_2', 1)));
      await assertSucceeds(getDoc(doc(adminDb(), `${BRIEFS}/brief_1`)));
      await assertSucceeds(
        getDocs(
          query(
            collection(adminDb(), BRIEFS),
            where('organizationId', '==', ORG_ID),
            where('clientId', '==', 'client_juan_001')
          )
        )
      );
    });

    it('Brief create whose id differs from the document id DENY', async () => {
      await assertFails(setDoc(doc(adminDb(), `${BRIEFS}/brief_3`), brief('brief_other', 1)));
    });

    it('ADMIN of another organization DENY on every Brief collection', async () => {
      await assertFails(getDoc(doc(otherOrgAdminDb(), `${BRIEFS}/brief_1`)));
      await assertFails(getDoc(doc(otherOrgAdminDb(), `${HISTORY}/hist_1`)));
      await assertFails(getDoc(doc(otherOrgAdminDb(), `${OVERRIDES}/ovr_1`)));
      await assertFails(setDoc(doc(otherOrgAdminDb(), `${BRIEFS}/brief_2`), brief('brief_2', 1)));
    });

    it('CLIENT read and write DENY on every Brief collection', async () => {
      await assertFails(getDoc(doc(juanDb(), `${BRIEFS}/brief_1`)));
      await assertFails(getDoc(doc(juanDb(), `${HISTORY}/hist_1`)));
      await assertFails(getDoc(doc(juanDb(), `${OVERRIDES}/ovr_1`)));
      await assertFails(setDoc(doc(juanDb(), `${BRIEFS}/brief_2`), brief('brief_2', 1)));
      await assertFails(setDoc(doc(juanDb(), `${HISTORY}/hist_2`), historyEntry));
    });

    it('Brief update keeps or raises the version ALLOW; lowering it DENY', async () => {
      await assertSucceeds(
        setDoc(doc(adminDb(), `${BRIEFS}/brief_1`), { ...brief('brief_1', 2), status: 'APPROVED' })
      );
      await assertSucceeds(setDoc(doc(adminDb(), `${BRIEFS}/brief_1`), brief('brief_1', 3)));
      await assertFails(setDoc(doc(adminDb(), `${BRIEFS}/brief_1`), brief('brief_1', 1)));
    });

    it('Brief delete DENY even for the ADMIN of the org', async () => {
      await assertFails(deleteDoc(doc(adminDb(), `${BRIEFS}/brief_1`)));
    });

    it('history create and identical rewrite ALLOW; changing or deleting a record DENY', async () => {
      await assertSucceeds(setDoc(doc(adminDb(), `${HISTORY}/hist_2`), historyEntry));
      await assertSucceeds(setDoc(doc(adminDb(), `${HISTORY}/hist_1`), historyEntry, { merge: true }));
      await assertFails(updateDoc(doc(adminDb(), `${HISTORY}/hist_1`), { status: 'APPROVED' }));
      await assertFails(deleteDoc(doc(adminDb(), `${HISTORY}/hist_1`)));
    });

    it('override create keyed by overrideId ALLOW; mismatched id, changes and deletes DENY', async () => {
      await assertSucceeds(setDoc(doc(adminDb(), `${OVERRIDES}/ovr_2`), override('ovr_2')));
      await assertFails(setDoc(doc(adminDb(), `${OVERRIDES}/ovr_3`), override('ovr_other')));
      await assertSucceeds(setDoc(doc(adminDb(), `${OVERRIDES}/ovr_1`), override('ovr_1'), { merge: true }));
      await assertFails(updateDoc(doc(adminDb(), `${OVERRIDES}/ovr_1`), { reason: 'Reescrito' }));
      await assertFails(deleteDoc(doc(adminDb(), `${OVERRIDES}/ovr_1`)));
    });
  });
});
