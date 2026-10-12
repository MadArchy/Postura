/**
 * SPEC-010 · tenant-safe query key factory.
 *
 * AUTHORITY: NONE. A cache key is an identity for a cache entry, never a
 * statement about permission.
 *
 * Every key for a tenant-owned resource is prefixed with the trusted tenant
 * scope, so the same entity id in two organizations can never share a cache
 * entry (threat T-010-08). Keys such as `['recommendation', recommendationId]`
 * are structurally impossible here: the factory cannot be called without a
 * `TrustedTenantScope`, which only the trusted session can produce.
 */

import { tenantScopeKey, type TrustedTenantScope } from './tenantScope';

export const QUERY_ROOT = 'postura' as const;

/**
 * Read-source provenance carried inside the key itself, so a canonical
 * projection and a legacy compatibility read of the same resource can never
 * collide in the cache and can be invalidated independently.
 */
export type ReadSource = 'canonical' | 'compatibility';

export type TenantQueryKey = readonly [
  typeof QUERY_ROOT,
  ReadSource,
  string,
  string,
  string,
  ...unknown[],
];

/**
 * Builds a tenant-scoped cache key.
 *
 * @param scope trusted tenant scope — never derived from UI input
 * @param source whether the data comes from a canonical projection or a legacy compatibility read
 * @param resource logical resource name
 * @param entityScope further scoping within the resource (entity id, filter, etc.)
 */
export function tenantQueryKey(
  scope: TrustedTenantScope,
  source: ReadSource,
  resource: string,
  ...entityScope: unknown[]
): TenantQueryKey {
  const [organizationId, clientId] = tenantScopeKey(scope);
  return [QUERY_ROOT, source, organizationId, clientId, resource, ...entityScope] as TenantQueryKey;
}

/** Session projection is not tenant-owned data; it has no tenant prefix by design. */
export function sessionQueryKey(): readonly [typeof QUERY_ROOT, 'session'] {
  return [QUERY_ROOT, 'session'] as const;
}

/** Invalidation scope for everything owned by one tenant. */
export function tenantInvalidationKey(
  scope: TrustedTenantScope,
  source: ReadSource
): readonly [typeof QUERY_ROOT, ReadSource, string, string] {
  const [organizationId, clientId] = tenantScopeKey(scope);
  return [QUERY_ROOT, source, organizationId, clientId] as const;
}

/**
 * Prefix of every dbService-backed compatibility query.
 *
 * Matches `['postura','compatibility', …]` and does not match canonical keys
 * (`['postura','canonical', …]`) or the session projection (`['postura','session']`).
 */
export function compatibilityQueryNamespace(): readonly [typeof QUERY_ROOT, 'compatibility'] {
  return [QUERY_ROOT, 'compatibility'] as const;
}

/** Prefix of every canonical projection query; never matches compatibility or session keys. */
export function canonicalQueryNamespace(): readonly [typeof QUERY_ROOT, 'canonical'] {
  return [QUERY_ROOT, 'canonical'] as const;
}
