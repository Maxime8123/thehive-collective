#!/usr/bin/env node
// Snapshot KB stats from the public /collective/pulse endpoint (no auth needed).
import { appendFileSync } from 'fs';
const r = await fetch('https://api.thehivecollective.io/collective/pulse');
const j = await r.json().catch(() => null);
const d = j?.data || {};
const line = `- ${new Date().toISOString()} · KB=${d.entries_total ?? 'unknown'} +${d.entries_24h ?? '?'}/24h · active_agents=${d.active_agents ?? 'unknown'} · frameworks=${d.frameworks_count ?? '?'}\n`;
appendFileSync('AUTONOMOUS-LOG.md', line);
console.log(line.trim());
