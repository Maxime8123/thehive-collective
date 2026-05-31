#!/usr/bin/env node
// Daily Moltbook post — pick a fresh KB entry, post it as a finding to a relevant submolt.
import { appendFileSync } from 'fs';

const MOLT = process.env.MOLTBOOK_API_KEY;
const HIVE = process.env.HIVE_API_KEY;

const ROTATION = [
  { submolt: 'agents', topic: 'agent design' },
  { submolt: 'memory', topic: 'shared memory' },
  { submolt: 'tooling', topic: 'developer tools' },
  { submolt: 'coding', topic: 'coding patterns' },
  { submolt: 'agentskills', topic: 'agent skills' },
  { submolt: 'mcp', topic: 'MCP servers' },
  { submolt: 'infrastructure', topic: 'infrastructure' },
];
const day = new Date().getUTCDay();
const slot = ROTATION[day % ROTATION.length];

// Pull a fresh KB entry tagged with the relevant topic
const search = await fetch(`https://api.thehivecollective.io/knowledge/query?q=${encodeURIComponent(slot.topic)}&limit=8`).then(r => r.json()).catch(() => null);
const entries = search?.data?.results || [];
const pick = entries.find(e => e.specificity_score >= 0.65 && e.content.length > 120) || entries[0];
if (!pick) {
  appendFileSync('AUTONOMOUS-LOG.md', `- ${new Date().toISOString()} · moltbook · skipped (no entry for ${slot.topic})\n`);
  process.exit(0);
}

const title = (pick.title || pick.content.split('.')[0]).slice(0, 280);
const content = `${pick.content}

---

This finding is part of [The Hive Collective](https://thehivecollective.io) — a free, keyless knowledge layer for AI agents. 290+ entries today, growing daily. No signup, no API key. Public dataset under CC-BY-SA-4.0 at [huggingface.co/datasets/Maximebouchard/the-hive-corpus](https://huggingface.co/datasets/Maximebouchard/the-hive-corpus).

Want to query similar entries from your own agent? \`curl 'https://api.thehivecollective.io/knowledge/query?q=${encodeURIComponent(slot.topic)}&limit=5'\``;

const r = await fetch('https://www.moltbook.com/api/v1/posts', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + MOLT, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    submolt_name: slot.submolt,
    title,
    content,
    type: 'text',
  }),
});
const text = await r.text();
let j; try { j = JSON.parse(text); } catch {}
const verdict = r.status === 201 ? 'posted' : 'failed';
const url = j?.post?.id ? `moltbook.com/p/${j.post.id}` : '';
appendFileSync('AUTONOMOUS-LOG.md', `- ${new Date().toISOString()} · moltbook-daily · m/${slot.submolt} · ${verdict} ${url}\n`);
console.log('moltbook-daily', r.status, verdict, url);

// Verification challenge? Solve + retry
if (j?.verification) {
  const v = j.verification;
  let answer = '';
  // Try to evaluate a simple math expression — the challenge is "What is 3 + 5?" style
  const m = v.challenge?.match(/(-?\d+)\s*([+\-*\/])\s*(-?\d+)/);
  if (m) {
    const [_, a, op, b] = m;
    const A = parseInt(a), B = parseInt(b);
    if (op === '+') answer = String(A + B);
    if (op === '-') answer = String(A - B);
    if (op === '*') answer = String(A * B);
    if (op === '/') answer = String(Math.floor(A / B));
  }
  if (answer) {
    await fetch('https://www.moltbook.com/api/v1/verify', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + MOLT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_code: v.verification_code, answer }),
    });
    appendFileSync('AUTONOMOUS-LOG.md', `- ${new Date().toISOString()} · moltbook-verify · answer=${answer}\n`);
  }
}
