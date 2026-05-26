#!/usr/bin/env node
import { appendFileSync } from 'fs';

const TOKEN = process.env.GITHUB_PAT;
const PRs = [
  { repo: 'mahseema/awesome-ai-tools', n: 1354 },
  { repo: 'steven2358/awesome-generative-ai', n: 768 },
  { repo: 'punkpeye/awesome-mcp-servers', n: 6894 },
];

let new_comments = 0;
const lines = [];
for (const p of PRs) {
  const r = await fetch(`https://api.github.com/repos/${p.repo}/issues/${p.n}/comments`, {
    headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json' },
  });
  const j = await r.json().catch(() => []);
  const count = Array.isArray(j) ? j.length : 0;
  lines.push(`  ${p.repo}#${p.n} comments=${count}`);
  // For now just log; future: alert on new comment from non-Maxime8123 author
}
const line = `- ${new Date().toISOString()} · PR monitor\n${lines.join('\n')}\n`;
appendFileSync('AUTONOMOUS-LOG.md', line);
console.log(line.trim());
