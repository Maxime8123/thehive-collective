#!/usr/bin/env node
import { appendFileSync } from 'fs';

const HF = process.env.HUGGINGFACE_TOKEN;
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!HF || !SUPA_URL || !SUPA_SRK) {
  appendFileSync('AUTONOMOUS-LOG.md', `- ${new Date().toISOString()} · hf-refresh · skipped (missing creds)\n`);
  process.exit(0);
}

// Fetch latest corpus from Supabase via PostgREST
const sb = async (path, init = {}) =>
  fetch(SUPA_URL + '/rest/v1' + path, {
    ...init,
    headers: {
      apikey: SUPA_SRK,
      Authorization: 'Bearer ' + SUPA_SRK,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(init.headers || {}),
    },
  });

const r = await sb('/knowledge_entries?status=eq.accepted&select=title,content,hive,tags,specificity_score,created_at&limit=10000');
if (r.status !== 200) {
  appendFileSync('AUTONOMOUS-LOG.md', `- ${new Date().toISOString()} · hf-refresh · supabase ${r.status}\n`);
  process.exit(0);
}
const rows = await r.json();
const jsonl = rows.map((row) => JSON.stringify({
  title: row.title,
  content: row.content,
  hive: row.hive,
  tags: row.tags,
  specificity: row.specificity_score,
  created_at: row.created_at,
})).join('\n');

// Upload to HF Dataset via commit endpoint
const repoId = 'Maximebouchard/the-hive-corpus';
const ndjson = [
  JSON.stringify({ key: 'header', value: { summary: 'weekly refresh', description: 'cron-driven' } }),
  JSON.stringify({ key: 'file', value: { path: 'hive_corpus.jsonl', encoding: 'utf-8', content: Buffer.from(jsonl).toString('base64') } }),
].join('\n') + '\n';

const up = await fetch(`https://huggingface.co/api/datasets/${repoId}/commit/main`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${HF}`, 'Content-Type': 'application/x-ndjson' },
  body: ndjson,
});
const verdict = up.status === 200 ? 'ok' : 'fail';
appendFileSync('AUTONOMOUS-LOG.md', `- ${new Date().toISOString()} · hf-refresh · ${verdict} · ${rows.length} entries\n`);
console.log('hf-refresh', verdict, rows.length);
