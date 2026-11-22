#!/usr/bin/env node
'use strict';
// Sobe a versão do jogo (SemVer), fecha o CHANGELOG e, opcionalmente, faz commit + tag locais.
// Uso: node scripts/bump-version.js <patch|minor|major> [--fallback "<texto>"] [--no-git]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function bump(version, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!m) throw new Error('Versão inválida: ' + version);
  let maj = +m[1], min = +m[2], pat = +m[3];
  if (kind === 'patch') pat++;
  else if (kind === 'minor') { min++; pat = 0; }
  else if (kind === 'major') { maj++; min = 0; pat = 0; }
  else throw new Error('Tipo inválido: ' + kind);
  return maj + '.' + min + '.' + pat;
}

function releaseChangelog(text, version, date, fallback) {
  const m = /^## Unreleased[ \t]*$/m.exec(text);
  if (!m) throw new Error('CHANGELOG sem "## Unreleased"');
  const resto = text.slice(m.index + m[0].length);
  const prox = /^## /m.exec(resto);
  const fim = prox ? prox.index : resto.length;
  let corpo = resto.slice(0, fim).trim();
  if (!/^- /m.test(corpo)) corpo = '- ' + (fallback || 'Maintenance.');
  const depois = resto.slice(fim);
  return text.slice(0, m.index) + '## Unreleased\n\n## ' + version + ' — ' + date + '\n' + corpo + '\n' +
    (depois ? '\n' + depois : '');
}

function setVersion(text, file, version) {
  const re = file === 'package.json' ? /("version"\s*:\s*")\d+\.\d+\.\d+(")/ : /(const VERSION = ')\d+\.\d+\.\d+(';)/;
  if (!re.test(text)) throw new Error('Padrão de versão não encontrado em ' + file);
  return text.replace(re, (_, a, b) => a + version + b);
}

function main(argv) {
  const kind = argv[0];
  const noGit = argv.includes('--no-git');
  const fi = argv.indexOf('--fallback');
  const fallback = fi >= 0 ? argv[fi + 1] || '' : '';
  const f = p => path.join(ROOT, p);
  const verFile = fs.readFileSync(f('js/version.js'), 'utf8');
  const atual = /const VERSION = '(\d+\.\d+\.\d+)';/.exec(verFile);
  if (!atual) throw new Error('Versão atual não encontrada em js/version.js');
  const nova = bump(atual[1], kind);
  if (!noGit && execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()) {
    throw new Error('Árvore de trabalho suja: faça commit ou stash antes.');
  }
  const data = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(f('js/version.js'), setVersion(verFile, 'js/version.js', nova));
  fs.writeFileSync(f('package.json'), setVersion(fs.readFileSync(f('package.json'), 'utf8'), 'package.json', nova));
  fs.writeFileSync(f('CHANGELOG.md'), releaseChangelog(fs.readFileSync(f('CHANGELOG.md'), 'utf8'), nova, data, fallback));
  if (!noGit) {
    const git = args => execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' });
    git(['add', 'js/version.js', 'package.json', 'CHANGELOG.md']);
    git(['commit', '-m', 'Release v' + nova]);
    git(['tag', '-a', 'v' + nova, '-m', 'v' + nova]);
  }
  console.log(nova);
  if (!noGit) console.log('Agora rode: git push --follow-tags origin main');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('Erro: ' + e.message); process.exit(1); }
}

module.exports = { bump, releaseChangelog, setVersion };
