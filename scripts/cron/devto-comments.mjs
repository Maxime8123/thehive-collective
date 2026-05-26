#!/usr/bin/env node
import { appendFileSync } from 'fs';

// List dev.to articles, then fetch comments per article.
const r = await fetch('https://dev.to/api/articles?username=the-hive-collective&per_page=20');
const articles = await r.json().catch(() => []);

const lines = [];
let total = 0;
for (const a of articles) {
  if (a.comments_count > 0) {
    const cr = await fetch(`https://dev.to/api/comments?a_id=${a.id}`);
    const cs = await cr.json().catch(() => []);
    const flat = Array.isArray(cs) ? cs : [];
    total += flat.length;
    if (flat.length > 0) lines.push(`  "${a.title.slice(0, 50)}..." → ${flat.length} comments`);
  }
}
const line = `- ${new Date().toISOString()} · devto comments total=${total}\n${lines.join('\n')}\n`;
appendFileSync('AUTONOMOUS-LOG.md', line);
console.log(line.trim());
