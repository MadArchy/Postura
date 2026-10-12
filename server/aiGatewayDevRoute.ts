import type { IncomingMessage, ServerResponse } from 'node:http';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function ensureFirebaseAdmin(projectId: string): void {
  if (!getApps().length) {
    initializeApp({ projectId });
  }
}

function parsePosturaClaims(raw: Record<string, unknown>): {
  role: 'ADMIN' | 'CLIENT';
  organizationId: string;
  clientId: string | null;
} | null {
  const role = raw.role;
  if (role !== 'ADMIN' && role !== 'CLIENT') return null;
  const organizationId = typeof raw.organizationId === 'string' ? raw.organizationId.trim() : '';
  if (!organizationId) return null;
  if (role === 'ADMIN') return { role: 'ADMIN', organizationId, clientId: null };
  const clientId = typeof raw.clientId === 'string' ? raw.clientId.trim() : '';
  if (!clientId) return null;
  return { role: 'CLIENT', organizationId, clientId };
}

async function verifyAdminBearer(req: IncomingMessage): Promise<{
  uid: string;
  role: 'ADMIN';
  organizationId: string;
  clientId: string | null;
} | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const idToken = header.slice('Bearer '.length).trim();
  if (!idToken) return null;

  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) return null;

  ensureFirebaseAdmin(projectId);
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const claims = parsePosturaClaims(decoded as Record<string, unknown>);
    if (!claims || claims.role !== 'ADMIN') return null;
    return {
      uid: decoded.uid,
      role: 'ADMIN' as const,
      organizationId: claims.organizationId,
      clientId: claims.clientId,
    };
  } catch {
    return null;
  }
}

export async function handleDevGatewayComplete(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const user = await verifyAdminBearer(req);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: false,
        error: { code: 'AUTH_CONTEXT_INVALID', message: 'ADMIN Firebase token required', retryable: false },
      })
    );
    return true;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
    operation?: string;
    clientId?: string;
    input?: unknown;
    prompt?: { promptId: string; promptVersion: string };
  };

  const [{ handleAiCompleteRequest }, { createServerAiGateway, createServerClientOrganizationLookup }] =
    await Promise.all([
      import('../src/interfaces/ai/handleAiCompleteRequest'),
      import('../src/composition/ai/serverGatewayComposition'),
    ]);

  const gateway = createServerAiGateway();
  const response = await handleAiCompleteRequest({
    gateway,
    clientOrganizations: createServerClientOrganizationLookup(),
    auth: {
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      userId: user.uid,
    },
    body: {
      operation: body.operation as 'CONTENT_DRAFT',
      clientId: body.clientId,
      input: body.input,
      prompt: body.prompt!,
    },
  });

  res.statusCode = response.ok ? 200 : 502;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(response));
  return true;
}
