// Comando de status line usado só pela checagem de uso: grava rate_limits num arquivo quando aparecer.
const fs = require('fs');
let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(raw);
    if (j.rate_limits) fs.writeFileSync(process.argv[2], JSON.stringify(j.rate_limits));
  } catch (e) { /* ignora */ }
  process.stdout.write('usage-check');
});
