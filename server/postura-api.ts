import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { callTavilySearch, fetchRssFeed } from './sourceFeedCore';
import { resolveYoutubeChannel, searchYoutubeChannels, searchYoutubeVideos } from './youtubeCore';
import { handleDevGatewayComplete } from './aiGatewayDevRoute';

const MAX_BODY = 1_500_000;
const TAVILY_RATE_WINDOW_MS = 60 * 60 * 1000;
const TAVILY_RATE_MAX = 40;
const YOUTUBE_RATE_WINDOW_MS = 60 * 60 * 1000;
const YOUTUBE_RATE_MAX = 60;

const tavilyRate = new Map<string, { count: number; windowStart: number }>();
const youtubeRate = new Map<string, { count: number; windowStart: number }>();

function tavilyApiKey(): string {
  return (process.env.TAVILY_API_KEY || '').trim();
}

function youtubeApiKey(): string {
  return (process.env.YOUTUBE_API_KEY || '').trim();
}

function checkRate(
  map: Map<string, { count: number; windowStart: number }>,
  clientKey: string,
  windowMs: number,
  max: number,
  errorCode: string
): void {
  const now = Date.now();
  const bucket = map.get(clientKey) || { count: 0, windowStart: now };
  if (now - bucket.windowStart > windowMs) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  map.set(clientKey, bucket);
  if (bucket.count > max) throw new Error(errorCode);
}

function checkTavilyRate(clientKey: string): void {
  checkRate(tavilyRate, clientKey, TAVILY_RATE_WINDOW_MS, TAVILY_RATE_MAX, 'TAVILY_RATE_LIMIT');
}

function checkYoutubeRate(clientKey: string): void {
  checkRate(youtubeRate, clientKey, YOUTUBE_RATE_WINDOW_MS, YOUTUBE_RATE_MAX, 'YOUTUBE_RATE_LIMIT');
}

