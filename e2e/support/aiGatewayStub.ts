/**
 * E2E stub for the local AI Gateway endpoint (`/api/ai/gateway-complete`).
 *
 * ADMIN + Firebase always takes the gateway path, so AI-backed React controls
 * need a deterministic gateway in the emulator suite. Fixtures must satisfy the
 * strict output schema of their operation; the browser still parses them.
 * Direct provider hosts are aborted and counted so a test can prove the browser
 * never reached a model provider.
 */
import type { Page } from '@playwright/test';

export interface AiGatewayCall {
  readonly operation: string;
  readonly clientId: string | null;
  readonly promptId: string | null;
}

export interface AiGatewayStub {
  readonly calls: AiGatewayCall[];
  readonly providerHits: string[];
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined;
}

function stringField(value: unknown, key: string): string | null {
  const raw = field(value, key);
  return typeof raw === 'string' ? raw : null;
}

export async function stubAiGateway(
  page: Page,
  fixtures: Readonly<Record<string, unknown>>
): Promise<AiGatewayStub> {
  const stub: AiGatewayStub = { calls: [], providerHits: [] };

  await page.route(/openai|anthropic|generativelanguage\.googleapis/i, async (route) => {
    stub.providerHits.push(route.request().url());
    await route.abort();
  });

  await page.route('**/api/ai/gateway-complete', async (route) => {
    const body: unknown = route.request().postDataJSON();
    const operation = stringField(body, 'operation') ?? '';
    stub.calls.push({
      operation,
      clientId: stringField(body, 'clientId'),
      promptId: stringField(field(body, 'prompt'), 'promptId'),
    });

    const data = fixtures[operation];
    if (data === undefined) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'PROVIDER_UNAVAILABLE', message: `No E2E fixture for ${operation}`, retryable: false },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data,
        metadata: { operation, provider: 'e2e-stub', model: 'e2e-stub', latencyMs: 0 },
      }),
    });
  });

  return stub;
}
