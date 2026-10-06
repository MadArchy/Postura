/**
 * SPEC-010 · wave-2 component surface (T-010-201…205).
 *
 * This is NOT a page migration. Legacy page orchestration is untouched and
 * remains the served presentation; page-by-page migration is Phase 3
 * (T-010-301…306).
 *
 * What this file does is give the bounded components extracted in wave 2 a place
 * to render inside the React shell that already exists, so each can be exercised
 * and compared against its legacy counterpart. It renders no legacy page layout,
 * owns no route, and adds no DOM outside `#react-root`, so no new mount contract
 * and no `main.ts` change is required.
 *
 * The grouping below is presentation only. Which group is visible is local view
 * state; it decides nothing.
 */

import { ReactMasterDossierPanel } from '../MasterDossier/ReactMasterDossierPanel';
import { ReactOpportunityPanel, ReactOpportunitySpotlight } from '../Opportunity/ReactOpportunityPanel';
import { ReactKpiWeeklyChart } from '../Kpi/ReactKpiWeeklyChart';
import { ReactClientProfilePanel } from '../ClientProfile/ReactClientProfilePanel';
import { ReactProofWallPanel } from '../ProofWall/ReactProofWallPanel';
import { ReactSourceRegistryPanel } from '../SourceRegistry/ReactSourceRegistryPanel';
import { ReactOnboardingWizard } from '../Onboarding/ReactOnboardingWizard';
import { ReactPageHeader } from '../PageHeader/ReactPageHeader';

export type Wave2Group = 'opportunities' | 'results' | 'profile' | 'dossier' | 'sources';

const GROUP_META: Record<Wave2Group, { title: string; subtitle: string }> = {
  opportunities: {
    title: 'Oportunidades',
    subtitle: 'Lectura y comandos canónicos (SPEC-007) — ruta canónica completa.',
  },
  results: {
    title: 'Resultados',
    subtitle: 'KPIs semanales y registro de consultas por el consumidor canónico (SPEC-008).',
  },
  profile: {
    title: 'Mi perfil',
    subtitle: 'Cobertura, facts y onboarding. El guardado de pasos usa ApplyOnboardingStep canónico.',
  },
  dossier: {
    title: 'Dossier maestro',
    subtitle: 'Lectura de compatibilidad y exportación de presentación.',
  },
  sources: {
    title: 'Fuentes',
    subtitle: 'Inventario en solo lectura. Registro e ingesta se hacen en la pestaña Fuentes del workspace.',
  },
};

export function Wave2Surface({ group }: { group: Wave2Group }) {
  const meta = GROUP_META[group];

  return (
    <div className="page-content" data-testid="react-wave2-surface" data-wave2-group={group}>
      <ReactPageHeader title={meta.title} subtitle={meta.subtitle} eyebrow="SPEC-010 · wave 2" />

      {group === 'opportunities' ? (
        <>
          <ReactOpportunitySpotlight />
          <ReactOpportunityPanel />
        </>
      ) : null}

      {group === 'results' ? <ReactKpiWeeklyChart title="Tendencia semanal" /> : null}

      {group === 'profile' ? (
        <>
          <ReactClientProfilePanel />
          <ReactOnboardingWizard />
          <ReactProofWallPanel />
        </>
      ) : null}

      {group === 'dossier' ? <ReactMasterDossierPanel /> : null}

      {group === 'sources' ? <ReactSourceRegistryPanel /> : null}
    </div>
  );
}
