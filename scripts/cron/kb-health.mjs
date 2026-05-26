#!/usr/bin/env node
import { writeFileSync, appendFileSync } from 'fs';
const HIVE = process.env.HIVE_API_KEY;
const r = await fetch('https://api.thehivecollective.io/admin/metrics', {
  headers: { Authorization: 'Bearer ' + HIVE },
});
const j = await r.json().catch(() => null);
const total = j?.data?.knowledge_base?.total_entries ?? 'unknown';
const agents = j?.data?.agents?.active_last_24h ?? 'unknown';
const date = new Date().toISOString();
const line = `- ${date} · KB=${total} · agents24h=${agents}\n`;
appendFileSync('AUTONOMOUS-LOG.md', line);
console.log(line.trim());
