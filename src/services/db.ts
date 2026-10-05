import { 
  Client, 
  PositioningThesis, 
  ClientProfile, 
  Source,
  SourceRunOutcome,
  Signal, 
  SignalResearchBrief,
  Recommendation, 
  Task, 
  ContentItem, 
  Opportunity,
  Campaign,
  EvidenceVaultItem,
  AIRunRecord,
  OrganizationSubscription,
  Invitation,
  ResultRecord,
  ManagerDecision,
  CurationEntry,
  CurationDestination,
  DeliveryPackage,
  DeliveryItem,
  PositioningAdvice,
  MasterDossier,
  AttachedFile,
  ClientPortfolioSummary,
  StrategicScoreResult,
  CampaignMilestone,
  ContentPipelineStatus,
  FeedbackEvent,
  ProofWallItem,
  ProfileFact,
  ProfileFactSection,
  SignalOutcome,
  NotificationItem,
} from '../types';
import { applyScopedCollectionMerge } from '../domain/firestoreMergeCore';
import { computeConversionStats } from '../domain/radarFeedbackCore';
import { resolveThesis } from '../domain/thesisContextCore';
import { detectIndustryPreset, getIndustryPresetMeta } from './industryPresets';
import { createId } from '../lib/id';
import { hasFeedMarkup, toPlainText } from '../lib/feedText';
import { renderDiffHtml, diffLines, hasDiffChanges, summarizeDiff } from '../domain/textDiff';
import { buildFactsFromProfile } from '../domain/profileFacts';
import { extractCandidateFactsFromCv } from '../domain/cvExtract';
import { computeProfileCoverage } from '../domain/profileCoverage';
import { buildDefaultProofWallItems } from '../data/proofWallChecklist';
import {
  defaultOpportunityChecklist,
  mapOpportunityLifecycle,
} from '../domain/opportunityLifecycle';
import { assertTransition, DELIVERY_TRANSITIONS, SIGNAL_TRANSITIONS, TASK_TRANSITIONS } from '../domain/stateMachine';
import { latestSentAt, sortDeliveriesBySentAt } from '../domain/deliveryCore';
import {
  assertContentPipelineTransition,
  mapLegacyContentStatus,
  syncLegacyStatusFromPipeline,
} from '../domain/contentPipeline';
import {
  buildJuanCampaigns,
  buildJuanContentQueue,
  buildJuanGovernanceReviewThesis,
  buildJuanKpiSeeds,
  buildJuanMilestones,
  buildJuanProofWallExtras,
  buildJuanSecondThesis,
  CAMP_ADOPTION,
  JUAN_ID,
  THESIS_GOVERNANCE_REVIEW,
  THESIS_PATENTS,
} from '../data/juanCampaignSeed';
import { quotasFor, assertClientQuota, assertSourceQuota, assertThesisQuota } from './entitlements';
import { buildJuanMasterDossier } from '../data/juanMasterDossier';
import { FIREBASE_ENABLED } from '../firebase/config';
import type { LocalV5Snapshot } from './firestore/types';
import { buildScoreBreakdown } from '../domain/scoreExplainCore';
import type { SignalRoutingHistoryEntry } from '../domain/routingHistoryCore';
import {
  compatibilityRecommendedAction,
  type SignalScoreHistoryEntry,
} from '../domain/scoreHistoryCore';

export type { LocalV5Snapshot } from './firestore/types';

class DataService {
  private clients: Client[] = [];
  private theses: PositioningThesis[] = [];
  private profiles: Record<string, ClientProfile> = {};
  private sources: Source[] = [];
  private signals: Signal[] = [];
  private recommendations: Recommendation[] = [];
  private tasks: Task[] = [];
  private contents: ContentItem[] = [];
  private opportunities: Opportunity[] = [];
  private campaigns: Campaign[] = [];
  private campaignMilestones: CampaignMilestone[] = [];
  private evidenceVault: EvidenceVaultItem[] = [];
  private aiRuns: AIRunRecord[] = [];
  private subscription: OrganizationSubscription | null = null;
  private invitations: Invitation[] = [];
  private results: ResultRecord[] = [];
  private curation: CurationEntry[] = [];
  private deliveries: DeliveryPackage[] = [];
  private advices: PositioningAdvice[] = [];
  private files: AttachedFile[] = [];
  private topicPins: string[] = [];
  private dossiers: Record<string, MasterDossier> = {};
  private feedbackEvents: FeedbackEvent[] = [];
  private signalOutcomes: SignalOutcome[] = [];
  private proofWallItems: ProofWallItem[] = [];
  private notifications: NotificationItem[] = [];
  /**
   * SPEC-001 Phase 3 — local-authoritative routing history.
   * Logical Firestore shape: clients/{clientId}/signals/{signalId}/routingHistory/{id}
   * Not remote-synced until SPEC-009 covers that path (RULES CONTRACT GAP).
   */
  private signalRoutingHistory: SignalRoutingHistoryEntry[] = [];
  /**
   * SPEC-002 Phase 3 — local-authoritative score history.
   * Logical Firestore shape: clients/{clientId}/signals/{signalId}/scoreHistory/{id}
   * Not remote-synced until SPEC-009 covers that path (RULES CONTRACT GAP).
   */
  private signalScoreHistory: SignalScoreHistoryEntry[] = [];
  private changeListeners: Array<() => void> = [];
  /** >0 mientras se aplique un lote de escrituras (p. ej. send briefing). */
  private saveBatchDepth = 0;

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData() {
    if (FIREBASE_ENABLED) return;

    const savedClients = localStorage.getItem('postura_clients_v5');
    if (savedClients) {
      try {
        this.clients = JSON.parse(savedClients);
        this.theses = JSON.parse(localStorage.getItem('postura_theses_v5') || '[]');
        this.profiles = JSON.parse(localStorage.getItem('postura_profiles_v5') || '{}');
        this.sources = JSON.parse(localStorage.getItem('postura_sources_v5') || '[]');
        this.signals = JSON.parse(localStorage.getItem('postura_signals_v5') || '[]');
        this.recommendations = JSON.parse(localStorage.getItem('postura_recommendations_v5') || '[]');
        this.tasks = JSON.parse(localStorage.getItem('postura_tasks_v5') || '[]');
        this.contents = JSON.parse(localStorage.getItem('postura_contents_v5') || '[]');
        this.opportunities = JSON.parse(localStorage.getItem('postura_opportunities_v5') || '[]');
        this.campaigns = JSON.parse(localStorage.getItem('postura_campaigns_v5') || '[]');
        this.campaignMilestones = JSON.parse(localStorage.getItem('postura_milestones_v5') || '[]');
        this.evidenceVault = JSON.parse(localStorage.getItem('postura_evidence_v5') || '[]');
        this.aiRuns = JSON.parse(localStorage.getItem('postura_ai_runs_v5') || '[]');
        this.subscription = JSON.parse(localStorage.getItem('postura_subscription_v5') || 'null');
        this.invitations = JSON.parse(localStorage.getItem('postura_invitations_v5') || '[]');
        this.results = JSON.parse(localStorage.getItem('postura_results_v5') || '[]');
        this.curation = JSON.parse(localStorage.getItem('postura_curation_v5') || '[]');
        this.deliveries = JSON.parse(localStorage.getItem('postura_deliveries_v5') || '[]');
        this.advices = JSON.parse(localStorage.getItem('postura_advices_v5') || '[]');
        this.files = JSON.parse(localStorage.getItem('postura_files_v5') || '[]');
        this.topicPins = JSON.parse(localStorage.getItem('postura_topic_pins_v5') || '[]');
        this.dossiers = JSON.parse(localStorage.getItem('postura_dossiers_v5') || '{}');
        this.feedbackEvents = JSON.parse(localStorage.getItem('postura_feedback_v1') || '[]');
        this.signalOutcomes = JSON.parse(localStorage.getItem('postura_signal_outcomes_v1') || '[]');
        this.proofWallItems = JSON.parse(localStorage.getItem('postura_proof_wall_v1') || '[]');
        this.notifications = JSON.parse(localStorage.getItem('postura_notifications_db_v1') || '[]');
        this.signalRoutingHistory = JSON.parse(
          localStorage.getItem('postura_signal_routing_history_v1') || '[]'
        );
        this.signalScoreHistory = JSON.parse(
          localStorage.getItem('postura_signal_score_history_v1') || '[]'
        );
        this.ensureSeedDossiers();
        this.ensureJuanCampaignSeed();
        this.repairKnownBrokenSources();
        this.migrateOrphanSignals();
        this.migrateContentPipelineFields();
        this.migrateClientReviewBaselines();
        this.migrateProfileFacts();
        this.migrateProofWallItems();
        this.migrateOpportunityLifecycle();
        if (this.sanitizeFeedTextMarkup()) this.saveAll();
        return;
      } catch (e) {
        console.error('Error loading stored data, resetting to seed', e);
      }
    }

    this.runBuiltInSeed();
  }

