// review-comment.js REVIEW_JSON RODADA MAX TESTS_RC SAIDA_MD
// Valida o veredito do agente de revisão, grava o comentário do PR em SAIDA_MD e imprime APPROVE ou CHANGES.
const fs = require('fs');
const [file, round, max, testsRc, outMd] = process.argv.slice(2);
let r;
try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { process.exit(1); }
if (!r || !['APPROVE', 'CHANGES'].includes(r.verdict) || !Array.isArray(r.findings || [])) process.exit(1);
const findings = r.findings || [];
const icon = { blocker: '🛑', major: '⚠️', minor: '💡' };
const testsOk = Number(testsRc) === 0;
const verdict = r.verdict === 'APPROVE' && testsOk ? 'APPROVE' : 'CHANGES';
const lines = [
  `## 🔎 Revisão do agente (rodada ${round} de ${max}): ${verdict === 'APPROVE' ? '✅ aprovado' : '🔁 mudanças pedidas'}`,
  '',
  `\`npm test\`: ${testsOk ? '✅ passou' : '❌ falhou'}`,
  '',
  r.summary || '',
  ''
];
if (findings.length) {
  lines.push('| | Arquivo | Achado |', '| --- | --- | --- |');
  for (const f of findings) {
    const where = f.file ? `\`${f.file}${f.line ? ':' + f.line : ''}\`` : '';
    const msg = String(f.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${icon[f.severity] || '•'} ${f.severity || ''} | ${where} | ${msg} |`);
  }
}
fs.writeFileSync(outMd, lines.join('\n') + '\n');
console.log(verdict);
