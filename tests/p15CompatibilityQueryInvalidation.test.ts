/**
 * P15 Option B — compatibility-query invalidation is scoped to dbService-backed
 * keys and does not refetch canonical or session queries.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import {
  compatibilityQueryNamespace,
  QUERY_ROOT,
  sessionQueryKey,
} from '../src/ui/query/queryKeys';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('P15 compatibility query namespace', () => {
  it('is the dbService-backed compatibility prefix only', () => {
    expect(compatibilityQueryNamespace()).toEqual([QUERY_ROOT, 'compatibility']);
  });

  it('does not prefix-match canonical or session keys', () => {
    const ns = compatibilityQueryNamespace();
    const canonical = [QUERY_ROOT, 'canonical', 'org_aurora_01', '*portfolio*', 'opportunities'];
    const session = sessionQueryKey();
    const compatibility = [
      QUERY_ROOT,
      'compatibility',
      'org_aurora_01',
      '*portfolio*',
      'portfolio-overview',
    ];

    const prefixedBy = (key: readonly unknown[]) =>
      ns.length <= key.length && ns.every((part, i) => key[i] === part);

    expect(prefixedBy(compatibility)).toBe(true);
    expect(prefixedBy(canonical)).toBe(false);
    expect(prefixedBy(session)).toBe(false);
  });

  it('invalidateQueries marks only compatibility queries stale', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 0, retry: 0 } },
    });
    const compatibilityKey = [
      QUERY_ROOT,
      'compatibility',
      'org_aurora_01',
      '*portfolio*',
      'portfolio-overview',
    ];
    const canonicalKey = [QUERY_ROOT, 'canonical', 'org_aurora_01', '*portfolio*', 'opportunities'];
    const sessionKey = sessionQueryKey();

    client.setQueryData(compatibilityKey, { totalClients: 0 });
    client.setQueryData(canonicalKey, []);
    client.setQueryData(sessionKey, { user: null });

    await client.invalidateQueries({ queryKey: compatibilityQueryNamespace() });

    expect(client.getQueryState(compatibilityKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(canonicalKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(sessionKey)?.isInvalidated).toBe(false);
  });
});

describe('P15 QueryProvider bridge', () => {
  it('subscribes through the compatibility facade, not dbService', () => {
    const source = read('src/ui/providers/QueryProvider.tsx');
    expect(source).toContain('readCompatibilityStoreOnChange');
    expect(source).toContain('compatibilityQueryNamespace');
    expect(source).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(source).toContain('useEffect');
  });

  it('the facade change port is a read-side onChange wrap, not a mutator', () => {
    const source = read('src/ui/data/compatibilityReads.ts');
    expect(source).toMatch(
      /export function readCompatibilityStoreOnChange\(listener: \(\) => void\): \(\) => void/
    );
    expect(source).toContain('return dbService.onChange(listener)');
    expect(source).not.toMatch(/dbService\.(save|update|create|add|remove|delete|set|mark|record|reset|push)/);
  });
});
