/**
 * SPEC-006 Phase 5 — security / architecture enforcement (T-006-501…510).
 * Threat coverage: T-006-01…14 via static inventory + dependency bans.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const DOMAIN = join(SRC, 'domain');
const APP_CLAIM = join(SRC, 'application/claimEvidence');
const INFRA_CLAIM = join(SRC, 'infrastructure/claimEvidence');
const COMPOSITION = join(SRC, 'composition/claimEvidence');
const COMPONENTS = join(SRC, 'components');
const LEGACY_SURFACE = readLegacyControllerSurface();
const AI = join(SRC, 'services/ai.ts');

const CLAIM_DOMAIN_FILES = [
  'claimCore.ts',
  'evidenceCore.ts',
  'claimSourceCore.ts',
  'claimVerificationCore.ts',
  'claimLinkCore.ts',
  'claimTenantCore.ts',
  'claimGateCore.ts',
  'claimOverrideCore.ts',
  'claimMaterialityCore.ts',
  'claimEvidenceErrors.ts',
];

function collectTsFiles(dir: string): string[] {
  try {
    if (!statSync(dir).isDirectory()) return [];
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectTsFiles(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) results.push(full);
  }
  return results;
}

function extractImports(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function listProductionTs(): string[] {
  return collectTsFiles(SRC).filter((f) => !f.includes(`${join('src', 'test')}`));
}

describe('SPEC-006 Phase 5 — security architecture (T-006-501)', () => {
  it('Domain claimEvidence cores do not import Application / Infrastructure / UI', () => {
    const hits: string[] = [];
    for (const name of CLAIM_DOMAIN_FILES) {
      const file = join(DOMAIN, name);
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      for (const specifier of extractImports(readFileSync(file, 'utf8'))) {
        if (
          specifier.includes('/application/') ||
          specifier.includes('/infrastructure/') ||
          specifier.includes('/components/') ||
          specifier.includes('/services/') ||
          specifier.includes('main')
        ) {
          hits.push(`${rel} → ${specifier}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('Application claimEvidence does not import Infrastructure / UI / db / localStorage', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_CLAIM)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImports(content)) {
        if (
          specifier.includes('/infrastructure/') ||
          specifier.includes('/components/') ||
          specifier.includes('/services/db') ||
          specifier.includes('localStorage')
        ) {
          hits.push(`${rel} → ${specifier}`);
        }
      }
      if (stripComments(content).includes('localStorage')) hits.push(`${rel}: localStorage`);
    }
    expect(hits).toEqual([]);
  });

  it('UI has zero direct canonical repository / store authority', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(COMPONENTS)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImports(content)) {
        if (
          specifier.includes('infrastructure/claimEvidence') ||
          specifier.includes('LocalClaimRepository') ||
          specifier.includes('LocalVerificationStore') ||
          specifier.includes('LocalClaimEvidenceStore')
        ) {
          hits.push(`${rel} → ${specifier}`);
        }
      }
      if (/postura_claim_/.test(content)) hits.push(`${rel}: postura_claim_*`);
    }
    expect(hits).toEqual([]);
  });

  it('main.ts does not implement alternate claim truth or direct store keys', () => {
    const content = LEGACY_SURFACE;
    const without = stripComments(content);
    expect(content).toContain('authorizeContentPublicationGate');
    expect(without).not.toMatch(/claimSafety\.verdict\s*===\s*['"]PASS['"]/);
    expect(content).not.toContain('postura_claim_v1');
    expect(content).not.toContain('softwareAuthority: true');
    expect(without).not.toMatch(/claims\[0\]/);
    expect(without).not.toMatch(/verifications\[0\]/);
  });
});

describe('SPEC-006 Phase 5 — adapter / storage bypass inventory (T-006-506)', () => {
  it('executable production callers of Local* claim adapters are composition-only', () => {
    const hits: string[] = [];
    const adapters = [
      'LocalClaimRepository',
      'LocalVerificationStore',
      'LocalClaimHistoryAdapter',
      'LocalEvidenceVaultAdapter',
      'LocalClaimEvidenceStore',
      'createLocalClaimEvidenceStore',
    ];
    for (const file of listProductionTs()) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel.startsWith('src/infrastructure/claimEvidence/')) continue;
      if (rel.startsWith('src/composition/claimEvidence/')) continue;
      const content = readFileSync(file, 'utf8');
      for (const token of adapters) {
        if (content.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('canonical postura_claim_* keys exist only in Infrastructure storeKeys/store', () => {
    const hits: string[] = [];
    const keys = [
      'postura_claim_v1',
      'postura_claim_verification_v1',
      'postura_claim_history_v1',
      'postura_claim_link_v1',
      'postura_claim_evidence_v1',
      'postura_claim_override_v1',
    ];
    for (const file of listProductionTs()) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel.startsWith('src/infrastructure/claimEvidence/')) continue;
      const content = readFileSync(file, 'utf8');
      for (const key of keys) {
        if (content.includes(key)) hits.push(`${rel}: ${key}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('legacy claimSafety publication bypass paths in gate require canonical', () => {
    const gate = readFileSync(join(DOMAIN, 'claimSafetyGateCore.ts'), 'utf8');
    expect(gate).toContain('canonical');
    expect(gate).toMatch(/void claimSafety/);
    expect(gate).toContain('AuthorizePublication');
  });
});

describe('SPEC-006 Phase 5 — cross-SPEC freeze / advisory (T-006-507…509)', () => {
  it('SPEC-003 Brief writers are not imported by claimEvidence packages', () => {
    const hits: string[] = [];
    const banned = [
      'CreateStrategicBrief',
      'ApproveStrategicBrief',
      'RejectStrategicBrief',
      'OverrideStrategicBrief',
    ];
    for (const dir of [APP_CLAIM, INFRA_CLAIM, COMPOSITION]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        for (const token of banned) {
          if (content.includes(token)) hits.push(`${rel}: ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('SPEC-005 provider / paid AI paths absent from claimEvidence Application/Infra', () => {
    const hits: string[] = [];
    for (const dir of [APP_CLAIM, INFRA_CLAIM]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        if (/openai|anthropic|ExecuteAiOperation|AiGateway|api\.openai\.com/i.test(content)) {
          hits.push(rel);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('ai.reviewDraftClaims remains advisory COMPATIBILITY_ONLY (no Verification write)', () => {
    const ai = readFileSync(AI, 'utf8');
    expect(ai).toContain('COMPATIBILITY_ONLY');
    expect(ai).toContain('projectAdvisoryClaimSafety');
    expect(ai).not.toMatch(/createClaimVerification|commitWriteUnit|softwareAuthority\s*:\s*true/);
  });

  it('SPEC-009 auth-claims modules are not imported by SPEC-006 claimEvidence paths', () => {
    const hits: string[] = [];
    for (const dir of [APP_CLAIM, INFRA_CLAIM, COMPOSITION]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        for (const specifier of extractImports(readFileSync(file, 'utf8'))) {
          if (
            specifier.includes('posturaClaimsCore') ||
            specifier.includes('firebase/claims') ||
            specifier.includes('firebaseClaims')
          ) {
            hits.push(`${rel} → ${specifier}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('no new provider secrets / env key literals in SPEC-006 claim paths', () => {
    const hits: string[] = [];
    const secretLike = [
      /sk-[a-zA-Z0-9]{10,}/,
      /AIza[0-9A-Za-z\-_]{20,}/,
      /BEGIN (RSA |OPENSSH )?PRIVATE KEY/,
      /OPENAI_API_KEY\s*=\s*['"][^'"]+['"]/,
      /ANTHROPIC_API_KEY\s*=\s*['"][^'"]+['"]/,
    ];
    for (const dir of [APP_CLAIM, INFRA_CLAIM, COMPOSITION]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        for (const pattern of secretLike) {
          if (pattern.test(content)) hits.push(rel);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('SPEC-006 Phase 5 — UI/display legacy uses are non-authoritative (T-006-09/10)', () => {
  it('UI claimSafety.verdict checks are display/filter only (not publication gate)', () => {
    // Publication authority is exclusively authorizeContentPublicationGate in main.
    const main = stripComments(LEGACY_SURFACE);
    expect(main).toContain('authorizeContentPublicationGate');
    expect(main).not.toMatch(/claimSafety\.verdict\s*===\s*['"]PASS['"]/);

    // Workspace Production ClaimSafety display now lives on React ProductionPanel.
    // Leftover ClientWorkspace metric remains advisory display/filter only.
    const manager = readFileSync(join(COMPONENTS, 'ManagerCockpit.ts'), 'utf8');
    const workspace = readFileSync(
      join(ROOT, 'src/ui/modules/pages/ReactClientWorkspacePage.tsx'),
      'utf8'
    );
    const client = readFileSync(join(COMPONENTS, 'ClientWorkspace.ts'), 'utf8');
    expect(workspace).toMatch(/ReactClaimSafetyBadge/);
    expect(workspace).toMatch(/ReactClaimSafetyPanel/);
    expect(workspace).toMatch(/item\.claimSafety/);
    expect(workspace).toMatch(/verdict !== 'PASS'/);
    expect(client).toMatch(/claimSafety\.verdict/);
    expect(manager).not.toContain('authorizeContentPublicationGate');
    expect(workspace).not.toContain('authorizeContentPublicationGate');
    expect(client).not.toContain('LocalClaimRepository');
  });
});
