/**
 * Valida el flujo Tavily → fuentes → RSS para Juan (demo).
 * Uso: node scripts/validate-juan-tavily-flow.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvLocal() {
  const path = resolve(root, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const API_KEY = process.env.TAVILY_API_KEY || '';
const DEV_BASE = process.env.POSTURA_DEV_URL || 'http://127.0.0.1:5173';

const JUAN_QUERY =
  'Patentes e IP, adopción de IA AI Posture patent law intellectual property NIST AI RMF industry news regulatory';

async function tavilyDirect() {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      query: JUAN_QUERY,
      topic: 'news',
      max_results: 10,
      time_range: 'week',
      search_depth: 'basic',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Tavily ${response.status}`);
  return data.results || [];
}

async function tavilyViaDevProxy() {
  const response = await fetch(`${DEV_BASE}/api/tavily/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: JUAN_QUERY,
      topic: 'news',
      max_results: 10,
      time_range: 'week',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Proxy ${response.status}`);
  return data.results || [];
}

async function probeRss(url, base) {
  const response = await fetch(`${base}/api/rss?url=${encodeURIComponent(url)}`);
  const data = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    items: data.items?.length || 0,
    error: data.error,
  };
}

function mapDomains(results) {
  const skip = /google\.|linkedin\.|wikipedia\.|twitter\.|x\.com|youtube\./i;
  const domains = new Map();
  for (const r of results) {
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, '');
      if (skip.test(host)) continue;
      if (!domains.has(host)) domains.set(host, r.title);
    } catch {
      // ignore
    }
  }
  return domains;
}

function googleNewsSiteFeed(hostname, terms) {
  const q = `site:${hostname} (${terms.map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' OR ')}) when:14d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

async function main() {
  console.log('=== Flujo Tavily · Juan Vasquez ===\n');

  if (!API_KEY) {
    console.error('Falta TAVILY_API_KEY en .env.local');
    process.exit(1);
  }

  let results;
  try {
    const statusRes = await fetch(`${DEV_BASE}/api/tavily/status`);
    const status = await statusRes.json();
    if (status.available) {
      console.log(`Proxy dev OK (${DEV_BASE})\n`);
      results = await tavilyViaDevProxy();
    } else {
      console.log('Proxy sin key — Tavily directo\n');
      results = await tavilyDirect();
    }
  } catch (err) {
    console.warn(`Proxy no disponible (${err.message}) — Tavily directo\n`);
    results = await tavilyDirect();
  }

  console.log(`Resultados Tavily: ${results.length}\n`);
  for (const r of results.slice(0, 5)) {
    console.log(`  · ${r.title?.slice(0, 72)}…`);
    console.log(`    ${r.url}\n`);
  }

  const domains = mapDomains(results);
  const terms = ['patent law', 'artificial intelligence', 'intellectual property'];
  const rssBase = DEV_BASE;

  console.log(`Dominios únicos a proponer: ${domains.size}\n`);

  let ok = 0;
  let fail = 0;
  for (const [host, sampleTitle] of domains) {
    const feedUrl = googleNewsSiteFeed(host, terms);
    const probe = await probeRss(feedUrl, rssBase);
    const label = probe.ok ? `✓ ${probe.items} items` : `✗ ${probe.error || probe.status}`;
    if (probe.ok) ok += 1;
    else fail += 1;
    console.log(`  ${label}  ${host}`);
    console.log(`         muestra: ${sampleTitle?.slice(0, 60)}…`);
  }

  // Feeds oficiales del seed Juan
  const official = [
    'https://www.uspto.gov/rss.xml',
    'https://www.nist.gov/news-events/news/rss.xml',
    'https://ipwatchdog.com/feed/',
  ];
  console.log('\nFeeds oficiales (seed):\n');
  for (const url of official) {
    const probe = await probeRss(url, rssBase);
    console.log(`  ${probe.ok ? '✓' : '✗'} ${url} → ${probe.items || 0} items${probe.error ? ` (${probe.error})` : ''}`);
  }

  console.log(`\nResumen: ${ok} feeds Tavily OK, ${fail} fallidos de ${domains.size} dominios`);
  console.log('\nSiguiente paso en UI:');
  console.log('  1. http://127.0.0.1:5173 → manager@postura.internal');
  console.log('  2. Workspace Juan → Fuentes → Buscar con Tavily');
  console.log('  3. Activar todas e ingerir → Radar');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
