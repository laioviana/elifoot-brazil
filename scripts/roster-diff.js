#!/usr/bin/env node
/* Resumo do que mudou entre dois js/roster.js: node scripts/roster-diff.js antigo.js novo.js */
'use strict';
const [a, b] = process.argv.slice(2).map(f => require(require('path').resolve(f)));
const names = c => new Set((c || []).map(p => p[0]));
let changed = 0, added = 0, removed = 0;
const lines = [];
for (const club of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
  const x = names(a[club]), y = names(b[club]);
  const plus = [...y].filter(n => !x.has(n)).length, minus = [...x].filter(n => !y.has(n)).length;
  if (!a[club] && b[club]) { lines.push(`  + ${club}: novo (${y.size} jogadores)`); changed++; added += y.size; }
  else if (plus || minus) { lines.push(`  ~ ${club}: +${plus} / -${minus}`); changed++; added += plus; removed += minus; }
}
console.log(`${changed} clubes mudaram (+${added} jogadores, -${removed}):`);
console.log(lines.slice(0, 40).join('\n') + (lines.length > 40 ? `\n  ... e mais ${lines.length - 40}` : ''));
