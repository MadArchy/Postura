/**
 * Built-in seed content carries canonical `pipelineStatus` (CLIENT rules read a missing value as '').
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
  return { exported: [] as unknown[] };
});

vi.mock('../src/services/firestore/sync', () => ({
  isFirestoreAuthoritative: () => false,
  scheduleFirestorePush: () => {},
  listFirestoreClientIds: async () => [],
  importSnapshotToFirestore: async (snapshot: unknown) => {
    h.exported.push(structuredClone(snapshot));
    return { ok: true, message: 'ok', written: 1 };
  },
}));

import { dbService } from '../src/services/db';
import { mapLegacyContentStatus } from '../src/domain/contentPipeline';
import type { ContentItem, ContentStatus } from '../src/types';

const CLIENT_FACING_STATUSES: ContentStatus[] = ['CLIENT_REVIEW', 'CHANGES_REQUESTED', 'CLIENT_APPROVED'];

function seededContents(): ContentItem[] {
  dbService.runBuiltInSeed();
  return dbService.exportSnapshot().contents;
}

beforeEach(() => {
  h.exported = [];
});

describe('built-in seed content pipelineStatus', () => {
  it('PS-01: cnt_video_script_001 is seeded as CLIENT_REVIEW + sent_to_client', () => {
    const content = seededContents().find((c) => c.id === 'cnt_video_script_001');
    expect(content).toBeDefined();
    expect(content!.status).toBe('CLIENT_REVIEW');
    expect(content!.pipelineStatus).toBe('sent_to_client');
    expect(content!.type).toBe('VIDEO_SCRIPT');
  });

  it('PS-02: every client-facing seed item has a pipelineStatus agreeing with its legacy status', () => {
    const clientFacing = seededContents().filter((c) => CLIENT_FACING_STATUSES.includes(c.status));
    expect(clientFacing.length).toBeGreaterThan(0);
    for (const content of clientFacing) {
      expect(content.pipelineStatus, content.id).toBe(mapLegacyContentStatus(content.status));
    }
  });

  it('PS-03: no seeded CLIENT_REVIEW content lacks pipelineStatus', () => {
    const missing = seededContents().filter((c) => c.status === 'CLIENT_REVIEW' && !c.pipelineStatus);
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  it('PS-04: campaign-seeded client-facing content stays canonical', () => {
    const campaign = seededContents().filter(
      (c) => c.id.startsWith('cnt_seed_') && CLIENT_FACING_STATUSES.includes(c.status)
    );
    expect(campaign.map((c) => c.id).sort()).toEqual(['cnt_seed_post_1', 'cnt_seed_post_2', 'cnt_seed_vid_1', 'cnt_seed_vid_6']);
    for (const content of campaign) expect(content.pipelineStatus, content.id).toBe('sent_to_client');
  });

  it('PS-05: empty-tenant bootstrap exports no CLIENT_REVIEW content without pipelineStatus', async () => {
    const result = await dbService.bootstrapFirestoreIfEmpty();

    expect(result.bootstrapped).toBe(true);
    expect(h.exported).toHaveLength(1);
    const contents = (h.exported[0] as { contents: ContentItem[] }).contents;
    expect(contents.filter((c) => c.status === 'CLIENT_REVIEW' && !c.pipelineStatus)).toEqual([]);
    const seed = contents.find((c) => c.id === 'cnt_video_script_001');
    expect(seed).toMatchObject({
      status: 'CLIENT_REVIEW',
      pipelineStatus: 'sent_to_client',
      organizationId: 'org_aurora_01',
      clientId: 'client_juan_001',
    });
  });

  it('PS-06: send-to-client transition still stamps sent_to_client + CLIENT_REVIEW', () => {
    seededContents();
    const next = dbService.transitionContentPipeline('cnt_seed_post_3', 'sent_to_client', {
      uid: 'user_admin_01',
      role: 'ADMIN',
    });
    expect(next).toMatchObject({ pipelineStatus: 'sent_to_client', status: 'CLIENT_REVIEW' });
  });
});
