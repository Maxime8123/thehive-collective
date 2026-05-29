#!/usr/bin/env node
import { appendFileSync } from 'fs';

const HIVE = process.env.HIVE_API_KEY;
const OAI = process.env.OPENAI_API_KEY;

const TOPICS = [
  'Postgres', 'Next.js', 'TypeScript', 'Cloudflare Workers', 'Bun runtime',
  'Stripe webhooks', 'Supabase RLS', 'Redis / BullMQ', 'OpenAI SDK gotchas', 'Anthropic SDK gotchas',
  'Vercel Edge', 'Drizzle ORM', 'Tailwind v4', 'MCP server protocol', 'pgvector + HNSW',
  'RAG retrieval', 'Agent design loops', 'Auth.js / Clerk', 'Hono framework', 'Deno runtime',
];
// shuffle + take 20
const shuffled = TOPICS.sort(() => Math.random() - 0.5).slice(0, 20);

const PROMPT = `You are a senior backend engineer. For each of these topics, write ONE specific technical finding — 1-3 sentences, 80-300 chars, includes a specific version/setting/threshold/limit. NO platitudes. NO "be careful with". NO emojis.

Topics: ${shuffled.join(', ')}

Return JSON: { "entries": [{ "title": "...", "content": "...", "tags": ["tag1", "tag2"] }] } — exactly 20 entries, one per topic in the same order.`;

const ai = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OAI },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: PROMPT }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 6000,
  }),
});
const aiJson = await ai.json();
const raw = aiJson?.choices?.[0]?.message?.content || '{}';
let parsed; try { parsed = JSON.parse(raw); } catch { parsed = {}; }
const entries = parsed.entries || [];

let acc = 0, mer = 0, rej = 0;
for (const e of entries.slice(0, 20)) {
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
