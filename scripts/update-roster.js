#!/usr/bin/env node
/* Atualiza js/roster.js com elencos reais da API-Football (https://www.api-football.com).
 *
 *   API_FOOTBALL_KEY=xxxx node scripts/update-roster.js [--season 2026] [--dry]
 *
 * Custo: 4 chamadas de times (uma por divisão) + 1 por clube (~84/rodada; o plano grátis permite 100/dia).
 * Só nome, posição e idade são usados — a força dos jogadores segue a força do clube em js/data.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/data.js');

const API = 'https://v3.football.api-sports.io';
const LEAGUES = [71, 72, 75, 76]; // Brasileirão Séries A, B, C, D
const POS = { Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Attacker: 'A' };
// Nomes da API que não casam com o nome do clube em data.js depois de normalizar.
const ALIAS = {
  'red bull bragantino': 'Bragantino', 'athletico paranaense': 'Athletico-PR', 'atletico mineiro': 'Atlético-MG',
  'vasco da gama': 'Vasco', 'atletico goianiense': 'Atlético-GO', 'operario': 'Operário-PR', 'ec vitoria': 'Vitória',
  'sport recife': 'Sport', 'ceara': 'Ceará', 'botafogo sp': 'Botafogo-SP', 'botafogo pb': 'Botafogo-PB',
  'america mg': 'América-MG', 'america rn': 'América-RN', 'athletic club': 'Athletic-MG', 'barra fc': 'Barra-SC',
  'sao bernardo': 'São Bernardo', 'inter de limeira': 'Inter de Limeira', 'maranhao': 'Maranhão'
};

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(fc|ec|sc|ac|ca|esporte clube|futebol clube)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function matcher() {
  const byNorm = new Map();
  D.CLUBS.forEach((list, div) => list.forEach(c => byNorm.set(norm(c[0]), { name: c[0], div })));
  for (const [k, v] of Object.entries(ALIAS)) byNorm.set(norm(k), byNorm.get(norm(v)) || { name: v });
  return apiName => byNorm.get(norm(apiName));
}

function squadFromApi(players) {
  return players.filter(p => p.name && POS[p.position]).map(p => [p.name.trim(), POS[p.position], p.age || 25])
    .sort((a, b) => 'GDMA'.indexOf(a[1]) - 'GDMA'.indexOf(b[1]) || a[0].localeCompare(b[0]));
}

async function build(get, season, log = console.log) {
  const match = matcher();
  const roster = {}, missing = new Set(D.CLUBS.flat().map(c => c[0]));
  for (const league of LEAGUES) {
    const teams = (await get(`/teams?league=${league}&season=${season}`)).response || [];
    for (const { team } of teams) {
      const club = match(team.name);
      if (!club || !missing.has(club.name)) { log(`  ? sem correspondência: ${team.name} (liga ${league})`); continue; }
      const res = (await get(`/players/squads?team=${team.id}`)).response || [];
      const squad = squadFromApi((res[0] && res[0].players) || []);
      if (squad.length < 16) { log(`  ! elenco pequeno demais para ${club.name} (${squad.length}); mantendo nomes gerados`); continue; }
      roster[club.name] = squad; missing.delete(club.name);
    }
  }
  return { roster, missing: [...missing] };
}

function render(roster) {
  const body = Object.keys(roster).sort((a, b) => a.localeCompare(b)).map(k =>
    `    ${JSON.stringify(k)}: [\n` + roster[k].map(p => `      ${JSON.stringify(p)}`).join(',\n') + '\n    ]').join(',\n');
  return `/* Prancheta 8-Bit — elencos reais (gerado por scripts/update-roster.js; não edite à mão)
   Formato: { "Clube": [[nome, posição G|D|M|A, idade], ...] }. Clube ausente = jogadores gerados. */
(function (root) {
  'use strict';
  const ROSTER = {
${body}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ROSTER;
  root.PB_ROSTER = ROSTER;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

async function main() {
  const args = process.argv.slice(2);
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) { console.error('Defina API_FOOTBALL_KEY.'); process.exit(1); }
  const season = Number((args[args.indexOf('--season') + 1]) || new Date().getFullYear());
  const get = async p => {
    const res = await fetch(API + p, { headers: { 'x-apisports-key': key } });
    if (!res.ok) throw new Error(`API ${res.status} em ${p}`);
    const j = await res.json();
    const errs = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors));
    if (errs && errs.length) throw new Error(`API: ${JSON.stringify(j.errors)}`);
    return j;
  };
  const { roster, missing } = await build(get, season);
  console.log(`${Object.keys(roster).length} clubes atualizados; ${missing.length} sem elenco real: ${missing.join(', ') || '-'}`);
  // Segurança: se quase nada veio, não sobrescreve um arquivo bom.
  if (Object.keys(roster).length < 40) { console.error('Poucos clubes retornados; abortando sem gravar.'); process.exit(2); }
  // Clubes que a API não devolveu agora mantêm o elenco anterior.
  const prev = require('../js/roster.js');
  for (const k of Object.keys(prev)) if (!roster[k] && D.CLUBS.flat().some(c => c[0] === k)) roster[k] = prev[k];
  if (!args.includes('--dry')) fs.writeFileSync(path.join(__dirname, '../js/roster.js'), render(roster));
}

module.exports = { norm, matcher, squadFromApi, build, render };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