  /** Seed demo Juan (+ Elena). Usado en local o bootstrap inicial de Firestore. */
  public runBuiltInSeed(): void {
    const orgId = 'org_aurora_01';
    const juanId = 'client_juan_001';
    
    this.clients = [
      {
        id: juanId,
        organizationId: orgId,
        primaryManagerId: 'user_admin_01',
        userId: 'user_client_juan_01',
        firstName: 'Juan',
        lastName: 'Vasquez',
        displayName: 'Juan J. Vasquez',
        primaryEmail: 'juan.vasquez@lexfirm.com',
        profession: 'Intellectual Property & AI Adoption Attorney',
        company: 'Whitaker Chalk Swindle & Schwartz PLLC',
        country: 'Estados Unidos (Fort Worth, Texas)',
        targetMarket: 'General Counsel, IP Counsel, startups tecnológicas y equipos legales adoptando IA',
        onboardingStatus: 'COMPLETED',
        profileCompleteness: 100,
        status: 'ACTIVE',
        internalNotes: 'VERIFICADO: Member Whitaker Chalk (may 2022), BSEE UT Austin, JD St. Mary\'s, DoD/USAF cyber, Chair State Bar TX Emerging Technology Committee, President of Board 3ITAL, coautor libro IA+Patentes 2024. NO USAR sin confirmar: "Fundador 3ITAL", "Director 3i BAIRD Lab", Best Lawyers 2026. Posicionamiento: IP + AI Adoption (People/Tools/Rules), no "AI lawyer" genérico ni solo "Patent Attorney".',
        createdAt: '2026-08-01T10:00:00Z',
        createdBy: 'user_admin_01',
        updatedAt: '2026-08-18T14:30:00Z',
        updatedBy: 'user_admin_01',
        activeThesesCount: 2,
        completedTasksCount: 14,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
      },
      {
        id: 'client_elena_002',
        organizationId: orgId,
        primaryManagerId: 'user_admin_01',
        firstName: 'Elena',
        lastName: 'Rostova',
        displayName: 'Dra. Elena Rostova',
        primaryEmail: 'elena.martinez@lexfirm.com',
        profession: 'Cirujana Oncológica & Investigadora Genómica',
        company: 'Instituto Biomédico Avanzado',
        country: 'España',
        targetMarket: 'Comités de Bioética, Hospitales de Alta Complejidad, Farmacéuticas',
        onboardingStatus: 'IN_PROGRESS',
        profileCompleteness: 65,
        status: 'ACTIVE',
        internalNotes: 'Posicionamiento en terapias génicas de precisión. Cuenta aislamiento DoD (no ve datos de Juan).',
        userId: 'user_client_elena_01',
        createdAt: '2026-08-10T12:00:00Z',
        createdBy: 'user_admin_01',
        updatedAt: '2026-08-18T16:00:00Z',
        updatedBy: 'user_admin_01',
        activeThesesCount: 1,
        completedTasksCount: 3,
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80'
      }
    ];

    const thesisId1 = 'thesis_juan_ip_ai_adoption';
    this.theses = [
      {
        id: thesisId1,
        organizationId: orgId,
        clientId: juanId,
        title: 'Propiedad Intelectual y Adopción Responsable de IA',
        expertIdentity: 'Intellectual Property and AI Adoption Attorney — ayuda a organizaciones a proteger innovación, evaluar preparación para IA y adoptar IA de forma controlada y defendible',
        targetAudience: 'General Counsel, IP Counsel, CTOs/CIOs, líderes de innovación y startups que desarrollan o adoptan IA',
        secondaryAudience: 'State Bar committees, equipos de compliance, patent prosecution y audiencias legales en EE.UU. y México',
        domain: 'Patentes e IP, adopción de IA (People + Tools + Rules), AI Posture & Readiness, gobernanza (NIST AI RMF, ISO/IEC 42001) y ciberseguridad aplicada',
        objective: 'Consolidar práctica IP + AI Adoption (assessments, governance, patent strategy); liderazgo institucional; conferencias US/México',
        proofPoints: [
          'Member, Whitaker Chalk Swindle & Schwartz PLLC — patent strategy, prosecution, FTO, litigio IP (desde may 2022)',
          'B.S. Electrical Engineering (UT Austin) + J.D. (St. Mary\'s University School of Law) + Registered Patent Attorney',
          'Experiencia DoD (ingeniero eléctrico/ciberseguridad) y oficial de ciberseguridad U.S. Air Force',
          'Chair, Emerging Technology Committee — State Bar of Texas (2025–2027)',
          'President of the Board, 3ITAL — International Institute for Intelligent Technology Adoption in the Law',
          'Coautor: Artificial Intelligence (AI) in Patent Practice (2024); edición española presentada en STJ Jalisco, México',
          'Fort Worth Magazine Top Attorneys — IP (2022–2025); Best Lawyers Ones to Watch IP Law (2024, 2025)',
        ],
        differentiator: 'Intersección LAW × ENGINEERING × IP × AI × CYBERSECURITY × BUSINESS: comprende el problema legal y técnico al mismo tiempo.',
        voiceAndTone: 'Preciso, sobrio, sin hype de "experto en IA". Usa noticias como materia prima para analizar impacto en adopción empresarial, IP, patentes, gobernanza y riesgo.',
        complianceRules: 'State Bar of Texas + USPTO: confidencialidad; no prometer resultados de patentes; no afirmar "Fundador 3ITAL" ni cargos no verificados (3i BAIRD Lab, Best Lawyers 2026).',
        status: 'ACTIVE',
        clientApprovalStatus: 'APPROVED',
        createdAt: '2026-08-02T10:00:00Z',
        createdBy: 'user_admin_01',
        updatedAt: '2026-08-18T10:00:00Z',
        updatedBy: 'user_admin_01',
        identityCurrent: 'Patent attorney con background de ingeniería y ciberseguridad',
        perceptionTarget: 'La referencia para adoptar IA con IP defendible',
        priority: 90,
        audiences: [
          { id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 95, keywords: ['general counsel', 'legal', 'ip counsel'] },
          { id: 'aud_cto', name: 'CTOs / CIOs', tier: 'COMMERCIAL', weight: 80, keywords: ['cto', 'cio', 'innovation'] },
          { id: 'aud_bar', name: 'State Bar committees', tier: 'INFLUENCE', weight: 70, keywords: ['state bar', 'committee'] },
        ],
        territories: [
          { id: 'ter_patent', name: 'Patent Strategy', pillar: 'IP', weight: 100, keywords: ['patent', 'uspto', 'fto', 'prosecution'] },
          { id: 'ter_ai', name: 'AI Adoption', pillar: 'Governance', weight: 90, keywords: ['ai adoption', 'nist', 'iso 42001', 'governance'] },
          { id: 'ter_cyber', name: 'Cybersecurity applied', pillar: 'Risk', weight: 60, keywords: ['cybersecurity', 'risk', 'controls'] },
        ],
        objectives: [
          { id: 'obj_business', kind: 'BUSINESS', weight: 40 },
          { id: 'obj_tl', kind: 'THOUGHT_LEADERSHIP', weight: 30 },
          { id: 'obj_speak', kind: 'SPEAKING', weight: 20 },
          { id: 'obj_inst', kind: 'INSTITUTIONAL', weight: 10 },
        ],
        voiceProfile: {
          authority: 85,
          technicalDepth: 80,
          academic: 55,
          executive: 70,
          accessible: 60,
          provocative: 25,
          commercial: 45,
          legalPrecision: 95,
          humor: 10,
          style: 'Preciso, sobrio, sin hype',
          avoid: ['hype', 'experto en IA', 'garantizado'],
        },
        limits: {
          hardBlocks: ['Fundador 3ITAL', 'Best Lawyers 2026', 'resultados de patentes garantizados'],
          softAvoid: ['consumer AI', 'entretenimiento'],
        },
      }
    ];

    this.profiles[juanId] = {
      organizationId: orgId,
      clientId: juanId,
      identity: {
        professionalHeadline: 'Member @ Whitaker Chalk | Intellectual Property & AI Adoption Attorney',
        shortBio: 'Abogado de patentes e ingeniero eléctrico. Ayuda a organizaciones a proteger innovación y adoptar IA de forma responsable.',
        longBio: 'Juan J. Vasquez es abogado de propiedad intelectual en Whitaker Chalk (Fort Worth, Texas), con formación en ingeniería eléctrica (UT Austin), experiencia en ciberseguridad (DoD y U.S. Air Force) y práctica centrada en patentes, FTO y adopción de IA. Chair del Emerging Technology Committee del State Bar of Texas y President of the Board de 3ITAL. Coautor de Artificial Intelligence (AI) in Patent Practice (2024).',
        location: 'Fort Worth, Texas · EE.UU. / México',
        languages: ['Inglés', 'Español'],
        selfDescription: 'Helping organizations protect innovation and responsibly adopt artificial intelligence.',
      },
      goals: {
        primaryGoal: 'Desarrollar la línea AI Adoption + Intellectual Property (AI Posture Assessment, governance, patent strategy)',
        secondaryGoals: [
          'Consolidar liderazgo institucional (State Bar TX, 3ITAL)',
          'Expandir conferencias y presencia en México',
          'Posicionar el marco People + Tools + Rules como diferenciador',
        ],
      },
      audience: {
        targetAudienceDescription: 'General Counsel, IP counsel, CTOs/CIOs, equipos legales adoptando IA y startups con portafolios de innovación.',
        targetIndustries: ['Tecnología', 'Semiconductores', 'Dispositivos médicos', 'Telecomunicaciones', 'LegalTech', 'Startups de IA'],
        targetCountries: ['Estados Unidos', 'México'],
      },
      career: {
        profession: 'Intellectual Property & AI Adoption Attorney',
        currentRole: 'Member',
        currentCompany: 'Whitaker Chalk Swindle & Schwartz PLLC',
        yearsExperience: 12,
        industries: ['Propiedad intelectual', 'Patentes', 'Adopción de IA', 'Ciberseguridad'],
      },
      education: [
        { institution: 'The University of Texas at Austin', degree: 'B.S. Electrical Engineering', year: '2009' },
        { institution: 'St. Mary\'s University School of Law', degree: 'Juris Doctor (J.D.)', year: '2013' },
      ],
      careerHistory: [
        {
          role: 'Member — Intellectual Property Practice',
          organization: 'Whitaker Chalk Swindle & Schwartz PLLC',
          period: 'May 2022 — Presente',
          highlight: 'Patent strategy, prosecution, FTO, opinions, portafolios internacionales y asuntos transaccionales de tecnología.',
        },
        {
          role: 'Cybersecurity Officer',
          organization: 'U.S. Air Force',
          period: 'Anterior a carrera legal',
          highlight: 'Autoridad para hablar de controles tecnológicos, riesgo y funcionamiento real de sistemas.',
        },
        {
          role: 'Electrical Engineer / Cybersecurity Specialist',
          organization: 'U.S. Department of Defense',
          period: 'Anterior a carrera legal',
          highlight: 'Ingeniería eléctrica y ciberseguridad antes de convertirse en patent attorney.',
        },
      ],
      ventures: [
        'President of the Board, 3ITAL — International Institute for Intelligent Technology Adoption in the Law',
        'Chair, Emerging Technology Committee — State Bar of Texas',
      ],
      keyPublications: [
        {
          title: 'Artificial Intelligence (AI) in Patent Practice: No Patent Attorneys Were Harmed in the Making of this AI Revolution',
          outlet: 'Coautor con Roberto Rosas (2024; edición en español)',
        },
        {
          title: 'The Pillars of AI Adoption: The Rules, the Tools, and the People',
          outlet: '3ITAL (abril 2026)',
        },
      ],
      socialLinks: {
        linkedin: 'https://www.linkedin.com/in/juanjvasquez',
        website: 'https://www.whitakerchalk.com',
      },
      voicePreferences: {
        tone: 'authoritative',
        preferredPhrases: [
          'People + Tools + Rules',
          'AI Adoption (not just AI law)',
          'AI Posture and Readiness',
          'Protect innovation, adopt AI responsibly',
          'Freedom to Operate',
        ],
        topicsToAvoid: [
          'Posicionarse solo como "experto en inteligencia artificial" (demasiado genérico)',
          'Reducir la marca a "Patent Attorney" sin el ángulo de adopción de IA',
          'Etiquetarse únicamente como "abogado de gobernanza de IA" (demasiado estrecho)',
          'Afirmar "Fundador de 3ITAL" o cargo en 3i BAIRD Lab sin documentación primaria',
          'Best Lawyers 2026 sin confirmación adicional',
          'Comentar noticias de IA sin analizar impacto en adopción, IP o riesgo empresarial',
        ],
        complianceGuidelines: 'State Bar of Texas y USPTO: confidencialidad de clientes; no prometer resultados de patentes; verificar cargos antes de publicar.',
      },
      onboardingCompleted: true,
      updatedAt: '2026-08-19T16:00:00Z',
    };

    this.sources = [
      {
        id: 'src_uspto_01',
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        name: 'USPTO — Patent Public Search / noticias de propiedad intelectual',
        type: 'REGULATORY',
        url: 'https://www.uspto.gov/rss.xml',
        fetchIntervalMinutes: 720,
        status: 'ACTIVE',
        itemCount: 0,
        createdAt: '2026-08-01T00:00:00Z',
        createdBy: 'user_admin_01',
      },
      {
        id: 'src_nist_ai_02',
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        name: 'NIST — noticias (IA, estándares y ciberseguridad)',
        type: 'REGULATORY',
        url: 'https://www.nist.gov/news-events/news/rss.xml',
        fetchIntervalMinutes: 720,
        status: 'ACTIVE',
        itemCount: 0,
        createdAt: '2026-08-05T00:00:00Z',
        createdBy: 'user_admin_01',
      },
      {
        id: 'src_ipwatchdog_03',
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        name: 'IPWatchdog — patentes e IA en práctica legal',
        type: 'MEDIA',
        url: 'https://ipwatchdog.com/feed/',
        fetchIntervalMinutes: 360,
        status: 'ACTIVE',
        itemCount: 0,
        createdAt: '2026-08-10T00:00:00Z',
        createdBy: 'user_admin_01',
      },
    ];

    this.signals = [
      {
        id: 'sig_001',
        organizationId: orgId,
        clientId: juanId,
        sourceId: 'src_nist_ai_02',
        title: 'NIST actualiza guía de gestión de riesgos para sistemas de IA en entornos corporativos',
        sourceType: 'REGULATORY',
        sourceName: 'NIST AI RMF Updates',
        sourceUrl: 'https://www.nist.gov/artificial-intelligence',
        contentSnippet: 'El marco enfatiza gobernanza, trazabilidad y evaluación de riesgo antes del despliegue — alineado con AI Posture Assessment.',
        fingerprint: 'fp_ea8923a19b88',
        detectedAt: '2026-08-18T08:15:00Z',
        status: 'NEW',
        targetDomain: 'AI Adoption & Governance (People + Tools + Rules)',
        relevanceScore: 94,
        aiStatus: 'PENDING_AI',
        managerDecision: 'UNREVIEWED',
        sourceQuality: 'HIGH',
      },
      {
        id: 'sig_002',
        organizationId: orgId,
        clientId: juanId,
        sourceId: 'src_ipwatchdog_03',
        title: 'Tribunal federal: outputs generados por IA en procesos de patentes requieren trazabilidad de inventores humanos',
        sourceType: 'NEWS_API',
        sourceName: 'IPWatchdog',
        sourceUrl: 'https://www.ipwatchdog.com/',
        contentSnippet: 'Decisión relevante para patent prosecution y portafolios de startups que usan herramientas de IA en I+D.',
        fingerprint: 'fp_901c22ff71b2',
        detectedAt: '2026-08-18T11:30:00Z',
        status: 'ANALYZED',
        targetDomain: 'Patentes + AI Adoption en IP',
        relevanceScore: 91,
        aiStatus: 'ANALYZED',
        managerDecision: 'UNREVIEWED',
        sourceQuality: 'HIGH',
        recommendedAction: 'VIDEO',
        priorityBand: 'CRITICAL',
      },
    ];

    this.recommendations = [
      {
        id: 'rec_001',
        signalId: 'sig_001',
        thesisId: thesisId1,
        clientId: juanId,
        type: 'VIDEO_SHORT',
        proposedAngle: '¿Quién usa ChatGPT en tu empresa sin que Legal lo sepa? Los 3 pilares de AI Adoption: People, Tools y Rules.',
        strategicRationale: 'Conecta una noticia de gobernanza con el marco diferenciador de Juan — no comenta IA, diagnostica adopción empresarial.',
        urgency: 'HIGH',
        impactScore: 95,
        status: 'MANAGER_APPROVED',
        createdAt: '2026-08-18T09:00:00Z'
      }
    ];

    const contentId1 = 'cnt_video_script_001';
    this.contents = [
      {
        id: contentId1,
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        type: 'VIDEO_SCRIPT',
        title: 'Guion Teleprompter: People, Tools & Rules — diagnóstico de adopción de IA',
        body: `[GANCHO - 0 a 8 seg]\nSi tu empresa ya usa IA pero nadie en Legal puede decirte qué herramientas usan los empleados, tienes un problema de adopción — no de tecnología.\n\n[NÚCLEO - 8 a 35 seg]\nLa adopción de IA casi siempre empieza de forma informal: ChatGPT, Copilot, proveedores con acceso a datos. Antes de hablar de regulación, necesitas tres cosas:\n1. People — ¿quién usa qué y con qué formación?\n2. Tools — inventario de herramientas, vendors y acceso a información sensible.\n3. Rules — políticas que realmente se cumplen, no solo en papel.\n\n[CIERRE - 35 a 55 seg]\nEso es AI Posture: proteger innovación y adoptar IA de forma defendible. Como abogado de patentes e ingeniero, veo el riesgo desde IP y desde sistemas reales. En mi perfil dejo la checklist para General Counsel.`,
        teleprompterScript: `Si tu empresa ya usa IA pero nadie en Legal puede decirte qué herramientas usan los empleados, tienes un problema de adopción — no de tecnología.\n\nLa adopción de IA casi siempre empieza de forma informal: ChatGPT, Copilot, proveedores con acceso a datos. Antes de hablar de regulación, necesitas tres cosas:\n\n1. People — ¿quién usa qué y con qué formación?\n2. Tools — inventario de herramientas, vendors y acceso a información sensible.\n3. Rules — políticas que realmente se cumplen, no solo en papel.\n\nEso es AI Posture: proteger innovación y adoptar IA de forma defendible. Como abogado de patentes e ingeniero, veo el riesgo desde IP y desde sistemas reales. En mi perfil dejo la checklist para General Counsel.`,
        targetPlatform: 'LinkedIn',
        status: 'CLIENT_REVIEW',
        pipelineStatus: 'sent_to_client',
        managerNotes: 'Guion adaptado a 60 segundos exactos en tono autoritativo y directo. Listo para grabación en teleprompter.',
        createdAt: '2026-08-18T09:30:00Z',
        updatedAt: '2026-08-18T09:45:00Z'
      }
    ];

    this.tasks = [
      {
        id: 'task_001',
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        type: 'RECORD_VIDEO',
        title: 'Grabar video de 60s: People, Tools & Rules en adopción de IA',
        description: 'Lee el guion sobre AI Adoption (People + Tools + Rules). Enfoque IP + adopción empresarial, no comentario genérico de IA.',
        estimatedMinutes: 15,
        deadline: '2026-08-19T18:00:00Z',
        status: 'ASSIGNED',
        contentItemId: contentId1,
        scriptPayload: this.contents[0].teleprompterScript,
        createdAt: '2026-08-18T10:00:00Z'
      }
    ];

    this.opportunities = [
      {
        id: 'opp_cle_001',
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        title: 'CLE: AI Governance para General Counsel (Texas MCLE)',
        organization: 'State Bar of Texas — Continuing Legal Education',
        type: 'PANEL',
        deadline: '2026-08-22T23:59:00Z',
        description:
          'Convocatoria para sesión CLE sobre gobernanza de IA en departamentos legales: evaluación de herramientas, confidencialidad, People + Tools + Rules.',
        fitRationale:
          'Juan es Chair del Emerging Technology Committee — encaja con su tesis de adopción responsable de IA para GC e IP counsel.',
        status: 'SENT_TO_CLIENT',
        lifecycleStage: 'proposed',
        createdAt: '2026-08-19T10:00:00Z',
      },
      {
        id: 'opp_001',
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        title: 'Panel: AI Adoption en firmas legales y departamentos de IP',
        organization: 'State Bar of Texas — Emerging Technology Committee / 3ITAL',
        type: 'CONFERENCE_KEYNOTE',
        deadline: '2026-09-15T23:59:00Z',
        description:
          'Invitación a panel sobre adopción responsable de IA en la profesión legal: People + Tools + Rules, confidencialidad y evaluación de herramientas.',
        fitRationale:
          'Juan es Chair del comité anfitrión y President of the Board de 3ITAL — alineación institucional directa.',
        status: 'SENT_TO_CLIENT',
        lifecycleStage: 'proposed',
        createdAt: '2026-08-18T12:00:00Z',
      },
    ];

    this.campaigns = [
      {
        id: 'camp_001',
        organizationId: orgId,
        clientId: juanId,
        thesisId: thesisId1,
        name: 'Campaña Q3: IP + AI Adoption (People, Tools, Rules)',
        description: 'Posicionar a Juan como IP & AI Adoption Attorney — assessments, patent strategy y gobernanza práctica (NIST AI RMF, ISO/IEC 42001).',
        status: 'ACTIVE',
        startDate: '2026-08-01',
        endDate: '2026-10-31',
        targetDeliverables: 12,
        completedDeliverables: 5,
        tags: ['AI Adoption', 'Patentes', 'AI Posture', '3ITAL'],
        createdAt: '2026-08-01T10:00:00Z',
        createdBy: 'user_admin_01',
        updatedAt: '2026-08-18T14:00:00Z'
      }
    ];

    this.evidenceVault = [
      {
        id: 'ev_001',
        organizationId: orgId,
        clientId: juanId,
        title: 'Member — Whitaker Chalk Swindle & Schwartz PLLC',
        type: 'CERTIFICATION',
        sourceUrl: 'https://www.whitakerchalk.com',
        snippet: 'Member desde mayo 2022. Práctica en patentes, FTO, prosecution, opinions y asuntos transaccionales de tecnología.',
        confidenceScore: 100,
        verified: true,
        verifiedAt: '2026-08-01T12:00:00Z',
        associatedThesesIds: [thesisId1],
        createdAt: '2026-08-01T11:00:00Z',
        supports: ['Member Whitaker Chalk', 'patent strategy'],
        authorityWeight: 85,
      },
      {
        id: 'ev_002',
        organizationId: orgId,
        clientId: juanId,
        title: 'Chair — Emerging Technology Committee, State Bar of Texas',
        type: 'CERTIFICATION',
        sourceUrl: 'https://www.texasbar.com',
        snippet: 'Nombramiento oficial 2025–2027. Comité sobre IA, automatización, ciberseguridad y uso responsable de tecnología por abogados.',
        confidenceScore: 100,
        verified: true,
        verifiedAt: '2026-08-05T09:00:00Z',
        associatedThesesIds: [thesisId1],
        createdAt: '2026-08-05T09:00:00Z',
        supports: ['Chair Emerging Technology Committee', 'State Bar of Texas'],
        authorityWeight: 90,
      },
      {
        id: 'ev_003',
        organizationId: orgId,
        clientId: juanId,
        title: 'Libro: Artificial Intelligence (AI) in Patent Practice (2024)',
        type: 'ACADEMIC_PAPER',
        sourceUrl: 'https://www.whitakerchalk.com',
        snippet: 'Coautor con Roberto Rosas. Tesis: IA aumenta capacidades del profesional, no sustituye al patent attorney. Edición español presentada en México.',
        confidenceScore: 98,
        verified: true,
        verifiedAt: '2026-08-10T09:00:00Z',
        associatedThesesIds: [thesisId1],
        createdAt: '2026-08-10T09:00:00Z',
        supports: ['Artificial Intelligence in Patent Practice', 'coautor'],
        authorityWeight: 88,
      },
      {
        id: 'ev_004',
        organizationId: orgId,
        clientId: juanId,
        title: 'Best Lawyers: Ones to Watch in America — Intellectual Property Law (2024, 2025)',
        type: 'AWARD',
        snippet: 'Reconocimiento público en propiedad intelectual. No incluir edición 2026 sin confirmación adicional.',
        confidenceScore: 95,
        verified: true,
        verifiedAt: '2026-08-12T09:00:00Z',
        associatedThesesIds: [thesisId1],
        createdAt: '2026-08-12T09:00:00Z',
      },
      {
        id: 'ev_005',
        organizationId: orgId,
        clientId: juanId,
        title: 'President of the Board — 3ITAL',
        type: 'CERTIFICATION',
        snippet: 'International Institute for Intelligent Technology Adoption in the Law. Usar "President of the Board" — no "Fundador" hasta confirmación documental.',
        confidenceScore: 95,
        verified: true,
        verifiedAt: '2026-08-14T09:00:00Z',
        associatedThesesIds: [thesisId1],
        createdAt: '2026-08-14T09:00:00Z',
      },
    ];

    this.aiRuns = [
      {
        id: 'run_seed_001',
        organizationId: orgId,
        clientId: juanId,
        agent: 'POSITIONING_STRATEGIST',
        provider: 'OPENAI',
        modelName: 'gpt-4o',
        promptTemplateId: 'tmpl_signal_analysis_v1',
        inputContextSummary: 'Señal: NIST AI RMF / adopción de IA en entornos corporativos',
        outputPayload: 'Ángulo propuesto: People + Tools + Rules — diagnóstico de adopción, no comentario genérico de IA',
        promptTokens: 820,
        completionTokens: 310,
        totalCostUsd: 0.0075,
        latencyMs: 1150,
        validationPassed: true,
        hallucinationCheckScore: 99,
        securityCheckPassed: true,
        status: 'SUCCESS',
        createdAt: '2026-08-18T09:00:00Z'
      }
    ];

    this.subscription = {
      organizationId: orgId,
      tier: 'PROFESSIONAL',
      status: 'ACTIVE',
      quotas: quotasFor('PROFESSIONAL'),
      monthlyUsage: {
        aiRuns: 28,
        tokensUsed: 42350,
        activeClientsCount: 2,
        sourcesCount: 3
      },
      currentPeriodStart: '2026-08-01T00:00:00Z',
      currentPeriodEnd: '2026-08-31T23:59:59Z'
    };

    this.invitations = [];
    this.results = [];
    this.curation = [];
    this.deliveries = [];
    this.advices = [];
    this.files = [];
    this.topicPins = [];

    this.dossiers = {
      [juanId]: buildJuanMasterDossier(),
    };

    this.saveAll();
    this.ensureJuanCampaignSeed();
  }

