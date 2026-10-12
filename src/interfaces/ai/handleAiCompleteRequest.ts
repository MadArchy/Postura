import type { AiGatewayPort } from '../../application/ai/ports/inbound/AiGatewayPort';
import type { AiGatewayRequest } from '../../application/ai/contracts/request';
import { isOperationSupported } from '../../application/ai/schemas/outputRegistry';
import { createGatewayError } from '../../domain/ai/errors';
import {
  resolveTrustedTenantForAiComplete,
  trustedTenantFailureToGatewayError,
  type AuthDerivedTenantInput,
} from './resolveTrustedTenant';
import type { ValidatedAiTenantContext } from '../../domain/ai/tenantContext';
import type { AiCompleteHttpResponse, AiCompleteRequestBody } from './aiCompleteTypes';

/** Server-side source of truth for which organization owns a client root document. */
export interface ClientOrganizationLookupPort {
  /** Returns the stored owning organizationId, or null when the client does not exist. */
  findOwningOrganizationId(clientId: string): Promise<string | null>;
}

const CLIENT_BINDING_DENIED_MESSAGE = 'clientId is not valid for the authenticated organization';

/**
 * ADMIN body clientId is an untrusted candidate: privileged (Admin SDK) persistence bypasses
 * Firestore Rules, so ownership must be proven against the token organization before the gateway runs.
 * Server entrypoints (`runAiCompleteHttp`) must always inject the lookup.
 */
async function verifyAdminClientBinding(
  tenant: ValidatedAiTenantContext,
  lookup: ClientOrganizationLookupPort
): Promise<boolean> {
  if (tenant.role !== 'ADMIN') return true;
  const clientId = tenant.clientId?.trim();
  if (!clientId) return true;
  if (clientId.includes('/')) return false;
  try {
    const owningOrganizationId = await lookup.findOwningOrganizationId(clientId);
    return owningOrganizationId !== null && owningOrganizationId === tenant.organizationId;
  } catch {
    return false;
  }
}

export async function handleAiCompleteRequest(params: {
  gateway: AiGatewayPort;
  auth: AuthDerivedTenantInput;
  body: AiCompleteRequestBody;
  clientOrganizations?: ClientOrganizationLookupPort;
}): Promise<AiCompleteHttpResponse> {
  const { body } = params;

  if (!isOperationSupported(body.operation)) {
    return {
      ok: false,
      error: createGatewayError({
        code: 'OPERATION_NOT_SUPPORTED',
        message: `Unsupported operation: ${body.operation}`,
        retryable: false,
      }),
    };
  }

  const tenantResult = resolveTrustedTenantForAiComplete(params.auth, {
    operation: body.operation,
    bodyClientId: body.clientId,
  });
  if (!tenantResult.ok) {
    return { ok: false, error: trustedTenantFailureToGatewayError(tenantResult) };
  }

  if (
    params.clientOrganizations &&
    !(await verifyAdminClientBinding(tenantResult.tenant, params.clientOrganizations))
  ) {
    return {
      ok: false,
      error: trustedTenantFailureToGatewayError({
        ok: false,
        code: 'AUTH_CONTEXT_INVALID',
        message: CLIENT_BINDING_DENIED_MESSAGE,
      }),
    };
  }

  const request: AiGatewayRequest = {
    operation: body.operation,
    tenant: tenantResult.tenant,
    input: body.input,
    prompt: body.prompt,
  };

  const result = await params.gateway.execute(request);
  if (!result.ok) {
    return { ok: false, error: result.error, metadata: result.metadata };
  }

  return {
    ok: true,
    data: result.data,
    metadata: result.metadata,
  };
}

export function mapAiCompleteErrorStatus(code: string): number {
  switch (code) {
    case 'AUTH_CONTEXT_INVALID':
    case 'OPERATION_NOT_SUPPORTED':
      return 400;
    case 'RATE_LIMITED':
      return 429;
    case 'TIMEOUT':
      return 504;
    case 'PROVIDER_UNAVAILABLE':
    case 'MODEL_NOT_RESOLVED':
      return 503;
    default:
      return 502;
  }
}
