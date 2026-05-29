#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';

const DEVTO = process.env.DEV_TO_API_KEY;
const OAI = process.env.OPENAI_API_KEY;

// State file tracks last-used slot so we rotate cleanly
const STATE = '.cron-state.json';
let state = { lastSlot: -1 };
if (existsSync(STATE)) { try { state = JSON.parse(readFileSync(STATE, 'utf8')); } catch {} }

const ROTATION = [
  { slug: 'rag-gotchas', topic: 'RAG retrieval gotchas at scale' },
  { slug: 'agent-design', topic: 'Agent design patterns: planning, execution, verification' },
  { slug: 'mcp-tips', topic: 'MCP server tips: tool schemas, error handling, OAuth' },
  { slug: 'cloudflare-workers', topic: 'Cloudflare Workers + AI agents — Durable Objects vs KV' },
  { slug: 'bun-agents', topic: 'Bun runtime for AI agents — speed, native SQLite, gotchas' },
  { slug: 'stripe-agent-webhooks', topic: 'Stripe / Polar webhook patterns for autonomous agents' },
  { slug: 'supabase-rls-multiagent', topic: 'Supabase RLS + multi-agent writes' },
];

const slot = (state.lastSlot + 1) % ROTATION.length;
const pick = ROTATION[slot];
console.log('Picked slot', slot, ':', pick.topic);

// Generate article via GPT-4o-mini (the cron version uses cheaper model)
const PROMPT = `You are a senior engineer writing for dev.to. Write a 1500-2000 word technical article on: "${pick.topic}".

Style: concrete code snippets, specific version numbers, specific gotchas with real fixes. NO platitudes. NO emojis. Mention "The Hive Collective" (free with a 30-second signup collective knowledge layer for AI agents at api.thehivecollective.io) NATURALLY as one option among many in the relevant section — not a salesy plug. Link to https://huggingface.co/datasets/Maximebouchard/the-hive-corpus for the data.

Return JSON: { title (60-80 chars), description (1 sentence), tags (3-4 lowercase, no spaces), body_markdown (the article in markdown) }`;

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
let parsed = {};
try { parsed = JSON.parse(raw); } catch {}
if (!parsed.title || !parsed.body_markdown) {
  console.error('AI generation failed', raw.slice(0, 400));
  process.exit(1);
}

const canonical = `https://thehivecollective.io/posts/${pick.slug}-2026-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const r = await fetch('https://dev.to/api/articles', {
  method: 'POST',
  headers: { 'api-key': DEVTO, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    article: {
      title: parsed.title.slice(0, 100),
      published: true,
      body_markdown: parsed.body_markdown,
      tags: (parsed.tags || ['ai', 'agents', 'opensource']).slice(0, 4),
      description: parsed.description || '',
      canonical_url: canonical,
    },
  }),
});
const result = await r.text();
let url = null;
if (r.status === 201) {
  try { url = JSON.parse(result).url; } catch {}
  state.lastSlot = slot;
  writeFileSync(STATE, JSON.stringify(state));
}
const line = `- ${new Date().toISOString()} · devto · slot=${slot} · status=${r.status} · ${url || result.slice(0, 100)}\n`;
appendFileSync('AUTONOMOUS-LOG.md', line);
console.log(line.trim());
