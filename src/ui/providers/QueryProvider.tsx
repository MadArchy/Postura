/**
 * SPEC-010 · TanStack Query client.
 *
 * AUTHORITY: NONAUTHORITATIVE_CACHE.
 *
 * The cache is a presentation accelerator. It is never the source of business
 * truth, approval authority, lifecycle authority or tenant authority
 * (threats T-010-05, T-010-07, T-010-08).
 *
 * Defaults are deliberately conservative:
 * - `staleTime: 0` — cached data is always considered stale, so the UI refetches
 *   rather than presenting an old value as current.
 * - `retry: 0` — a denial must surface as a denial, not be retried into looking
 *   like a transient network fault.
 * - no `structuralSharing` tricks and no global optimistic behaviour: wave 1
 *   introduces no optimistic mutation at all.
 *
 * Hydration/realtime: this provider subscribes once to the compatibility store's
 * change port (via the A8 facade, never `dbService` directly) and invalidates
 * only the compatibility query namespace. Canonical and session keys are left
 * untouched. The subscription is released on teardown.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { readCompatibilityStoreOnChange } from '../data/compatibilityReads';
import { compatibilityQueryNamespace } from '../query/queryKeys';

export function createUiQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        retry: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createUiQueryClient);

  useEffect(() => {
    return readCompatibilityStoreOnChange(() => {
      void client.invalidateQueries({ queryKey: compatibilityQueryNamespace() });
    });
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
