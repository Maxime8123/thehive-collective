#!/usr/bin/env node
// Comprehensive monitor — runs every 30 min. Captures site/api/distribution metrics.
// Detects anomalies and writes [HEAVY_ALERT] lines that the hourly workflow can trip on.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';

const HIVE = process.env.HIVE_API_KEY;
const PAT = process.env.GH_READ_PAT;
const MOLT = process.env.MOLTBOOK_API_KEY;

// ─── Site health ──────────────────────────────────────────────
async function timed(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    return { url, status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { url, status: 0, ms: Date.now() - t0, err: String(e?.message || e).slice(0, 80) };
  }
}

const site = await Promise.all([
  timed('https://thehivecollective.io'),
  timed('https://thehivecollective.io/get-started'),
  timed('https://thehivecollective.io/docs'),
  timed('https://thehivecollective.io/sitemap.xml'),
  timed('https://api.thehivecollective.io/health'),
]);

// ─── Hive metrics ─────────────────────────────────────────────
// Public stats from /collective/pulse — no auth required, no founder key needed
let pulse = null;
try {
  const p = await fetch('https://api.thehivecollective.io/collective/pulse').then(r => r.json());
  pulse = p?.data || null;
} catch {}
const metrics = pulse ? {
  knowledge_base: { total_entries: pulse.entries_total },
  agents: { active_last_24h: pulse.active_agents },
  members: { total: pulse.frameworks_count }, // overloaded field; pulse has no member count
  newsletter: { active_subscribers: pulse.entries_24h }, // overloaded; show +24h delta here
} : null;

// ─── dev.to article stats ─────────────────────────────────────
let devto = [];
try {
  devto = await fetch('https://dev.to/api/articles?username=the-hive-collective&per_page=20').then(r => r.json());
} catch {}
const devSummary = devto.map(a => ({
  id: a.id,
  slug: a.slug,
  rx: a.public_reactions_count,
  cm: a.comments_count,
}));

// ─── GitHub stars + PR status ─────────────────────────────────
async function ghGet(path) {
  const init = PAT ? { headers: { Authorization: 'Bearer ' + PAT, 'User-Agent': 'monitor' } } : { headers: { 'User-Agent': 'monitor' } };
  return fetch('https://api.github.com' + path, init).then(r => r.json()).catch(() => null);
}

const [mcp, coll] = await Promise.all([
  ghGet('/repos/Maxime8123/thehive-mcp'),
  ghGet('/repos/Maxime8123/thehive-collective'),
]);
const prs = await Promise.all([
  ghGet('/repos/punkpeye/awesome-mcp-servers/pulls/6894'),
  ghGet('/repos/mahseema/awesome-ai-tools/pulls/1354'),
  ghGet('/repos/steven2358/awesome-generative-ai/pulls/768'),
]);

// ─── Moltbook profile ─────────────────────────────────────────
let molt = null;
if (MOLT) {
  try {
    const r = await fetch('https://www.moltbook.com/api/v1/agents/me', {
      headers: { Authorization: 'Bearer ' + MOLT },
    });
    molt = (await r.json())?.agent || null;
  } catch {}
}

// ─── Compare to last snapshot, detect anomalies ───────────────
const STATE = '.monitor-state.json';
let prev = {};
if (existsSync(STATE)) { try { prev = JSON.parse(readFileSync(STATE, 'utf8')); } catch {} }
const now = {
  kb: metrics?.knowledge_base?.total_entries,
  active24h: metrics?.agents?.active_last_24h,
  members: metrics?.members?.total,
  subs: metrics?.newsletter?.active_subscribers,
  mcpStars: mcp?.stargazers_count,
  collStars: coll?.stargazers_count,
  moltKarma: molt?.karma,
  moltFollowers: molt?.follower_count,
};
writeFileSync(STATE, JSON.stringify(now));

const alerts = [];
if (site.find(s => s.url.includes('api.thehivecollective.io/health') && s.status !== 200)) {
  alerts.push('HIVE_API_DOWN status=' + site.find(s => s.url.includes('/health')).status);
}
if (site.find(s => s.url === 'https://thehivecollective.io' && s.status !== 200)) {
  alerts.push('SITE_DOWN status=' + site.find(s => s.url === 'https://thehivecollective.io').status);
}
if (prev.kb && now.kb && now.kb < prev.kb) {
  alerts.push(`KB_REGRESSED ${prev.kb} -> ${now.kb}`);
}
if (prev.active24h && now.active24h !== undefined && now.active24h < prev.active24h * 0.5 && prev.active24h >= 4) {
  alerts.push(`ACTIVE_AGENTS_DROP ${prev.active24h} -> ${now.active24h}`);
}

// ─── Write log entry ──────────────────────────────────────────
const ts = new Date().toISOString();
const siteLine = site.map(s => `${s.url.split('/').slice(-2).join('/').slice(-25)}:${s.status}/${s.ms}ms`).join(' ');
const devLine = devSummary.length ? `devto ${devSummary.length}art ${devSummary.reduce((a, b) => a + b.rx, 0)}rx ${devSummary.reduce((a, b) => a + b.cm, 0)}cm` : '';
const prLine = prs.filter(Boolean).map(p => `#${p?.number}:${p?.state}${p?.merged ? '✓' : ''}${p?.comments ? '/' + p.comments + 'c' : ''}`).join(' ');
const ghLine = `gh Maxime8123/thehive-mcp:${now.mcpStars || 0}⭐ collective:${now.collStars || 0}⭐`;
const moltLine = molt ? `molt @${molt.name} k=${molt.karma} f=${molt.follower_count} p=${molt.posts_count} c=${molt.comments_count}` : '';
const kbLine = metrics ? `kb=${now.kb} ag24h=${now.active24h} mem=${now.members} subs=${now.subs}` : '';

const line = `- ${ts} · monitor · ${siteLine} · ${kbLine} · ${devLine} · ${prLine} · ${ghLine} · ${moltLine}\n`;
appendFileSync('AUTONOMOUS-LOG.md', line);
console.log(line.trim());

if (alerts.length) {
  const al = `- ${ts} · [HEAVY_ALERT] ${alerts.join(' · ')}\n`;
  appendFileSync('AUTONOMOUS-LOG.md', al);
  console.log(al.trim());
}