  /**
   * Borra datos locales v5 y vuelve a cargar el seed demo (solo sin Firebase).
   * Útil cuando el navegador conserva un snapshot antiguo (p. ej. plan 30 días).
   */
  public resetLocalDemoAndReload(): void {
    if (FIREBASE_ENABLED) {
      throw new Error('Con Firebase activo los datos vienen de Firestore. Cierra sesión y usa bootstrap o reprovisiona.');
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('postura_')) localStorage.removeItem(key);
    }
    location.reload();
  }

  /**
   * Corrige URLs de fuentes que se comprobó que no devuelven items (feed vacío,
   * redirección o 404). Se hace en sitio para no perder señales ya capturadas.
   */
  private repairKnownBrokenSources() {
    const replacements: Record<string, string | null> = {
      'https://www.nist.gov/news-events/cybersecurity/rss.xml': 'https://www.nist.gov/news-events/news/rss.xml',
      'https://www.ipwatchdog.com/feed/': 'https://ipwatchdog.com/feed/',
      'https://europa.eu/ai-act/feed.xml': null,
    };

    let changed = false;
    for (const source of this.sources) {
      if (!source.url || !(source.url in replacements)) continue;
      const replacement = replacements[source.url];
      if (replacement) {
        source.url = replacement;
        source.status = 'ACTIVE';
        source.lastError = undefined;
      } else {
        source.status = 'ARCHIVED';
        source.lastError = 'Feed retirado por el proveedor';
      }
      changed = true;
    }
    if (changed) this.saveAll();
  }

  /**
   * Asigna clientId a señales huérfanas usando sourceId; las que no puedan
   * resolverse se descartan para evitar fuga entre clientes.
   */
  private migrateOrphanSignals() {
    let changed = false;
    for (const signal of this.signals) {
      if (signal.clientId) continue;
      const source = signal.sourceId ? this.sources.find((s) => s.id === signal.sourceId) : undefined;
      if (source?.clientId) {
        signal.clientId = source.clientId;
        changed = true;
        continue;
      }
      if (signal.status !== 'DISCARDED') {
        signal.status = 'DISCARDED';
        signal.discardReason = 'Migración: señal huérfana sin clientId';
        changed = true;
      }
    }
    if (changed) this.saveAll();
  }

  /** Inserta dossiers de demo si faltan (migración sin resetear datos). */
  private ensureSeedDossiers() {
    if (!this.dossiers['client_juan_001']) {
      this.dossiers['client_juan_001'] = buildJuanMasterDossier();
      this.saveAll();
    }
  }

  /** Seed Oleada 0 + migraciones plan 90 días, cola de contenido Juan. */
  private ensureJuanCampaignSeed() {
    let changed = false;

    const freshCampaigns = buildJuanCampaigns();
    const adoptionFresh = freshCampaigns.find((c) => c.id === CAMP_ADOPTION);
    const adoption = this.campaigns.find((c) => c.id === CAMP_ADOPTION);
    if (adoption && adoptionFresh && adoption.planDays !== adoptionFresh.planDays) {
      Object.assign(adoption, {
        name: adoptionFresh.name,
        description: adoptionFresh.description,
        endDate: adoptionFresh.endDate,
        targetDeliverables: adoptionFresh.targetDeliverables,
        planDays: adoptionFresh.planDays,
        tags: adoptionFresh.tags,
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    }

    if (!this.theses.some((t) => t.id === THESIS_PATENTS)) {
      this.theses.push(buildJuanSecondThesis());
      changed = true;
    }

    if (!this.theses.some((t) => t.id === THESIS_GOVERNANCE_REVIEW)) {
      this.theses.push(buildJuanGovernanceReviewThesis());
      changed = true;
    }

    const juan = this.clients.find((c) => c.id === JUAN_ID);
    if (juan && juan.activeThesesCount < 2) {
      juan.activeThesesCount = 2;
      changed = true;
    }

    for (const camp of buildJuanCampaigns()) {
      if (!this.campaigns.some((c) => c.id === camp.id)) {
        this.campaigns.push(camp);
        changed = true;
      }
    }

    const milestones = buildJuanMilestones();
    for (const ms of milestones) {
      if (!this.campaignMilestones.some((m) => m.id === ms.id)) {
        if (ms.dayNumber === 16) ms.linkedTaskId = 'task_001';
        this.campaignMilestones.push(ms);
        changed = true;
      }
    }

    for (const ev of buildJuanProofWallExtras()) {
      if (!this.evidenceVault.some((e) => e.id === ev.id)) {
        this.evidenceVault.push(ev);
        changed = true;
      }
    }

    for (const res of buildJuanKpiSeeds()) {
      if (!this.results.some((r) => r.id === res.id)) {
        this.results.push(res);
        changed = true;
      }
    }

    const queue = buildJuanContentQueue();
    for (const content of queue.contents) {
      if (!this.contents.some((c) => c.id === content.id)) {
        this.contents.push(content);
        changed = true;
      }
    }
    for (const task of queue.tasks) {
      if (!this.tasks.some((t) => t.id === task.id)) {
        this.tasks.push(task);
        changed = true;
      }
    }

    if (changed) this.saveAll();
  }

  /** Backfill pipelineStatus y stateHistory en contenidos legacy. */
  private migrateContentPipelineFields() {
    let changed = false;
    for (const content of this.contents) {
      if (!content.pipelineStatus) {
        content.pipelineStatus = mapLegacyContentStatus(content.status);
        changed = true;
      }
      if (!content.stateHistory?.length) {
        content.stateHistory = [
          {
            state: content.pipelineStatus,
            actorUid: 'system',
            actorRole: 'SYSTEM',
            at: content.updatedAt || content.createdAt,
            comment: 'Migración pipeline v1',
          },
        ];
        changed = true;
      }
    }
    if (changed) this.saveAll();
  }

  private migrateClientReviewBaselines() {
    let changed = false;
    for (const content of this.contents) {
      const pipeline = content.pipelineStatus || mapLegacyContentStatus(content.status);
      if (
        !content.clientReviewBaseline &&
        (pipeline === 'sent_to_client' ||
          pipeline === 'client_in_progress' ||
          pipeline === 'client_submitted' ||
          pipeline === 'manager_finalizing')
      ) {
        content.clientReviewBaseline = content.body;
        changed = true;
      }
    }
    if (changed) this.saveAll();
  }

  private migrateProfileFacts() {
    let changed = false;
    for (const clientId of Object.keys(this.profiles)) {
      const profile = this.profiles[clientId];
      if (!profile.facts?.length) {
        profile.facts = buildFactsFromProfile(profile);
        changed = true;
      }
    }
    if (changed) {
      this.refreshProfileCompleteness();
      this.saveAll();
    }
  }

  private migrateProofWallItems() {
    let changed = false;
    for (const client of this.clients) {
      if (client.status === 'ARCHIVED') continue;
      const existing = this.proofWallItems.filter((item) => item.clientId === client.id);
      if (!existing.length) {
        for (const template of buildDefaultProofWallItems(client.id, client.organizationId)) {
          this.proofWallItems.push({ ...template, id: createId('pw') });
        }
        changed = true;
      }
    }
    if (changed) this.saveAll();
  }

  private migrateOpportunityLifecycle() {
    let changed = false;
    for (const opp of this.opportunities) {
      if (!opp.lifecycleStage) {
        opp.lifecycleStage = mapOpportunityLifecycle(opp);
        changed = true;
      }
      if (
        (opp.lifecycleStage === 'checklist' || opp.status === 'IN_PROGRESS') &&
        !opp.submissionChecklist?.length
      ) {
        opp.submissionChecklist = defaultOpportunityChecklist(opp.type, opp);
        changed = true;
      }
    }
    if (changed) this.saveAll();
  }

  /**
   * Limpia el marcado de feed que el parser antiguo dejó en las señales.
   *
   * El parser sólo quitaba etiquetas crudas, así que el marcado escapado de
   * Google News (`&lt;a href=…&gt;`) se persistió como texto visible y desbordaba
   * las tarjetas. Sólo reescribe lo que sigue sucio, para no tocar señales sanas.
   *
   * No guarda: el llamador decide, porque con Firestore autoritativo la
   * hidratación ya persiste con `skipRemote` y no debe disparar un push masivo.
   */
  private sanitizeFeedTextMarkup(): boolean {
    let changed = false;
    for (const signal of this.signals) {
      if (signal.title && hasFeedMarkup(signal.title)) {
        signal.title = toPlainText(signal.title);
        changed = true;
      }
      if (signal.contentSnippet && hasFeedMarkup(signal.contentSnippet)) {
        signal.contentSnippet = toPlainText(signal.contentSnippet);
        changed = true;
      }
    }
    return changed;
  }

  private refreshProfileCompleteness(clientId?: string) {
    const targets = clientId ? [clientId] : Object.keys(this.profiles);
    for (const id of targets) {
      const profile = this.profiles[id];
      const client = this.getClientById(id);
      if (!profile || !client) continue;
      const coverage = computeProfileCoverage(profile);
      const completeness = Math.min(
        100,
        Math.round((coverage.totalConfirmed / 20) * 70 + (coverage.sectionsWithFacts / 5) * 30)
      );
      if (client.profileCompleteness !== completeness) {
        this.updateClient(id, { profileCompleteness: completeness });
      }
    }
  }

  private saveAll(options?: { skipRemote?: boolean }) {
    if (this.saveBatchDepth > 0) return;

    if (!FIREBASE_ENABLED) {
      localStorage.setItem('postura_clients_v5', JSON.stringify(this.clients));
      localStorage.setItem('postura_theses_v5', JSON.stringify(this.theses));
      localStorage.setItem('postura_profiles_v5', JSON.stringify(this.profiles));
      localStorage.setItem('postura_sources_v5', JSON.stringify(this.sources));
      localStorage.setItem('postura_signals_v5', JSON.stringify(this.signals));
      localStorage.setItem('postura_recommendations_v5', JSON.stringify(this.recommendations));
      localStorage.setItem('postura_tasks_v5', JSON.stringify(this.tasks));
      localStorage.setItem('postura_contents_v5', JSON.stringify(this.contents));
      localStorage.setItem('postura_opportunities_v5', JSON.stringify(this.opportunities));
      localStorage.setItem('postura_campaigns_v5', JSON.stringify(this.campaigns));
      localStorage.setItem('postura_milestones_v5', JSON.stringify(this.campaignMilestones));
      localStorage.setItem('postura_evidence_v5', JSON.stringify(this.evidenceVault));
      localStorage.setItem('postura_ai_runs_v5', JSON.stringify(this.aiRuns));
      localStorage.setItem('postura_subscription_v5', JSON.stringify(this.subscription));
      localStorage.setItem('postura_invitations_v5', JSON.stringify(this.invitations));
      localStorage.setItem('postura_results_v5', JSON.stringify(this.results));
      localStorage.setItem('postura_curation_v5', JSON.stringify(this.curation));
      localStorage.setItem('postura_deliveries_v5', JSON.stringify(this.deliveries));
      localStorage.setItem('postura_advices_v5', JSON.stringify(this.advices));
      localStorage.setItem('postura_files_v5', JSON.stringify(this.files));
      localStorage.setItem('postura_topic_pins_v5', JSON.stringify(this.topicPins));
      localStorage.setItem('postura_dossiers_v5', JSON.stringify(this.dossiers));
      localStorage.setItem('postura_feedback_v1', JSON.stringify(this.feedbackEvents));
      localStorage.setItem('postura_signal_outcomes_v1', JSON.stringify(this.signalOutcomes));
      localStorage.setItem('postura_proof_wall_v1', JSON.stringify(this.proofWallItems));
      localStorage.setItem('postura_notifications_db_v1', JSON.stringify(this.notifications));
      localStorage.setItem(
        'postura_signal_routing_history_v1',
        JSON.stringify(this.signalRoutingHistory)
      );
      localStorage.setItem(
        'postura_signal_score_history_v1',
        JSON.stringify(this.signalScoreHistory)
      );
    }

    if (!options?.skipRemote && FIREBASE_ENABLED) {
      void import('./firestore/sync').then(({ isFirestoreAuthoritative, scheduleFirestorePush }) => {
        if (isFirestoreAuthoritative()) {
          scheduleFirestorePush(this.exportSnapshot());
        }
      });
    }
    this.emitChange();
  }

  /** Agrupa escrituras en un solo persist (p. ej. materialización de briefing). */
  public runInSaveBatch<T>(fn: () => T): T {
    this.saveBatchDepth += 1;
    try {
      return fn();
    } finally {
      this.saveBatchDepth -= 1;
      if (this.saveBatchDepth === 0) this.saveAll();
    }
  }

  public getTasksByDeliveryPackage(packageId: string): Task[] {
    return this.tasks.filter((t) => t.deliveryPackageId === packageId);
  }

  public onChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((fn) => fn !== listener);
    };
  }

  private emitChange() {
    for (const fn of this.changeListeners) fn();
  }

  public exportSnapshot(): LocalV5Snapshot {
    return {
      clients: this.clients,
      theses: this.theses,
      profiles: this.profiles,
      sources: this.sources,
      signals: this.signals,
      recommendations: this.recommendations,
      tasks: this.tasks,
      contents: this.contents,
      opportunities: this.opportunities,
      campaigns: this.campaigns,
      campaignMilestones: this.campaignMilestones,
      evidenceVault: this.evidenceVault,
      aiRuns: this.aiRuns,
      subscription: this.subscription,
      invitations: this.invitations,
      results: this.results,
      curation: this.curation,
      deliveries: this.deliveries,
      advices: this.advices,
      files: this.files,
      topicPins: this.topicPins,
      dossiers: this.dossiers,
      feedbackEvents: this.feedbackEvents,
      signalOutcomes: this.signalOutcomes,
      proofWallItems: this.proofWallItems,
      notifications: this.notifications,
    };
  }

  public importSnapshot(
    partial: Partial<LocalV5Snapshot>,
    options?: { merge?: boolean; skipRemote?: boolean; scopeClientId?: string }
  ) {
    const merge = options?.merge !== false;
    const scopeClientId = options?.scopeClientId;
    const assign = <K extends keyof LocalV5Snapshot>(key: K, value: LocalV5Snapshot[K] | undefined) => {
      if (value === undefined) return;
      if (merge && Array.isArray(this[key]) && Array.isArray(value)) {
        const existing = this[key] as Array<{ id?: string; clientId?: string | null }>;
        const incoming = value as Array<{ id?: string; clientId?: string | null }>;
        const next = applyScopedCollectionMerge(existing, incoming, { merge: true, scopeClientId });
        if (next) (this[key] as unknown) = next;
        return;
      }
      (this[key] as unknown) = value;
    };

    assign('clients', partial.clients);
    assign('theses', partial.theses);
    assign('signals', partial.signals);
    assign('tasks', partial.tasks);
    assign('curation', partial.curation);
    assign('deliveries', partial.deliveries);
    assign('contents', partial.contents);
    assign('opportunities', partial.opportunities);
    assign('results', partial.results);
    assign('campaigns', partial.campaigns);
    assign('evidenceVault', partial.evidenceVault);
    assign('advices', partial.advices);
    assign('feedbackEvents', partial.feedbackEvents);
    assign('signalOutcomes', partial.signalOutcomes);
    assign('proofWallItems', partial.proofWallItems);
    assign('campaignMilestones', partial.campaignMilestones);
    assign('notifications', partial.notifications);
    assign('sources', partial.sources);

    if (partial.profiles) this.profiles = merge ? { ...this.profiles, ...partial.profiles } : partial.profiles;
    if (partial.dossiers) this.dossiers = merge ? { ...this.dossiers, ...partial.dossiers } : partial.dossiers;
    if (partial.topicPins) this.topicPins = partial.topicPins;
    if (partial.aiRuns) this.aiRuns = partial.aiRuns;
    if (partial.recommendations) this.recommendations = partial.recommendations;
    if (partial.subscription !== undefined) this.subscription = partial.subscription;
    if (partial.invitations) this.invitations = partial.invitations;
    if (partial.files) this.files = partial.files;

    this.ensureJuanCampaignSeed();
    this.migrateOpportunityLifecycle();
    // Con Firebase activo `loadInitialData()` no corre, así que este es el único
    // punto por el que pasan las señales de Firestore (pull inicial y realtime).
    this.sanitizeFeedTextMarkup();

    this.saveAll({ skipRemote: options?.skipRemote });

    if (partial.notifications) {
      void import('./notifications').then(({ notificationService }) => {
        notificationService.mergeFromRemote(this.notifications);
      });
    }
  }

  /** Hidrata desde Firestore tras login Firebase (backend autoritativo). */
  public async hydrateFromRemote(clientIds?: string[]): Promise<boolean> {
    const sync = await import('./firestore/sync');
    let ids = clientIds?.filter(Boolean);
    if (!ids?.length) {
      ids = await sync.listFirestoreClientIds();
    }
    if (!ids.length) return false;

    const partial = await sync.pullClientDataFromFirestore(ids);
    if (!partial.clients?.length) return false;
    this.importSnapshot(partial, { merge: false, skipRemote: true });
    return true;
  }

  /** Si Firestore está vacío, sube el seed demo (solo ADMIN, primera vez). */
  public async bootstrapFirestoreIfEmpty(): Promise<{ bootstrapped: boolean; message: string }> {
    const sync = await import('./firestore/sync');
    const existing = await sync.listFirestoreClientIds();
    if (existing.length) {
      return { bootstrapped: false, message: 'Firestore ya contiene clientes.' };
    }
    this.runBuiltInSeed();
    const result = await sync.importSnapshotToFirestore(this.exportSnapshot());
    return { bootstrapped: result.ok, message: result.message };
  }

  // Client CRUD
  public getClients(): Client[] {
    return this.clients.filter(c => c.status !== 'ARCHIVED');
  }

  public getClientById(id: string): Client | undefined {
    return this.clients.find(c => c.id === id);
  }

  public createClient(
    clientData: Omit<
      Client,
      'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'activeThesesCount' | 'completedTasksCount'
    > & { createdBy?: string; updatedBy?: string }
  ): Client {
    const quota = assertClientQuota(this.getSubscription(), this.getClients().length);
    if (!quota.ok) throw new Error(quota.message);
    const now = new Date().toISOString();
    const actor = clientData.createdBy?.trim() || 'user_admin_01';
    const { createdBy: _c, updatedBy: _u, ...rest } = clientData;
    const newClient: Client = {
      ...rest,
      id: createId('client'),
      createdAt: now,
      createdBy: actor,
      updatedAt: now,
      updatedBy: clientData.updatedBy?.trim() || actor,
      activeThesesCount: 0,
      completedTasksCount: 0,
    };
    this.clients.unshift(newClient);
    this.saveAll();
    return newClient;
  }

  public updateClient(id: string, updates: Partial<Client>): Client | null {
    const idx = this.clients.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.clients[idx] = { ...this.clients[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveAll();
    return this.clients[idx];
  }

  /** Espejo de bandeja para sync Firestore (sin Cloud Functions). */
  public getNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  public replaceNotifications(items: NotificationItem[]): void {
    const next = items.slice(0, 200);
    if (JSON.stringify(this.notifications) === JSON.stringify(next)) return;
    this.notifications = next;
    this.saveAll();
  }

  /** Alinea primaryManagerId de la cartera al UID real del manager logueado. */
  public bindPrimaryManagerUid(managerUid: string): void {
    if (!managerUid) return;
    let changed = false;
    for (const client of this.clients) {
      if (client.primaryManagerId !== managerUid) {
        client.primaryManagerId = managerUid;
        client.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) this.saveAll();
  }

  /** Alinea client.userId al UID de Auth del cliente. */
  public bindClientUserId(clientId: string, userId: string): void {
    const client = this.getClientById(clientId);
    if (!client || !userId || client.userId === userId) return;
    client.userId = userId;
    client.updatedAt = new Date().toISOString();
    this.saveAll();
  }

  // Master Profile & Onboarding (F7-D07)
  public getMasterProfile(clientId: string): ClientProfile | null {
    return this.profiles[clientId] || null;
  }

  public saveMasterProfile(profile: ClientProfile): void {
    this.profiles[profile.clientId] = { ...profile, updatedAt: new Date().toISOString() };
    this.refreshProfileCompleteness(profile.clientId);
    this.saveAll();
  }

  public addProfileFact(
    clientId: string,
    input: { section: ProfileFactSection; label: string; value: string; status?: ProfileFact['status']; source?: ProfileFact['source'] }
  ): ProfileFact | null {
    const profile = this.getMasterProfile(clientId);
    if (!profile) return null;
    const now = new Date().toISOString();
    const fact: ProfileFact = {
      id: createId('fact'),
      section: input.section,
      label: input.label.trim(),
      value: input.value.trim(),
      status: input.status || 'confirmed',
      source: input.source || 'manual',
      createdAt: now,
      updatedAt: now,
    };
    profile.facts = [...(profile.facts || []), fact];
    this.saveMasterProfile(profile);
    return fact;
  }

  public updateProfileFact(clientId: string, factId: string, updates: Partial<Pick<ProfileFact, 'label' | 'value' | 'status'>>): boolean {
    const profile = this.getMasterProfile(clientId);
    if (!profile?.facts) return false;
    const idx = profile.facts.findIndex((f) => f.id === factId);
    if (idx < 0) return false;
    profile.facts[idx] = {
      ...profile.facts[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveMasterProfile(profile);
    return true;
  }

  public confirmProfileFact(clientId: string, factId: string): boolean {
    return this.updateProfileFact(clientId, factId, { status: 'confirmed' });
  }

  public rejectProfileFact(clientId: string, factId: string): boolean {
    return this.updateProfileFact(clientId, factId, { status: 'rejected' });
  }

  public importCandidateFactsFromCv(clientId: string, cvText: string): number {
    const profile = this.getMasterProfile(clientId);
    if (!profile) return 0;
    const candidates = extractCandidateFactsFromCv(cvText);
    const existingValues = new Set((profile.facts || []).map((f) => f.value.toLowerCase()));
    const novel = candidates.filter((c) => !existingValues.has(c.value.toLowerCase()));
    profile.cvExtractedText = cvText.slice(0, 12000);
    profile.facts = [...(profile.facts || []), ...novel];
    this.saveMasterProfile(profile);
    return novel.length;
  }

  public getProofWallByClient(clientId: string): ProofWallItem[] {
    return this.proofWallItems
      .filter((item) => item.clientId === clientId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public updateProofWallItem(itemId: string, status: ProofWallItem['status']): boolean {
    const item = this.proofWallItems.find((i) => i.id === itemId);
    if (!item) return false;
    item.status = status;
    this.saveAll();
    return true;
  }

  public getProofWallItem(itemId: string): ProofWallItem | undefined {
    return this.proofWallItems.find((item) => item.id === itemId);
  }

  public saveProofWallItem(item: ProofWallItem): void {
    const index = this.proofWallItems.findIndex((row) => row.id === item.id);
    if (index < 0) {
      throw new Error('ProofWall item not found');
    }
    this.proofWallItems[index] = { ...item };
    this.saveAll();
  }

  public getEvidenceById(id: string): EvidenceVaultItem | undefined {
    return this.evidenceVault.find((item) => item.id === id);
  }

  // Theses (F8-D08)
  public getThesesByClient(clientId: string): PositioningThesis[] {
    return this.theses.filter(t => t.clientId === clientId && t.status !== 'ARCHIVED');
  }

  /**
   * Tesis activas ordenadas por prioridad declarada. Punto único desde el que el
   * router decide qué tesis aplica a cada señal.
   */
  public getActiveTheses(clientId: string): PositioningThesis[] {
    return this.getThesesByClient(clientId)
      .filter(t => t.status === 'ACTIVE')
      .sort((a, b) => {
        const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
        if (byPriority !== 0) return byPriority;
        return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
      });
  }

  /**
   * PRESENTATION_ONLY / LEGACY_COMPATIBILITY (SPEC-001 Phase 4).
   * First ACTIVE by priority — MUST NOT be used for strategic attribution,
   * routing, scoring authority, or agent thesis context.
   * Prefer: explicit selection, routed signal.thesisId, or all ACTIVE theses.
   */
  public getPrimaryThesis(clientId: string): PositioningThesis | undefined {
    return this.getActiveTheses(clientId)[0];
  }

  public getThesisById(clientId: string, thesisId: string): PositioningThesis | undefined {
    return this.getThesesByClient(clientId).find((t) => t.id === thesisId);
  }

  /**
   * Strategic thesis context: explicit selection → entity attribution.
   * No primary/[0] fallback (SPEC-001 Phase 4).
   */
  public resolveThesisFor(params: {
    clientId: string;
    selectedThesisId?: string | null;
    entityThesisId?: string | null;
  }): PositioningThesis | undefined {
    return resolveThesis({
      clientId: params.clientId,
      selectedThesisId: params.selectedThesisId,
      entityThesisId: params.entityThesisId,
      getById: (cid, tid) => this.getThesisById(cid, tid),
    });
  }

  public saveThesis(thesis: PositioningThesis): void {
    const idx = this.theses.findIndex(t => t.id === thesis.id);
    if (idx >= 0) {
      this.theses[idx] = { ...thesis, updatedAt: new Date().toISOString() };
    } else {
      const quota = assertThesisQuota(this.getSubscription(), this.getThesesByClient(thesis.clientId).length);
      if (!quota.ok) throw new Error(quota.message);
      this.theses.push(thesis);
    }
    this.recomputeActiveThesesCount(thesis.clientId);
    this.saveAll();
  }

  /** Mantiene el contador del cliente alineado con las tesis realmente ACTIVE. */
  public recomputeActiveThesesCount(clientId: string): void {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;
    client.activeThesesCount = this.getActiveTheses(clientId).length;
  }

  // Sources (F9-D09)
  public getSources(): Source[] {
    return this.sources.filter(s => s.status !== 'ARCHIVED');
  }

  /** Fuentes registradas para un cliente concreto (ingesta por perfil). */
  public getSourcesByClient(clientId: string): Source[] {
    return this.sources.filter((s) => s.status !== 'ARCHIVED' && s.clientId === clientId);
  }

  public addSource(sourceData: Omit<Source, 'id' | 'createdAt' | 'itemCount'>): Source {
    const quota = assertSourceQuota(this.getSubscription(), this.getSources().length);
    if (!quota.ok) throw new Error(quota.message);
    const newSource: Source = {
      ...sourceData,
      id: createId('src'),
      itemCount: 0,
      createdAt: new Date().toISOString()
    };
    this.sources.unshift(newSource);
    this.saveAll();
    return newSource;
  }

  /** Registra el resultado de una corrida de ingesta para diagnosticar la fuente. */
  public recordSourceRun(sourceId: string, outcome: SourceRunOutcome): void {
    const source = this.sources.find((s) => s.id === sourceId);
    if (!source) return;
    source.lastFetchedAt = new Date().toISOString();
    source.lastRunFetched = outcome.fetched;
    source.lastRunAccepted = outcome.accepted;
    source.lastRunRejected = outcome.rejected;
    source.itemCount += outcome.accepted;
    if (outcome.error) {
      source.lastError = outcome.error;
      source.status = 'ERROR';
    } else {
      source.lastError = undefined;
      if (source.status === 'ERROR') source.status = 'ACTIVE';
    }
    this.saveAll();
  }

  /** Pausa, reactiva o archiva una fuente (ingesta automática respeta PAUSED/ARCHIVED/ERROR). */
  public updateSourceStatus(
    sourceId: string,
    status: Source['status'],
    options?: { clearError?: boolean }
  ): Source | null {
    const source = this.sources.find((s) => s.id === sourceId);
    if (!source) return null;
    source.status = status;
    if (options?.clearError) source.lastError = undefined;
    this.saveAll();
    return source;
  }

  // Signals with Fingerprint Deduplication (F9-D09)
  public getSignals(): Signal[] {
    return this.signals;
  }

  public addSignal(signal: Omit<Signal, 'id' | 'detectedAt' | 'fingerprint' | 'aiStatus' | 'managerDecision'> & Partial<Pick<Signal, 'aiStatus' | 'managerDecision' | 'sourceQuality'>>): { signal: Signal; isDuplicate: boolean } {
    if (!signal.clientId) {
      throw new Error('SIGNAL_CLIENT_REQUIRED');
    }
    // F9-D09 content fingerprint (URL + title). Dedup lookup is client-scoped per
    // F6 §186 ("deduplicación se realizará principalmente por Cliente"; global = future).
    const canonical = `${(signal.sourceUrl || '').toLowerCase().split(/[?#]/)[0]}|${signal.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
    const rawFingerprint = `fp_${canonical.substring(0, 64)}`;
    const existing = this.signals.find(
      (s) => s.fingerprint === rawFingerprint && s.clientId === signal.clientId
    );

    if (existing) {
      return { signal: existing, isDuplicate: true };
    }

    const newSig: Signal = {
      aiStatus: 'PENDING_AI',
      managerDecision: 'UNREVIEWED',
      sourceQuality: 'UNASSESSED',
      ...signal,
      id: createId('sig'),
      fingerprint: rawFingerprint,
      detectedAt: new Date().toISOString()
    };
    this.signals.unshift(newSig);
    this.saveAll();
    return { signal: newSig, isDuplicate: false };
  }

  public updateSignalStatus(id: string, status: Signal['status'], reason?: string): void {
    const sig = this.signals.find(s => s.id === id);
    if (sig) {
      assertTransition(sig.status, status, SIGNAL_TRANSITIONS, 'SIGNAL');
      sig.status = status;
      if (reason) sig.discardReason = reason;
      this.saveAll();
    }
  }

  // Recommendations
  public getRecommendations(): Recommendation[] {
    return this.recommendations;
  }

  public addRecommendation(rec: Omit<Recommendation, 'id' | 'createdAt'>): Recommendation {
    const newRec: Recommendation = {
      ...rec,
      id: createId('rec'),
      createdAt: new Date().toISOString()
    };
    this.recommendations.unshift(newRec);
    this.saveAll();
    return newRec;
  }

  public updateRecommendationStatus(id: string, status: Recommendation['status']): void {
    const rec = this.recommendations.find(r => r.id === id);
    if (rec) {
      rec.status = status;
      this.saveAll();
    }
  }

  // Tasks
  public getTasksByClient(clientId: string): Task[] {
    return this.tasks.filter(t => t.clientId === clientId);
  }

  public getAllTasks(): Task[] {
    return this.tasks;
  }

  public addTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
    const newTask: Task = {
      ...task,
      id: createId('task'),
      createdAt: new Date().toISOString()
    };
    this.tasks.unshift(newTask);
    this.saveAll();
    return newTask;
  }

  public updateTaskStatus(id: string, status: Task['status'], evidenceUrl?: string, clientNotes?: string): void {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      assertTransition(task.status, status, TASK_TRANSITIONS, 'TASK');
      task.status = status;
      if (evidenceUrl) task.evidenceUrl = evidenceUrl;
      if (clientNotes) task.clientNotes = clientNotes;
      if (status === 'COMPLETED') {
        task.completedAt = new Date().toISOString();
        const client = this.clients.find(c => c.id === task.clientId);
        if (client) client.completedTasksCount += 1;
      }
      this.saveAll();
    }
  }

  public updateTaskEvidence(id: string, evidenceUrl: string, clientNotes?: string): void {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.evidenceUrl = evidenceUrl;
    if (clientNotes) task.clientNotes = clientNotes;
    this.saveAll();
  }

  // Content Items
  public getContentByClient(clientId: string): ContentItem[] {
    return this.contents.filter(c => c.clientId === clientId);
  }

  public getAllContent(): ContentItem[] {
    return this.contents;
  }

  public getContentById(id: string): ContentItem | undefined {
    return this.contents.find(c => c.id === id);
  }

  public saveContent(content: ContentItem): void {
    const idx = this.contents.findIndex(c => c.id === content.id);
    if (idx >= 0) {
      this.contents[idx] = { ...content, updatedAt: new Date().toISOString() };
    } else {
      this.contents.unshift(content);
    }
    this.saveAll();
  }

  public transitionContentPipeline(
    contentId: string,
    next: ContentPipelineStatus,
    actor: { uid: string; role: 'ADMIN' | 'CLIENT' | 'SYSTEM' },
    comment?: string
  ): ContentItem | null {
    const content = this.contents.find((c) => c.id === contentId);
    if (!content) return null;
    const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
    assertContentPipelineTransition(current, next, actor.role);
    content.pipelineStatus = next;
    content.status = syncLegacyStatusFromPipeline(next);
    if (next === 'sent_to_client' && !content.clientReviewBaseline) {
      content.clientReviewBaseline = content.body;
    }
    content.stateHistory = [
      ...(content.stateHistory || []),
      { state: next, actorUid: actor.uid, actorRole: actor.role, at: new Date().toISOString(), comment },
    ];
    content.updatedAt = new Date().toISOString();
    if (next === 'published') content.readyAt = new Date().toISOString();
    this.saveAll();
    return content;
  }

  public getFeedbackEventsForContent(contentId: string): FeedbackEvent[] {
    return this.feedbackEvents
      .filter((event) => event.contentId === contentId)
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }

  public getLatestClientEdit(contentId: string): FeedbackEvent | undefined {
    return this.getFeedbackEventsForContent(contentId).find((event) => event.kind === 'CLIENT_EDIT');
  }

  public addFeedbackEvent(input: Omit<FeedbackEvent, 'id' | 'createdAt'>): FeedbackEvent {
    const event: FeedbackEvent = {
      ...input,
      id: createId('fbk'),
      createdAt: new Date().toISOString(),
    };
    this.feedbackEvents.unshift(event);
    this.saveAll();
    return event;
  }

  public getSignalOutcomes(clientId?: string): SignalOutcome[] {
    return clientId
      ? this.signalOutcomes.filter((o) => o.clientId === clientId)
      : [...this.signalOutcomes];
  }

  public getSignalOutcome(signalId: string): SignalOutcome | undefined {
    return this.signalOutcomes.find((o) => o.signalId === signalId);
  }

  /**
   * SPEC-008 Phase 4 — COMPATIBILITY_WRITE_MIRROR only.
   * Called AFTER canonical Application success from learningLoopConsumer.
   * Must never establish strategic authority or trigger rescore.
   */
  public mirrorSignalOutcomeCompatibility(
    input: Omit<SignalOutcome, 'id' | 'createdAt'>
  ): SignalOutcome {
    this.signalOutcomes = this.signalOutcomes.filter((o) => o.signalId !== input.signalId);
    const outcome: SignalOutcome = {
      ...input,
      id: createId('sout'),
      createdAt: new Date().toISOString(),
    };
    this.signalOutcomes.unshift(outcome);
    this.saveAll();
    return outcome;
  }

  /**
   * @deprecated SPEC-008 Phase 4 — authority removed. Use learningLoopConsumer.registerSignalOutcomeIntent.
   */
  public recordSignalOutcome(
    _input: Omit<SignalOutcome, 'id' | 'createdAt'>
  ): SignalOutcome {
    throw new Error(
      'LEGACY_AUTHORITY_REMOVED: use learningLoopConsumer.registerSignalOutcomeIntent'
    );
  }

  public saveClientArticleRevision(
    contentId: string,
    input: {
      title: string;
      body: string;
      actorUid: string;
      taskId?: string;
    }
  ): FeedbackEvent | null {
    const content = this.getContentById(contentId);
    if (!content) return null;

    const baseline = content.clientReviewBaseline || content.body;
    const lines = diffLines(baseline, input.body);
    if (!hasDiffChanges(lines)) {
      this.saveContent({
        ...content,
        title: input.title,
        updatedAt: new Date().toISOString(),
      });
      return null;
    }

    const summary = summarizeDiff(lines);
    const event = this.addFeedbackEvent({
      organizationId: content.organizationId,
      clientId: content.clientId,
      contentId,
      taskId: input.taskId,
      kind: 'CLIENT_EDIT',
      actorUid: input.actorUid,
      actorRole: 'CLIENT',
      beforeText: baseline,
      afterText: input.body,
      diffHtml: renderDiffHtml(lines),
      diffSummary: summary,
    });

    this.saveContent({
      ...content,
      title: input.title,
      body: input.body,
      updatedAt: new Date().toISOString(),
    });

    return event;
  }

  public getTasksForClient(clientId: string, campaignId?: string): Task[] {
    return this.tasks.filter(
      (t) => t.clientId === clientId && (!campaignId || t.campaignId === campaignId)
    );
  }

  public getContentForClient(clientId: string, campaignId?: string): ContentItem[] {
    return this.contents.filter(
      (c) => c.clientId === clientId && (!campaignId || c.campaignId === campaignId)
    );
  }

  // Opportunities
  /**
   * SPEC-007 Phase 4 — COMPATIBILITY_READ_ONLY.
   * Prefer opportunityScoutConsumer.listOpportunitiesForClient (canonical Application).
   * Not SPEC-007 authority.
   */
  public getOpportunitiesByClient(clientId: string): Opportunity[] {
    return this.opportunities.filter(o => o.clientId === clientId);
  }

  /**
   * SPEC-007 Phase 4 — LEGACY_DEAD_OR_COMPATIBILITY_NONAUTHORITY (AUDIT007-04).
   * Id-only lookup must NOT be used as canonical Opportunity authority.
   * Canonical reads require organizationId + clientId + opportunityId via Application.
   */
  public getOpportunityById(id: string): Opportunity | undefined {
    return this.opportunities.find((opp) => opp.id === id);
  }

  /**
   * SPEC-007 Phase 4 — DEPRECATED_AUTHORITY_REMOVED from strategic consumers.
   * Retained for legacy test/compat surfaces only — NOT Opportunity authority.
   * Active SPEC-007 paths use acceptClientOpportunity / declineClientOpportunity.
   */
  public updateOpportunityDecision(id: string, decision: 'ACCEPTED' | 'REJECTED', notes?: string): void {
    const opp = this.opportunities.find(o => o.id === id);
    if (!opp) return;
    opp.clientDecision = decision;
    if (notes) opp.clientNotes = notes;
    if (decision === 'ACCEPTED') {
      opp.status = 'IN_PROGRESS';
      opp.lifecycleStage = 'checklist';
      opp.submissionChecklist = defaultOpportunityChecklist(opp.type, opp);
    } else {
      opp.status = 'REJECTED';
      opp.lifecycleStage = 'declined';
    }
    this.saveAll();
  }

  /**
   * SPEC-007 Phase 4 — DEPRECATED_AUTHORITY_REMOVED.
   * Active paths: toggleClientOpportunityChecklistItem via Application.
   */
  public toggleOpportunityChecklistItem(oppId: string, itemId: string, done: boolean): boolean {
    const opp = this.getOpportunityById(oppId);
    if (!opp?.submissionChecklist) return false;
    const item = opp.submissionChecklist.find((entry) => entry.id === itemId);
    if (!item) return false;
    item.done = done;
    opp.lifecycleStage = 'checklist';
    opp.status = 'IN_PROGRESS';
    this.saveAll();
    return true;
  }

  /**
   * SPEC-007 Phase 4 — DEPRECATED_AUTHORITY_REMOVED.
   * Active paths: submitClientOpportunity via Application.
   */
  public submitOpportunity(oppId: string): boolean {
    const opp = this.getOpportunityById(oppId);
    if (!opp?.submissionChecklist?.every((item) => item.done)) return false;
    opp.lifecycleStage = 'submitted';
    opp.status = 'COMPLETED';
    opp.submittedAt = new Date().toISOString();
    this.saveAll();
    return true;
  }

  /**
   * SPEC-007 Phase 4 — COMPATIBILITY_WRITE_MIRROR only.
   * Called AFTER canonical Application success from opportunityScoutConsumer.
   * Must never be used as fallback after Application deny, and must not establish
   * dual lifecycle authority (legacy status/stage are display/compat only).
   */
  public mirrorOpportunityCompatibility(opp: Opportunity): void {
    const idx = this.opportunities.findIndex((row) => row.id === opp.id);
    if (idx >= 0) {
      this.opportunities[idx] = { ...this.opportunities[idx], ...opp };
    } else {
      this.opportunities.unshift({ ...opp });
    }
    this.saveAll();
  }

  // Campaigns (F8-D08)
  public getCampaignsByClient(clientId: string): Campaign[] {
    return this.campaigns.filter(c => c.clientId === clientId && c.status !== 'ARCHIVED');
  }

  public addCampaign(campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Campaign {
    const now = new Date().toISOString();
    const newCamp: Campaign = {
      ...campaign,
      id: createId('camp'),
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin_01'
    };
    this.campaigns.unshift(newCamp);
    this.saveAll();
    return newCamp;
  }

  public getCampaignById(id: string): Campaign | undefined {
    return this.campaigns.find((c) => c.id === id);
  }

  public getCampaignMilestones(campaignId: string): CampaignMilestone[] {
    return this.campaignMilestones
      .filter((m) => m.campaignId === campaignId)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }

  public getCampaignMilestonesByClient(clientId: string, campaignId?: string): CampaignMilestone[] {
    return this.campaignMilestones
      .filter((m) => m.clientId === clientId && (!campaignId || m.campaignId === campaignId))
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }

  public getCurrentPlanDay(campaignId: string): number {
    const camp = this.getCampaignById(campaignId);
    if (!camp?.startDate || !camp.planDays) return 1;
    const start = new Date(camp.startDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
    return Math.max(1, Math.min(camp.planDays, diff));
  }

  // Evidence Vault (F7-D07 / F8-D08)
  public getEvidenceVaultByClient(clientId: string): EvidenceVaultItem[] {
    return this.evidenceVault.filter(e => e.clientId === clientId);
  }

  public addEvidenceItem(item: Omit<EvidenceVaultItem, 'id' | 'createdAt'>): EvidenceVaultItem {
    const newItem: EvidenceVaultItem = {
      ...item,
      id: createId('ev'),
      createdAt: new Date().toISOString()
    };
    this.evidenceVault.unshift(newItem);
    this.saveAll();
    return newItem;
  }

  public updateEvidenceItem(
    id: string,
    patch: Partial<Omit<EvidenceVaultItem, 'id' | 'clientId' | 'organizationId' | 'createdAt'>>
  ): EvidenceVaultItem | undefined {
    const idx = this.evidenceVault.findIndex(e => e.id === id);
    if (idx < 0) return undefined;
    this.evidenceVault[idx] = { ...this.evidenceVault[idx], ...patch };
    this.saveAll();
    return this.evidenceVault[idx];
  }

  /** Conecta o desconecta una evidencia de una tesis. Devuelve el estado resultante. */
  public toggleEvidenceThesis(evidenceId: string, thesisId: string): boolean {
    const item = this.evidenceVault.find(e => e.id === evidenceId);
    if (!item) return false;
    const current = item.associatedThesesIds || [];
    const linked = current.includes(thesisId);
    item.associatedThesesIds = linked
      ? current.filter(id => id !== thesisId)
      : [...current, thesisId];
    this.saveAll();
    return !linked;
  }

  // AI Run Logging & Observability (F10-D10)
  public getAiRuns(limit: number = 20): AIRunRecord[] {
    return this.aiRuns.slice(0, limit);
  }

  public recordAiRun(run: Omit<AIRunRecord, 'id' | 'createdAt'>): AIRunRecord {
    const newRun: AIRunRecord = {
      ...run,
      id: createId('run'),
      createdAt: new Date().toISOString()
    };
    this.aiRuns.unshift(newRun);
    if (this.subscription) {
      this.subscription.monthlyUsage.aiRuns += 1;
      this.subscription.monthlyUsage.tokensUsed += (run.promptTokens + run.completionTokens);
    }
    this.saveAll();
    return newRun;
  }

  // Subscription & Pricing Quotas (F17-D17)
  public getSubscription(): OrganizationSubscription {
    if (!this.subscription) {
      this.subscription = {
        organizationId: 'org_aurora_01',
        tier: 'PROFESSIONAL',
        status: 'ACTIVE',
        quotas: quotasFor('PROFESSIONAL'),
        monthlyUsage: {
          aiRuns: 0,
          tokensUsed: 0,
          activeClientsCount: this.clients.length,
          sourcesCount: this.sources.length
        },
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
      };
    }
    return this.subscription;
  }

  /**
   * DEPRECATED_AUTHORITY_REMOVED — CR-1 Master Profile.
   * Onboarding persistence is owned by `masterProfileConsumer.applyOnboardingStep`.
   * Retained as a hard fail-closed guard so dual business authority stays 0.
   */
  public applyOnboardingStep(_clientId: string, _step: number, _fields: Record<string, string>): never {
    throw new Error(
      'DEPRECATED: use masterProfileConsumer.applyOnboardingStep (CR-1 Master Profile Application)'
    );
  }

  public decideSignal(id: string, decision: ManagerDecision, reason?: string): void {
    const sig = this.signals.find((s) => s.id === id);
    if (!sig) return;
    sig.managerDecision = decision;
    if (decision === 'DISCARDED') {
      sig.status = 'DISCARDED';
      sig.discardReason = reason;
    }
    if (decision === 'CONVERTED') sig.status = 'CONVERTED';
    this.saveAll();
  }

  public createInvitation(clientId: string, email: string): Invitation {
    const client = this.getClientById(clientId);
    const organizationId = client?.organizationId?.trim();
    if (!organizationId) {
      throw new Error('Client missing organizationId for invitation');
    }
    const invite: Invitation = {
      id: createId('inv'),
      organizationId,
      clientId,
      email,
      token: createId('tok').replace('tok_', ''),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.invitations.unshift(invite);
    this.saveAll();
    return invite;
  }

  public getInvitationByToken(token: string): Invitation | undefined {
    return this.invitations.find((i) => i.token === token);
  }

  public getInvitationById(id: string): Invitation | undefined {
    return this.invitations.find((i) => i.id === id);
  }

  public markInvitationAccepted(id: string): void {
    const inv = this.invitations.find((i) => i.id === id);
    if (inv) {
      inv.status = 'ACCEPTED';
      this.saveAll();
    }
  }

  /** CR-1 Client Lifecycle compensation — existing Invitation status enum. */
  public markInvitationRevoked(id: string): void {
    const inv = this.invitations.find((i) => i.id === id);
    if (inv) {
      inv.status = 'REVOKED';
      this.saveAll();
    }
  }

  /**
   * SPEC-007 Phase 4 — DEPRECATED_AUTHORITY_REMOVED from strategic create path.
   * main.ts CREATE_OPPORTUNITY must use materializeOpportunityForDelivery.
   * Retained for seed/legacy tests only — NOT strategic Opportunity authority.
   * Prefer: mirrorOpportunityCompatibility after canonical Materialize success.
   */
  public addOpportunity(opp: Omit<Opportunity, 'id' | 'createdAt'>): Opportunity {
    const item: Opportunity = {
      ...opp,
      id: createId('opp'),
      createdAt: new Date().toISOString(),
      lifecycleStage: opp.lifecycleStage || (opp.status === 'SENT_TO_CLIENT' ? 'proposed' : mapOpportunityLifecycle(opp as Opportunity)),
    };
    this.opportunities.unshift(item);
    this.saveAll();
    return item;
  }

  /**
   * SPEC-007 Phase 4 — COMPATIBILITY_READ_ONLY / UNCHANGED_NONAUTHORITATIVE.
   * Global list — never use as tenant-filtered-after-load authority.
   */
  public getAllOpportunities(): Opportunity[] {
    return this.opportunities;
  }

  /**
   * SPEC-008 Phase 4 — COMPATIBILITY_WRITE_MIRROR only.
   * Called AFTER canonical Application success from learningLoopConsumer.
   */
  public mirrorResultRecordCompatibility(
    result: Omit<ResultRecord, 'id' | 'createdAt'>
  ): ResultRecord {
    const item: ResultRecord = {
      ...result,
      id: createId('res'),
      createdAt: new Date().toISOString(),
    };
    this.results.unshift(item);
    this.saveAll();
    return item;
  }

  /**
   * @deprecated SPEC-008 Phase 4 — authority removed. Use learningLoopConsumer.registerResultRecordIntent.
   */
  public addResult(_result: Omit<ResultRecord, 'id' | 'createdAt'>): ResultRecord {
    throw new Error(
      'LEGACY_AUTHORITY_REMOVED: use learningLoopConsumer.registerResultRecordIntent'
    );
  }

  public getResultsByClient(clientId: string): ResultRecord[] {
    return this.results.filter((r) => r.clientId === clientId);
  }

  // ==========================================
  // Señales por cliente + scoring persistido
  // ==========================================

  public getSignalsByClient(clientId: string): Signal[] {
    return this.signals.filter((s) => s.clientId === clientId);
  }

  public getSignalById(id: string): Signal | undefined {
    return this.signals.find((s) => s.id === id);
  }

  /**
   * @deprecated SPEC-002 Phase 4 — no active strategic callers. Prefer
   * `applyGovernedScoreToSignal` or `applyStrategicRoutingToSignal`.
   * Retained for compatibility reads only; does NOT perform auto-DISCARD.
   */
  public applyScoreToSignal(
    signalId: string,
    score: StrategicScoreResult,
    extras?: Pick<Signal, 'thesisId' | 'thesisScores' | 'whyNow' | 'routingDecision'>
  ): void {
    const sig = this.signals.find((s) => s.id === signalId);
    if (!sig) return;
    if (extras) {
      if ('thesisId' in extras) sig.thesisId = extras.thesisId;
      if ('thesisScores' in extras) sig.thesisScores = extras.thesisScores;
      if (extras.whyNow) sig.whyNow = extras.whyNow;
      if (extras.routingDecision) sig.routingDecision = extras.routingDecision;
    }
    sig.relevanceScore = score.totalScore;
    sig.priorityBand = score.priorityBand;
    sig.recommendedAction = score.recommendedAction;
    sig.scoreRationale = score.strategicRationale;
    sig.scoreBreakdown = buildScoreBreakdown(score);
    if (score.scoringVersion) sig.scoringVersion = score.scoringVersion;
    if (score.recommendedDisposition) sig.recommendedDisposition = score.recommendedDisposition;
    if (score.recommendedOutputFormat) sig.recommendedOutputFormat = score.recommendedOutputFormat;
    this.saveAll();
  }

  /**
   * SPEC-001 compatibility persistence: CLEAR requires routingDecision.selectedThesisId
   * and matching compatibility thesisId. Non-CLEAR must not persist selectedThesisId.
   * Conflict is rejected — top-level thesisId cannot override routingDecision.
   */
  private assertStrategicRoutingPersistShape(
    routingDecision: NonNullable<Signal['routingDecision']>,
    thesisId: string | undefined
  ): void {
    const selected = routingDecision.selectedThesisId?.trim();
    if (routingDecision.routingState === 'CLEAR') {
      if (!selected) {
        throw new Error('CLEAR routing requires routingDecision.selectedThesisId');
      }
      if (thesisId !== selected) {
        throw new Error(
          'CLEAR compatibility thesisId must match routingDecision.selectedThesisId'
        );
      }
      return;
    }
    if (selected) {
      throw new Error('Non-CLEAR routing must not persist selectedThesisId');
    }
  }

  /**
   * SPEC-001 Phase 2/3 — persist strategic routing WITHOUT silent terminal DISCARD.
   * Clears thesisId when undefined (CONTESTED / UNROUTED) so stale attribution is not implied.
   * When historyEntry is provided, appends it in the same saveAll unit (local atomicity).
   */
  public applyStrategicRoutingToSignal(
    signalId: string,
    score: StrategicScoreResult,
    extras: {
      thesisId: string | undefined;
      thesisScores: Signal['thesisScores'];
      whyNow?: Signal['whyNow'];
      routingDecision: NonNullable<Signal['routingDecision']>;
      organizationId?: string;
      clientId?: string;
      historyEntry?: SignalRoutingHistoryEntry;
    }
  ): void {
    const sig = this.signals.find((s) => s.id === signalId);
    if (!sig) {
      throw new Error(`Signal not found for strategic routing: ${signalId}`);
    }
    if (extras.clientId && sig.clientId !== extras.clientId) {
      throw new Error('Strategic routing tenant mismatch: clientId');
    }
    if (
      extras.organizationId &&
      sig.organizationId &&
      sig.organizationId !== extras.organizationId
    ) {
      throw new Error('Strategic routing tenant mismatch: organizationId');
    }
    this.assertStrategicRoutingPersistShape(extras.routingDecision, extras.thesisId);
    if (extras.historyEntry) {
      const h = extras.historyEntry;
      if (h.signalId !== signalId) {
        throw new Error('Routing history signalId mismatch');
      }
      if (extras.clientId && h.clientId !== extras.clientId) {
        throw new Error('Routing history clientId mismatch');
      }
      if (extras.organizationId && h.organizationId !== extras.organizationId) {
        throw new Error('Routing history organizationId mismatch');
      }
      this.signalRoutingHistory.push(h);
    }
    sig.thesisId = extras.thesisId;
    sig.thesisScores = extras.thesisScores;
    if (extras.whyNow) sig.whyNow = extras.whyNow;
    sig.routingDecision = extras.routingDecision;
    sig.relevanceScore = score.totalScore;
    sig.priorityBand = score.priorityBand;
    sig.recommendedAction = score.recommendedAction;
    sig.scoreRationale = score.strategicRationale;
    sig.scoreBreakdown = buildScoreBreakdown(score);
    // Intentionally NO auto-DISCARD — routing ≠ terminal disposition (SPEC-001 A12).
    this.saveAll();
  }

  /**
   * SPEC-002 Phase 3 — persist governed score WITHOUT routing mutation or auto-DISCARD.
   * Appends material score history in the same saveAll unit when provided.
   */
  public applyGovernedScoreToSignal(
    signalId: string,
    score: StrategicScoreResult,
    extras: {
      clientId: string;
      organizationId: string;
      routingContext: {
        routingState: 'CLEAR';
        routedThesisId: string;
        routingAlgorithmVersion?: string;
      };
      changedAt: string;
      historyEntry?: SignalScoreHistoryEntry;
    }
  ): void {
    const sig = this.signals.find((s) => s.id === signalId);
    if (!sig) {
      throw new Error(`Signal not found for governed score: ${signalId}`);
    }
    if (sig.clientId !== extras.clientId) {
      throw new Error('Governed score tenant mismatch: clientId');
    }
    if (sig.organizationId && sig.organizationId !== extras.organizationId) {
      throw new Error('Governed score tenant mismatch: organizationId');
    }
    if (extras.historyEntry) {
      const h = extras.historyEntry;
      if (h.signalId !== signalId) {
        throw new Error('Score history signalId mismatch');
      }
      if (h.clientId !== extras.clientId) {
        throw new Error('Score history clientId mismatch');
      }
      if (h.organizationId !== extras.organizationId) {
        throw new Error('Score history organizationId mismatch');
      }
      this.signalScoreHistory.push(h);
    }

    const disposition =
      score.recommendedDisposition ??
      (score.recommendedAction === 'CREATE_OPPORTUNITY'
        ? 'OPPORTUNITY_CANDIDATE'
        : score.recommendedAction === 'RESEARCH_REQUIRED'
          ? 'RESEARCH_REQUIRED'
          : score.recommendedAction === 'MONITOR'
            ? 'MONITOR'
            : score.recommendedAction === 'NO_ACTION'
              ? 'NO_ACTION'
              : 'SAVE');
    const format =
      score.recommendedOutputFormat ??
      (score.recommendedAction === 'VIDEO'
        ? 'VIDEO'
        : score.recommendedAction === 'SHORT_POST'
          ? 'SHORT_POST'
          : score.recommendedAction === 'ARTICLE'
            ? 'ARTICLE'
            : 'NONE');

    sig.relevanceScore = score.totalScore;
    sig.priorityBand = score.priorityBand;
    sig.recommendedAction = compatibilityRecommendedAction(disposition, format);
    sig.scoreRationale = score.strategicRationale;
    sig.scoreBreakdown = buildScoreBreakdown(score);
    sig.scoringVersion = score.scoringVersion ?? 'scoring-v1';
    sig.recommendedDisposition = disposition;
    sig.recommendedOutputFormat = format;
    sig.scoredAt = extras.changedAt;
    sig.scoreRoutedThesisId = extras.routingContext.routedThesisId;
    sig.scoreFactors = { ...score.factors };
    sig.scorePenalties = { ...score.penalties };
    // Intentionally NO routingDecision / thesisId mutation — score persistence only.
    // Intentionally NO auto-DISCARD — low score is data, not terminal command.
    this.saveAll();
  }

  public getSignalScoreHistory(signalId: string): SignalScoreHistoryEntry[] {
    return this.signalScoreHistory.filter((e) => e.signalId === signalId);
  }

  public getAllSignalScoreHistory(): SignalScoreHistoryEntry[] {
    return [...this.signalScoreHistory];
  }

  /** SPEC-001 Phase 3 — read routing history for a signal (local authority). */
  public getSignalRoutingHistory(signalId: string): SignalRoutingHistoryEntry[] {
    return this.signalRoutingHistory.filter((e) => e.signalId === signalId);
  }

  /** Test / admin helper — all routing history entries. */
  public getAllSignalRoutingHistory(): SignalRoutingHistoryEntry[] {
    return [...this.signalRoutingHistory];
  }

  /** Adjunta evidencia Tavily (agente RESEARCH_SIGNALS) a la señal. */
  public applyResearchBriefToSignal(signalId: string, brief: SignalResearchBrief): void {
    const sig = this.signals.find((s) => s.id === signalId);
    if (!sig) return;
    sig.researchBrief = brief;
    sig.aiStatus = 'ANALYZED';
    if (brief.suggestedNextStep === 'SHORT_POST' && sig.recommendedAction === 'RESEARCH_REQUIRED') {
      sig.recommendedAction = 'SHORT_POST';
    } else if (brief.suggestedNextStep === 'SAVE' && sig.recommendedAction === 'RESEARCH_REQUIRED') {
      sig.recommendedAction = 'SAVE';
    }
    this.saveAll();
  }

  // ==========================================
  // Mesa de curación
  // ==========================================

  public getCurationByClient(clientId: string): CurationEntry[] {
    return this.curation.filter((c) => c.clientId === clientId);
  }

  public getPendingCurationByClient(clientId: string): CurationEntry[] {
    return this.curation.filter((c) => c.clientId === clientId && c.destination === null);
  }

  /** Curación lista para entregar: decidida, no descartada y aún sin paquete. */
  public getReadyCurationByClient(clientId: string): CurationEntry[] {
    return this.curation.filter(
      (c) =>
        c.clientId === clientId &&
        c.destination !== null &&
        c.destination !== 'DISCARD' &&
        !c.deliveryPackageId
    );
  }

  public getCurationById(id: string): CurationEntry | undefined {
    return this.curation.find((c) => c.id === id);
  }

  public isSignalInCuration(clientId: string, signalId: string): boolean {
    return this.curation.some((c) => c.clientId === clientId && c.signalId === signalId);
  }

  public addToCuration(
    entry: Omit<CurationEntry, 'id' | 'createdAt' | 'destination' | 'managerRationale' | 'deliveryPackageId'> &
      Partial<Pick<CurationEntry, 'destination' | 'managerRationale' | 'aiAngle'>>
  ): CurationEntry {
    const item: CurationEntry = {
      destination: null,
      managerRationale: '',
      deliveryPackageId: null,
      ...entry,
      id: createId('cur'),
      createdAt: new Date().toISOString(),
    };
    this.curation.unshift(item);
    this.saveAll();
    return item;
  }

  public decideCuration(
    id: string,
    destination: CurationDestination,
    managerRationale: string,
    decidedBy: string
  ): CurationEntry | null {
    const item = this.curation.find((c) => c.id === id);
    if (!item) return null;
    item.destination = destination;
    item.managerRationale = managerRationale;
    item.decidedAt = new Date().toISOString();
    item.decidedBy = decidedBy;
    this.saveAll();
    return item;
  }

  public reopenCuration(id: string): void {
    const item = this.curation.find((c) => c.id === id);
    if (!item) return;
    item.destination = null;
    item.managerRationale = '';
    item.decidedAt = undefined;
    item.decidedBy = undefined;
    this.saveAll();
  }

  public setCurationAngle(id: string, aiAngle: string): void {
    const item = this.curation.find((c) => c.id === id);
    if (!item) return;
    item.aiAngle = aiAngle;
    this.saveAll();
  }

  public setCurationStrategicBriefId(id: string, strategicBriefId: string | null): void {
    const item = this.curation.find((c) => c.id === id);
    if (!item) return;
    item.strategicBriefId = strategicBriefId ?? undefined;
    this.saveAll();
  }

  public setDeliveryItemStrategicBriefId(
    packageId: string,
    itemId: string,
    strategicBriefId: string
  ): void {
    const pkg = this.deliveries.find((d) => d.id === packageId);
    const item = pkg?.items.find((i) => i.id === itemId);
    if (!item) return;
    item.strategicBriefId = strategicBriefId;
    this.saveAll();
  }

  public removeCuration(id: string): void {
    this.curation = this.curation.filter((c) => c.id !== id);
    this.saveAll();
  }

  // ==========================================
  // Paquetes de entrega
  // ==========================================

  public getDeliveriesByClient(clientId: string): DeliveryPackage[] {
    return this.deliveries.filter((d) => d.clientId === clientId);
  }

  public getSentDeliveriesByClient(clientId: string): DeliveryPackage[] {
    return sortDeliveriesBySentAt(
      this.deliveries.filter((d) => d.clientId === clientId && d.status !== 'DRAFT')
    );
  }

  public getDeliveryById(id: string): DeliveryPackage | undefined {
    return this.deliveries.find((d) => d.id === id);
  }

  public getDraftDelivery(clientId: string): DeliveryPackage | undefined {
    return this.deliveries.find((d) => d.clientId === clientId && d.status === 'DRAFT');
  }

  /** Devuelve el borrador abierto del cliente o crea uno nuevo. */
  public ensureDraftDelivery(clientId: string, createdBy: string): DeliveryPackage {
    const existing = this.getDraftDelivery(clientId);
    if (existing) return existing;
    const client = this.getClientById(clientId);
    const organizationId = client?.organizationId?.trim();
    if (!organizationId) {
      throw new Error('Client missing organizationId for delivery draft');
    }
    const now = new Date();
    const pkg: DeliveryPackage = {
      id: createId('pkg'),
      organizationId,
      clientId,
      title: `Briefing ${now.toLocaleDateString('es', { day: '2-digit', month: 'long' })}`,
      strategicNote: '',
      periodLabel: now.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
      items: [],
      status: 'DRAFT',
      createdAt: now.toISOString(),
      createdBy,
    };
    this.deliveries.unshift(pkg);
    this.saveAll();
    return pkg;
  }

  public addDeliveryItem(packageId: string, item: Omit<DeliveryItem, 'id'>): DeliveryPackage | null {
    const pkg = this.deliveries.find((d) => d.id === packageId);
    if (!pkg || pkg.status !== 'DRAFT') return null;
    pkg.items.push({ ...item, id: createId('ditem') });
    this.saveAll();
    return pkg;
  }

  public removeDeliveryItem(packageId: string, itemId: string): void {
    const pkg = this.deliveries.find((d) => d.id === packageId);
    if (!pkg || pkg.status !== 'DRAFT') return;
    pkg.items = pkg.items.filter((i) => i.id !== itemId);
    this.saveAll();
  }

  public updateDelivery(
    packageId: string,
    updates: Partial<Pick<DeliveryPackage, 'title' | 'strategicNote' | 'periodLabel'>>
  ): void {
    const pkg = this.deliveries.find((d) => d.id === packageId);
    if (!pkg || pkg.status !== 'DRAFT') return;
    Object.assign(pkg, updates);
    this.saveAll();
  }

  /** Descarta un borrador vacío o con ítems (desvincula curación). */
  public discardDraftDelivery(packageId: string): boolean {
    const pkg = this.deliveries.find((d) => d.id === packageId);
    if (!pkg || pkg.status !== 'DRAFT') return false;
    for (const item of pkg.items) {
      if (item.refId) {
        const entry = this.curation.find((c) => c.id === item.refId);
        if (entry) entry.deliveryPackageId = null;
      }
    }
    this.deliveries = this.deliveries.filter((d) => d.id !== packageId);
    this.saveAll();
    return true;
  }

  public markDeliverySent(packageId: string, convertedSignalIds?: readonly string[]): DeliveryPackage | null {
    const pkg = this.deliveries.find((d) => d.id === packageId);
    if (!pkg) return null;
    assertTransition(pkg.status, 'SENT', DELIVERY_TRANSITIONS, 'DELIVERY');
    if (!pkg.items.length) throw new Error('DELIVERY_EMPTY');
    pkg.status = 'SENT';
    pkg.sentAt = new Date().toISOString();
    const toConvert = new Set(convertedSignalIds ?? []);
    if (toConvert.size) {
      this.curation
        .filter((c) => c.deliveryPackageId === packageId && c.signalId && toConvert.has(c.signalId))
        .forEach((c) => {
          if (c.signalId) this.decideSignal(c.signalId, 'CONVERTED');
        });
    }
    this.saveAll();
    return pkg;
  }

  public attachCurationToDelivery(curationId: string, packageId: string | null): void {
    const item = this.curation.find((c) => c.id === curationId);
    if (!item) return;
    item.deliveryPackageId = packageId;
    this.saveAll();
  }

  public acknowledgeDelivery(
    packageId: string,
    clientAckNote?: string,
    acknowledgedAt?: string
  ): DeliveryPackage | null {
    const pkg = this.deliveries.find((d) => d.id === packageId);
    if (!pkg) return null;
    assertTransition(pkg.status, 'ACKNOWLEDGED', DELIVERY_TRANSITIONS, 'DELIVERY');
    pkg.status = 'ACKNOWLEDGED';
    pkg.acknowledgedAt = acknowledgedAt ?? new Date().toISOString();
    if (clientAckNote?.trim()) pkg.clientAckNote = clientAckNote.trim();
    this.saveAll();
    return pkg;
  }

  // ==========================================
  // Dossier maestro
  // ==========================================

  public getMasterDossier(clientId: string): MasterDossier | null {
    return this.dossiers[clientId] || null;
  }

  public saveMasterDossier(dossier: MasterDossier): void {
    this.dossiers[dossier.clientId] = { ...dossier, updatedAt: new Date().toISOString() };
    this.saveAll();
  }

  // ==========================================
  // Asesor de posicionamiento
  // ==========================================

  public getLatestAdvice(clientId: string): PositioningAdvice | undefined {
    return this.advices.find((a) => a.clientId === clientId);
  }

  public saveAdvice(advice: PositioningAdvice): void {
    this.advices = this.advices.filter((a) => a.clientId !== advice.clientId);
    this.advices.unshift(advice);
    this.saveAll();
  }

  // ==========================================
  // Archivos adjuntos (metadatos; el blob vive en IndexedDB)
  // ==========================================

  public getFilesByClient(clientId: string): AttachedFile[] {
    return this.files.filter((f) => f.clientId === clientId);
  }

  public addFileMeta(meta: Omit<AttachedFile, 'id' | 'createdAt'>): AttachedFile {
    const item: AttachedFile = { ...meta, id: createId('file'), createdAt: new Date().toISOString() };
    this.files.unshift(item);
    this.saveAll();
    return item;
  }

  // ==========================================
  // Temas fijados
  // ==========================================

  public getTopicPins(): string[] {
    return this.topicPins;
  }

  public toggleTopicPin(key: string): boolean {
    const idx = this.topicPins.indexOf(key);
    if (idx >= 0) {
      this.topicPins.splice(idx, 1);
      this.saveAll();
      return false;
    }
    this.topicPins.push(key);
    this.saveAll();
    return true;
  }

  // ==========================================
  // Agregados de cartera (dashboard nivel 1)
  // ==========================================

  public getPortfolioSummary(): ClientPortfolioSummary[] {
    const now = Date.now();

    return this.getClients()
      .map((client) => {
        const signals = this.getSignalsByClient(client.id);
        const tasks = this.getTasksByClient(client.id);
        const contents = this.getContentByClient(client.id);
        const theses = this.getThesesByClient(client.id);
        const opportunities = this.getOpportunitiesByClient(client.id);
        const deliveries = this.getDeliveriesByClient(client.id);
        const sent = deliveries.filter((d) => d.sentAt);
        const sources = this.getSourcesByClient(client.id);
        const activeSources = sources.filter((s) => s.status === 'ACTIVE');
        const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
        const thesis = this.getPrimaryThesis(client.id);
        const presetId = detectIndustryPreset(client, thesis);
        const presetLabel = getIndustryPresetMeta(presetId).label;

        const openTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
        const overdueTasks = openTasks.filter((t) => t.deadline && new Date(t.deadline).getTime() < now);

        const summary: ClientPortfolioSummary = {
          client,
          unreviewedSignals: signals.filter((s) => s.managerDecision === 'UNREVIEWED' && s.status !== 'DISCARDED').length,
          savedSignals: signals.filter((s) => s.managerDecision === 'SAVED').length,
          openTasks: openTasks.length,
          overdueTasks: overdueTasks.length,
          contentAwaitingClient: contents.filter((c) => c.status === 'CLIENT_REVIEW').length,
          contentAwaitingManager: contents.filter(
            (c) => c.status === 'MANAGER_REVIEW' || c.status === 'CHANGES_REQUESTED' || c.status === 'AI_GENERATED'
          ).length,
          thesisPendingApproval: theses.filter((t) => t.clientApprovalStatus === 'PENDING').length,
          opportunitiesPending: opportunities.filter((o) => !o.clientDecision && o.status !== 'ARCHIVED').length,
          pendingCuration: this.getPendingCurationByClient(client.id).length,
          draftDeliveries: deliveries.filter((d) => d.status === 'DRAFT').length,
          lastDeliveryAt: latestSentAt(sent),
          activeSources: activeSources.length,
          sourcesInError: sources.filter((s) => s.status === 'ERROR' || Boolean(s.lastError)).length,
          signalsLast7Days: signals.filter((s) => s.detectedAt >= since7 && s.status !== 'DISCARDED').length,
          researchPending: signals.filter(
            (s) => s.recommendedAction === 'RESEARCH_REQUIRED' && !s.researchBrief && s.status !== 'DISCARDED'
          ).length,
          industryPresetLabel: presetLabel,
          outcomePending: 0,
          usefulRate: null,
          attentionScore: 0,
          attentionReasons: [],
        };

        const outcomes = this.getSignalOutcomes(client.id);
        const conversion = computeConversionStats(signals, outcomes);
        summary.outcomePending = conversion.pendingFeedback;
        summary.usefulRate = conversion.usefulRate;

        const reasons: string[] = [];
        let score = 0;

        if (summary.overdueTasks > 0) {
          score += summary.overdueTasks * 12;
          reasons.push(`${summary.overdueTasks} tarea(s) vencida(s)`);
        }
        if (summary.contentAwaitingManager > 0) {
          score += summary.contentAwaitingManager * 8;
          reasons.push(`${summary.contentAwaitingManager} contenido(s) esperándote`);
        }
        if (summary.thesisPendingApproval > 0) {
          score += summary.thesisPendingApproval * 10;
          reasons.push('tesis sin aprobación del cliente');
        }
        if (summary.pendingCuration > 0) {
          score += summary.pendingCuration * 6;
          reasons.push(`${summary.pendingCuration} ítem(s) en curación sin decidir`);
        }
        if (summary.unreviewedSignals > 0) {
          score += Math.min(20, summary.unreviewedSignals * 2);
          reasons.push(`${summary.unreviewedSignals} señal(es) sin revisar`);
        }
        if (summary.sourcesInError > 0) {
          score += summary.sourcesInError * 5;
          reasons.push(`${summary.sourcesInError} fuente(s) con error de ingesta`);
        }
        if (summary.researchPending > 0) {
          score += Math.min(12, summary.researchPending * 4);
          reasons.push(`${summary.researchPending} señal(es) requieren investigación`);
        }
        if (summary.outcomePending > 0) {
          score += Math.min(8, summary.outcomePending * 2);
          reasons.push(`${summary.outcomePending} señal(es) convertidas sin feedback`);
        }
        if (client.onboardingStatus !== 'COMPLETED') {
          score += 15;
          reasons.push('onboarding incompleto');
        }
        if (!summary.lastDeliveryAt) {
          score += 10;
          reasons.push('sin entregas registradas');
        } else {
          const days = Math.floor((now - new Date(summary.lastDeliveryAt).getTime()) / 86400000);
          if (days > 14) {
            score += 14;
            reasons.push(`${days} días sin entrega`);
          }
        }

        summary.attentionScore = Math.min(100, score);
        summary.attentionReasons = reasons;
        return summary;
      })
      .sort((a, b) => b.attentionScore - a.attentionScore);
  }
}

export const dbService = new DataService();
