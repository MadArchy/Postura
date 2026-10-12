import type { FetchFn } from '../../infrastructure/ai/providers/fetchTransport';
import { OpenAiAdapter } from '../../infrastructure/ai/providers/OpenAiAdapter';
import { AnthropicAdapter } from '../../infrastructure/ai/providers/AnthropicAdapter';
import { RoutingAiProviderPort } from '../../infrastructure/ai/providers/RoutingAiProviderPort';
import { ModelRegistryAdapter } from '../../infrastructure/ai/registry/ModelRegistryAdapter';
import { PromptRegistryAdapter } from '../../infrastructure/ai/registry/PromptRegistryAdapter';
import { resolveProviderSecretsFromEnv, type ProviderSecretConfig } from '../../infrastructure/ai/configuration/providerSecrets';
import { resolveProviderTimeoutPolicy, type ProviderTimeoutPolicy } from '../../infrastructure/ai/configuration/providerTimeout';
import { ExecuteAiOperation } from '../../application/ai/use-cases/ExecuteAiOperation';
import type { AiGatewayPort } from '../../application/ai/ports/inbound/AiGatewayPort';
import type { AiProviderPort } from '../../application/ai/ports/outbound/AiProviderPort';
import type { AiRunRepositoryPort } from '../../application/ai/ports/outbound/AiRunRepositoryPort';
import { FirestoreAiRunRepository } from '../../infrastructure/ai/persistence/FirestoreAiRunRepository';
import { FirestoreClientOrganizationLookup } from '../../infrastructure/ai/persistence/FirestoreClientOrganizationLookup';
import type { ClientOrganizationLookupPort } from '../../interfaces/ai/handleAiCompleteRequest';

export interface ServerGatewayCompositionOptions {
  secrets?: ProviderSecretConfig;
  timeout?: ProviderTimeoutPolicy;
  fetchFn?: FetchFn;
  providerPort?: AiProviderPort;
  aiRunRepository?: AiRunRepositoryPort;
}

/** Production/server composition — never import from browser UI code. */
export function createServerAiGateway(options: ServerGatewayCompositionOptions = {}): AiGatewayPort {
  const secrets = options.secrets ?? resolveProviderSecretsFromEnv();
  const timeout = options.timeout ?? resolveProviderTimeoutPolicy();
  const fetchFn = options.fetchFn ?? fetch;

  const openAi = new OpenAiAdapter(secrets, timeout, fetchFn);
  const anthropic = new AnthropicAdapter(secrets, timeout, fetchFn);
  const providerPort =
    options.providerPort ??
    new RoutingAiProviderPort(
      new Map<string, AiProviderPort>([
        ['openai', openAi],
        ['anthropic', anthropic],
      ])
    );

  const aiRunRepository = options.aiRunRepository ?? new FirestoreAiRunRepository();

  return new ExecuteAiOperation({
    providerPort,
    modelRegistry: new ModelRegistryAdapter(),
    promptRegistry: new PromptRegistryAdapter(),
    aiRunRepository,
  });
}

/** Trusted client→organization ownership lookup for server AI entrypoints. */
export function createServerClientOrganizationLookup(): ClientOrganizationLookupPort {
  return new FirestoreClientOrganizationLookup();
}
