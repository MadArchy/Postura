/**
 * Prueba todos los tipos de feed del pipeline de fuentes.
 * Uso: node scripts/probe-source-feeds.mjs [baseUrl]
 */
const base = process.argv[2] || 'http://127.0.0.1:5173';

const feeds = [
  ['USPTO', 'https://www.uspto.gov/rss.xml'],
  ['NIST', 'https://www.nist.gov/news-events/news/rss.xml'],
  ['IPWatchdog', 'https://ipwatchdog.com/feed/'],
  [
    'arXiv',
    'https://export.arxiv.org/api/query?search_query=all:patent+AND+all:"artificial+intelligence"&sortBy=submittedDate&sortOrder=descending&max_results=25',
  ],
  ['Google News EN', 'https://news.google.com/rss/search?q=patent+law+when%3A14d&hl=en-US&gl=US&ceid=US:en'],
  [
    'Bloomberg site',
    `https://news.google.com/rss/search?q=${encodeURIComponent('site:news.bloomberglaw.com ("patent law" OR patent) when:14d')}&hl=en-US&gl=US&ceid=US:en`,
  ],
];

async function probe(name, url) {
  const response = await fetch(`${base}/api/rss?url=${encodeURIComponent(url)}`);
  const data = await response.json();
  return { name, status: response.status, items: data.items?.length ?? 0, error: data.error };
}

const results = [];
for (const [name, url] of feeds) {
  try {
    results.push(await probe(name, url));
  } catch (error) {
    results.push({ name, status: 0, items: 0, error: error instanceof Error ? error.message : 'FAIL' });
  }
}

console.log('=== Probe feeds @', base, '===\n');
for (const r of results) {
  const ok = r.status === 200 && r.items > 0;
  console.log(`${ok ? '✓' : '✗'} ${r.name}: HTTP ${r.status} · ${r.items} items${r.error ? ` (${r.error})` : ''}`);
}
const failed = results.filter((r) => r.status !== 200 || r.items === 0);
process.exit(failed.length ? 1 : 0);
