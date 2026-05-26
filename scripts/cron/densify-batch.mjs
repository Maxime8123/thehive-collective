#!/usr/bin/env node
import { appendFileSync } from 'fs';

const HIVE = process.env.HIVE_API_KEY;
const OAI = process.env.OPENAI_API_KEY;

// Ask GPT-4o-mini to draft 10 specific, dev-domain findings.
const PROMPT = `You are an expert backend dev. Write 10 specific technical findings — the kind a senior dev writes down after solving a real bug. Each must:
- Be 1-3 sentences, 80-300 chars
- Include a specific library/version/setting/threshold/limit
- AVOID platitudes ("be careful with", "consider using")
- Cover a different topic per finding: Postgres, Next.js, TypeScript, Cloudflare, Bun, Stripe, Supabase, Redis, OpenAI, Vercel, Tailwind v4, MCP servers — pick 10 distinct angles

Return a JSON array. Each item: { "title": "short < 80 chars", "content": "the finding", "tags": ["tag1", "tag2"] }`;

const ai = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OAI },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: PROMPT }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  }),
});
const aiJson = await ai.json();
const raw = aiJson?.choices?.[0]?.message?.content || '{}';
let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
const entries = parsed.entries || parsed.findings || parsed.items || Object.values(parsed)[0] || [];

let acc = 0, mer = 0, rej = 0;
for (const e of entries.slice(0, 10)) {
  if (!e.title || !e.content) continue;
  const r = await fetch('https://api.thehivecollective.io/knowledge/contribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + HIVE },
    body: JSON.stringify({ title: e.title.slice(0, 90), content: e.content, hive: 'academy', tags: e.tags || [] }),
  });
  const j = await r.json().catch(() => null);
  const v = j?.data?.verdict;
  if (v === 'accepted') acc++; else if (v === 'merged') mer++; else rej++;
  await new Promise((r) => setTimeout(r, 400));
}
const line = `- ${new Date().toISOString()} · densify · acc=${acc} merged=${mer} rej=${rej}\n`;
appendFileSync('AUTONOMOUS-LOG.md', line);
console.log(line.trim());