function isLoopbackOrigin(req: IncomingMessage): boolean {
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || '');
  const allowed = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5174', 'http://localhost:5174'];
  if (origin && allowed.includes(origin)) return true;
  if (!origin && (host.startsWith('127.0.0.1:') || host.startsWith('localhost:'))) return true;
  return false;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function posturaApiPlugin(): Plugin {
  return {
    name: 'postura-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();

        try {
          // Local Gateway bridge (Phase 5+) — legacy session-key provider proxy removed in Phase 5D.
          if (req.method === 'POST' && url.startsWith('/api/ai/gateway-complete')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            await handleDevGatewayComplete(req, res);
            return;
          }

          if (req.method === 'GET' && url.startsWith('/api/tavily/status')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            return json(res, 200, { available: Boolean(tavilyApiKey()) });
          }

          if (req.method === 'POST' && url.startsWith('/api/tavily/search')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = tavilyApiKey();
            if (!apiKey) return json(res, 503, { error: 'TAVILY_KEY_MISSING' });

            checkTavilyRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));

            const body = JSON.parse((await readBody(req)) || '{}');
            const query = String(body.query || '').trim().slice(0, 400);
            if (!query) return json(res, 400, { error: 'QUERY_EMPTY' });

            const topic = body.topic === 'general' || body.topic === 'finance' ? body.topic : 'news';
            const maxResults = Math.min(Math.max(Number(body.max_results) || 8, 1), 15);
            const searchDepth =
              body.search_depth === 'advanced' ||
              body.search_depth === 'fast' ||
              body.search_depth === 'ultra-fast'
                ? body.search_depth
                : 'basic';
            const timeRange =
              body.time_range === 'day' ||
              body.time_range === 'month' ||
              body.time_range === 'year' ||
              body.time_range === 'week'
                ? body.time_range
                : 'week';

            const started = Date.now();
            try {
              const { results, query: q } = await callTavilySearch(apiKey, {
                query,
                topic,
                max_results: maxResults,
                search_depth: searchDepth,
                time_range: timeRange,
              });
              return json(res, 200, { results, query: q, latencyMs: Date.now() - started });
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'TAVILY_PROVIDER_ERROR';
              return json(res, 502, { error: 'TAVILY_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'GET' && url.startsWith('/api/youtube/status')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            return json(res, 200, { available: Boolean(youtubeApiKey()) });
          }

          if (req.method === 'POST' && url.startsWith('/api/youtube/resolve')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = youtubeApiKey();
            if (!apiKey) return json(res, 503, { error: 'YOUTUBE_KEY_MISSING' });
            checkYoutubeRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));
            const body = JSON.parse((await readBody(req)) || '{}');
            const targetUrl = String(body.url || '').trim();
            if (!targetUrl) return json(res, 400, { error: 'URL_EMPTY' });
            try {
              const resolved = await resolveYoutubeChannel(apiKey, targetUrl);
              if (!resolved) return json(res, 404, { error: 'YOUTUBE_CHANNEL_NOT_FOUND' });
              return json(res, 200, resolved);
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'YOUTUBE_PROVIDER_ERROR';
              return json(res, 502, { error: 'YOUTUBE_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'POST' && url.startsWith('/api/youtube/channels')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = youtubeApiKey();
            if (!apiKey) return json(res, 503, { error: 'YOUTUBE_KEY_MISSING' });
            checkYoutubeRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));
            const body = JSON.parse((await readBody(req)) || '{}');
            const query = String(body.query || '').trim().slice(0, 200);
            if (!query) return json(res, 400, { error: 'QUERY_EMPTY' });
            const maxResults = Math.min(Math.max(Number(body.maxResults) || 3, 1), 5);
            try {
              const channels = await searchYoutubeChannels(apiKey, query, maxResults);
              return json(res, 200, { channels, query });
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'YOUTUBE_PROVIDER_ERROR';
              return json(res, 502, { error: 'YOUTUBE_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'POST' && url.startsWith('/api/youtube/search')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = youtubeApiKey();
            if (!apiKey) return json(res, 503, { error: 'YOUTUBE_KEY_MISSING' });
            checkYoutubeRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));
            const body = JSON.parse((await readBody(req)) || '{}');
            const query = String(body.query || '').trim().slice(0, 200);
            if (!query) return json(res, 400, { error: 'QUERY_EMPTY' });
            const maxResults = Math.min(Math.max(Number(body.maxResults) || 15, 1), 25);
            try {
              const items = await searchYoutubeVideos(apiKey, query, maxResults);
              return json(res, 200, { items, query });
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'YOUTUBE_PROVIDER_ERROR';
              return json(res, 502, { error: 'YOUTUBE_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'GET' && url.startsWith('/api/rss')) {
            const target = new URL(url, 'http://local').searchParams.get('url') || '';
            if (!target) return json(res, 400, { error: 'URL_MISSING' });
            try {
              const { items, sourceUrl } = await fetchRssFeed(target);
              return json(res, 200, { items, sourceUrl });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'RSS_FAILED';
              if (message.startsWith('SOURCE_HTTP_ERROR:')) {
                return json(res, 502, { error: 'SOURCE_HTTP_ERROR', status: Number(message.split(':')[1]) || 0 });
              }
              if (message === 'FEED_EMPTY_OR_UNPARSEABLE') {
                return json(res, 422, { error: message });
              }
              throw error;
            }
          }

          return json(res, 404, { error: 'NOT_FOUND' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'UNKNOWN';
          const clientErrors = new Set([
            'SSRF_BLOCKED',
            'URL_SCHEME_DENIED',
            'URL_INVALID',
            'SSRF_DNS_FAILED',
            'SSRF_DNS_EMPTY',
            'FETCH_TOO_LARGE',
            'AI_RATE_LIMIT',
            'BODY_TOO_LARGE',
            'TAVILY_RATE_LIMIT',
            'YOUTUBE_RATE_LIMIT',
            'YOUTUBE_KEY_MISSING',
            'URL_EMPTY',
            'QUERY_EMPTY',
            'YOUTUBE_CHANNEL_NOT_FOUND',
            'FEED_EMPTY_OR_UNPARSEABLE',
          ]);
          const status = clientErrors.has(message) ? 400 : 500;
          if (message === 'AI_RATE_LIMIT' || message === 'TAVILY_RATE_LIMIT' || message === 'YOUTUBE_RATE_LIMIT') {
            return json(res, 429, { error: message });
          }
          return json(res, status, { error: message });
        }
      });
    },
  };
}
