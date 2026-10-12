import type { AiCompleteRequestBody } from '../../../src/interfaces/ai/aiCompleteTypes';
import {
  handleAiCompleteRequest,
  mapAiCompleteErrorStatus,
  type ClientOrganizationLookupPort,
} from '../../../src/interfaces/ai/handleAiCompleteRequest';
import {
  createServerAiGateway,
  createServerClientOrganizationLookup,
} from '../../../src/composition/ai/serverGatewayComposition';
import type { ProviderSecretConfig } from '../../../src/infrastructure/ai/configuration/providerSecrets';

export interface AiCompleteAuthContext {
  uid: string;
  role: 'ADMIN' | 'CLIENT';
  organizationId: string;
  clientId: string | null;
}

let cachedGateway: ReturnType<typeof createServerAiGateway> | null = null;
let cachedClientOrganizations: ClientOrganizationLookupPort | null = null;

export function resetAiCompleteGatewayCache(): void {
  cachedGateway = null;
  cachedClientOrganizations = null;
}

function getClientOrganizations(): ClientOrganizationLookupPort {
  if (!cachedClientOrganizations) {
    cachedClientOrganizations = createServerClientOrganizationLookup();
  }
  return cachedClientOrganizations;
}

function getGateway(secrets?: ProviderSecretConfig) {
  if (!cachedGateway || secrets) {
    cachedGateway = createServerAiGateway(secrets ? { secrets } : {});
  }
  return cachedGateway;
}

export async function runAiCompleteHttp(params: {
  auth: AiCompleteAuthContext;
  body: AiCompleteRequestBody;
  secrets?: ProviderSecretConfig;
}): Promise<{ status: number; payload: unknown }> {
  const gateway = getGateway(params.secrets);
  const response = await handleAiCompleteRequest({
    gateway,
    auth: {
      role: params.auth.role,
      organizationId: params.auth.organizationId,
      clientId: params.auth.clientId,
      userId: params.auth.uid,
    },
    body: params.body,
    clientOrganizations: getClientOrganizations(),
  });

  if (!response.ok) {
    return { status: mapAiCompleteErrorStatus(response.error.code), payload: response };
  }
  return { status: 200, payload: response };
}
