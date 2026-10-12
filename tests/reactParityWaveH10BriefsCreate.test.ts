/**
 * SPEC-010 · R1 H10 — React Briefs tab creates a Strategic Brief from a curated item.
 *
 * Presentation only: the Briefs panel reuses the CR-2 hook already proven by P12 and
 * reads/approves briefs for the workspace client instead of the ADMIN session scope.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const PAGE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';

function briefsPanel(): string {
  const src = code(PAGE);
  const start = src.indexOf('function BriefsPanel');
  const end = src.indexOf('const SOURCE_TYPE_OPTIONS');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('H10 — Briefs panel workspace scope', () => {
  it('narrows the ADMIN session to the workspace client before reading or writing', () => {
    const panel = briefsPanel();
    expect(panel).toMatch(/function BriefsPanel\(\{ workspaceClientId = null \}/);
    expect(panel).toMatch(/narrowToClient\(tenantScope, requested\)/);
    expect(panel).toMatch(/useStrategicBriefs\(scope\)/);
    expect(panel).toMatch(/useApproveBrief\(scope\)/);
    expect(panel).toMatch(/useCreateBriefFromCuration\(scope\)/);
    expect(panel).toMatch(/useWorkspaceDeliver\(scope\)/);
    expect(panel).not.toMatch(/useStrategicBriefs\(tenantScope\)/);
    expect(panel).not.toMatch(/useApproveBrief\(tenantScope\)/);
  });

  it('the workspace page passes its client id into the Briefs panel', () => {
    expect(code(PAGE)).toMatch(/<BriefsPanel workspaceClientId=\{clientId\} \/>/);
  });
});

describe('H10 — create Strategic Brief from curated item on the Briefs tab', () => {
  it('offers the create control only for Brief-eligible ready entries without a brief', () => {
    const panel = briefsPanel();
    expect(panel).toMatch(/readyEntries/);
    expect(panel).toMatch(/curationDestinationToAuthorizedAction\(destination!\)/);
    expect(panel).toMatch(/!entry\.strategicBriefId/);
    expect(panel).toMatch(/react-ws-briefs-create-\$\{entry\.id\}/);
    expect(panel).toMatch(/createBrief\.mutateAsync\(\{ curationEntryId, destination \}\)/);
  });

  it('passes the factual destination from the read row, with no caller picker', () => {
    const panel = briefsPanel();
    expect(panel).toMatch(/const destination = entry\.destination as CurationDestination;/);
    expect(panel).toMatch(/onCreateBrief\(entry\.id, destination\)/);
    expect(panel).not.toMatch(/<select/);
  });

  it('no longer advertises brief creation as unavailable', () => {
    const panel = briefsPanel();
    expect(panel).not.toMatch(/LegacyHandoff/);
    expect(panel).not.toMatch(/react-ws-briefs-handoff/);
    expect(panel).not.toMatch(/desde un ítem curado/);
  });

  it('stays on the command seam: no raw consumer, store or AI access', () => {
    const panel = briefsPanel();
    expect(panel).not.toMatch(/\bdbService\b/);
    expect(panel).not.toMatch(/\bcreateBriefFromCurationEntry\s*\(/);
    expect(panel).not.toMatch(/\bapproveStrategicBrief\s*\(/);
    expect(panel).not.toMatch(/aiService|generateContentDraft|createContentDraft/);
  });
});
