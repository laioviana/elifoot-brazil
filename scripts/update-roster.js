#!/usr/bin/env node
/* Atualiza js/roster.js com elencos reais.
 *
 *   node scripts/update-roster.js [--source wikidata] [--dry]        (padrão; grátis, sem chave)
 *   API_FOOTBALL_KEY=xxxx node scripts/update-roster.js --source apifootball [--season 2026] [--dry]
 *
 * Wikidata: 2 consultas SPARQL (clubes e jogadores atuais). Boa cobertura na Série A/B, irregular na C/D.
 * API-Football: ~84 chamadas por rodada; a temporada atual exige plano pago.
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

/* ---------- Wikidata ---------- */
const SPARQL = 'https://query.wikidata.org/sparql';
const CLUBS_QUERY = `SELECT ?club (SAMPLE(?l) AS ?label) (SAMPLE(?l2) AS ?label2) (GROUP_CONCAT(DISTINCT ?a; separator="|") AS ?alts) (SAMPLE(?i) AS ?iso) WHERE {
  ?club wdt:P31 wd:Q476028; wdt:P17 wd:Q155.
  OPTIONAL { ?club rdfs:label ?l. FILTER(LANG(?l) = "pt") }
  OPTIONAL { ?club rdfs:label ?l2. FILTER(LANG(?l2) = "en") }
  OPTIONAL { ?club skos:altLabel ?a. FILTER(LANG(?a) IN ("pt", "en")) }
  OPTIONAL { ?club wdt:P159/wdt:P131* ?s. ?s wdt:P300 ?i. FILTER(STRSTARTS(?i, "BR-")) }
} GROUP BY ?club`;
// Só os clubes pedidos, em lotes pequenos, para não estourar o tempo limite do serviço.
const playersQuery = ids => `SELECT ?club ?p ?pt ?en ?nick ?dob ?posl WHERE {
  VALUES ?club { ${ids.map(i => 'wd:' + i).join(' ')} }
  ?p p:P54 ?st. ?st ps:P54 ?club.
  FILTER NOT EXISTS { ?st pq:P582 ?end }
  FILTER NOT EXISTS { ?p wdt:P570 ?died }
  OPTIONAL { ?p rdfs:label ?pt. FILTER(LANG(?pt) = "pt") }
  OPTIONAL { ?p rdfs:label ?en. FILTER(LANG(?en) = "en") }
  OPTIONAL { ?p wdt:P1449 ?nick }
  OPTIONAL { ?p wdt:P569 ?dob }
  OPTIONAL { ?p wdt:P413 ?pos. ?pos rdfs:label ?posl. FILTER(LANG(?posl) = "en") }
}`;
// Posição da Wikidata (rótulo em inglês, ex.: "centre-back", "left winger") -> G/D/M/A
const wdPos = l => {
  l = (l || '').toLowerCase();
  if (/goalkeeper/.test(l)) return 'G';
  if (/back|defender|sweeper/.test(l)) return 'D';
  if (/midfield|playmaker/.test(l)) return 'M';
  if (/forward|striker|winger|attacker/.test(l)) return 'A';
  return null;
};
const MIN_REAL = 11; // abaixo disso o clube fica com nomes gerados
const qid = u => u.slice(u.lastIndexOf('/') + 1);

// Nome de jogo: apelido (P1449) se houver; senão o rótulo, encurtado para "Primeiro Último" quando longo.
function gameName(label, nick) {
  const clean = x => (x || '').replace(/\s+/g, ' ').trim();
  nick = clean(nick); label = clean(label);
  if (nick && nick.length <= 18) return nick;
  const w = label.split(' ');
  if (w.length <= 3) return label;
  return `${w[0]} ${w[w.length - 1]}`;
}
const ageOf = (dob, now) => {
  const d = new Date(dob);
  if (isNaN(d)) return 25;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--;
  return Math.max(16, Math.min(41, age));
};

// Clubes da Wikidata que correspondem a cada clube do jogo: todas as palavras do nome no rótulo/apelidos e
// UF igual (quando a Wikidata informa). O desempate é feito depois, pelo nº de jogadores atuais.
function candidates(wdClubs, log = () => {}) {
  const out = new Map();
  D.CLUBS.flat().forEach(c => {
    const words = norm(c[0].replace(/-[A-Z]{2}$/, '')).split(' ').filter(Boolean);
    const byName = w => [w.label, w.label2, ...w.alts].some(t => { const n = ` ${norm(t || '')} `; return words.every(x => n.includes(` ${x} `)); });
    let list = wdClubs.filter(w => byName(w) && (!w.uf || w.uf === c[2]));
    if (!list.length) { // a UF da Wikidata pode estar ausente ou errada: tenta só pelo nome
      list = wdClubs.filter(byName);
      if (list.length) log(`  ~ ${c[0]}: nenhum clube em ${c[2]}; tentando por nome em outros estados`);
    }
    out.set(c[0], list.map(w => w.id));
  });
  return out;
}

async function buildWikidata(query, now = new Date(), log = console.log) {
  const wdClubs = (await query(CLUBS_QUERY)).results.bindings.map(b => ({
    id: qid(b.club.value), label: b.label && b.label.value, label2: b.label2 && b.label2.value,
    alts: b.alts && b.alts.value ? b.alts.value.split('|') : [], uf: b.iso && b.iso.value.slice(3)
  }));
  const byClub = new Map(); // clube -> Map(jogador -> dados)
  const cand = candidates(wdClubs, log), roster = {}, missing = [];
  const wanted = [...new Set([...cand.values()].flat())];
  log(`  ${wdClubs.length} clubes brasileiros na Wikidata; buscando jogadores de ${wanted.length}...`);
  const rows = [];
  for (let i = 0; i < wanted.length; i += 8) {
    rows.push(...(await query(playersQuery(wanted.slice(i, i + 8)))).results.bindings);
    log(`  jogadores: ${Math.min(i + 8, wanted.length)}/${wanted.length} clubes`);
  }
  for (const b of rows) {
    const club = qid(b.club.value), id = qid(b.p.value);
    if (!byClub.has(club)) byClub.set(club, new Map());
    const m = byClub.get(club);
    const e = m.get(id) || { label: null, nick: null, dob: null, pos: null };
    e.label = e.label || (b.pt || b.en || {}).value;
    e.nick = e.nick || (b.nick && b.nick.value);
    e.dob = e.dob || (b.dob && b.dob.value);
    e.pos = e.pos || (b.posl && wdPos(b.posl.value));
    m.set(id, e);
  }
  for (const [name, ids] of cand) {
    const ranked = ids.map(id => ({ id, n: (byClub.get(id) || new Map()).size })).sort((a, b) => b.n - a.n);
    const best = ranked[0];
    if (!best) { missing.push(name); log(`  ! ${name}: nenhum clube correspondente na Wikidata`); continue; }
    if (best.n < MIN_REAL) { missing.push(name); log(`  ! ${name}: só ${best.n} jogadores na Wikidata (${best.id})`); continue; }
    if (ranked[1] && ranked[1].n >= best.n / 2) log(`  ? ${name}: ambíguo entre ${ranked[0].id} (${best.n}) e ${ranked[1].id} (${ranked[1].n}); usando o primeiro`);
    const list = [...byClub.get(best.id).values()].filter(e => e.label);
    // posição ausente: distribui entre D/M/A para não zerar nenhuma linha
    let rr = 0; const fill = ['D', 'M', 'A'];
    const squad = list.map(e => [gameName(e.label, e.nick), e.pos || fill[rr++ % 3], e.dob ? ageOf(e.dob, now) : 25]);
    roster[name] = squad.sort((a, b) => 'GDMA'.indexOf(a[1]) - 'GDMA'.indexOf(b[1]) || a[0].localeCompare(b[0])).slice(0, 40);
  }
  return { roster, missing };
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
  const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const source = opt('--source', 'wikidata');
  let res, minClubs;
  if (source === 'wikidata') {
    const query = async q => {
      for (let attempt = 1; ; attempt++) {
        try {
          const r = await fetch(SPARQL, {
            method: 'POST',
            headers: {
              Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'prancheta-8bit-roster/1.0 (open-source game roster updater)'
            },
            body: 'format=json&query=' + encodeURIComponent(q)
          });
          if (r.ok) return await r.json();
          if (![429, 500, 502, 503, 504].includes(r.status) || attempt >= 4) throw new Error(`Wikidata ${r.status}`);
          const wait = Number(r.headers.get('retry-after')) || 5 * attempt;
          console.log(`  Wikidata ${r.status}; tentando de novo em ${wait}s (${attempt}/4)`);
          await new Promise(ok => setTimeout(ok, wait * 1000));
        } catch (e) {
          if (/^Wikidata/.test(e.message) || attempt >= 4) throw e;
          console.log(`  erro de rede (${e.message}); tentando de novo (${attempt}/4)`);
          await new Promise(ok => setTimeout(ok, 5000 * attempt));
        }
      }
    };
    res = await buildWikidata(query); minClubs = 20;
  } else if (source === 'apifootball') {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) { console.error('Defina API_FOOTBALL_KEY.'); process.exit(1); }
    const get = async p => {
      const r = await fetch(API + p, { headers: { 'x-apisports-key': key } });
      if (!r.ok) throw new Error(`API ${r.status} em ${p}`);
      const j = await r.json();
      const errs = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors));
      if (errs && errs.length) throw new Error(`API: ${JSON.stringify(j.errors)}`);
      return j;
    };
    res = await build(get, Number(opt('--season', new Date().getFullYear()))); minClubs = 40;
  } else { console.error('--source deve ser wikidata ou apifootball'); process.exit(1); }
  const { roster, missing } = res;
  console.log(`${Object.keys(roster).length} clubes atualizados; ${missing.length} sem elenco real: ${missing.join(', ') || '-'}`);
  // Segurança: se quase nada veio, não sobrescreve um arquivo bom.
  if (Object.keys(roster).length < minClubs) { console.error('Poucos clubes retornados; abortando sem gravar.'); process.exit(2); }
  // Clubes que a fonte não devolveu agora mantêm o elenco anterior.
  const prev = require('../js/roster.js');
  for (const k of Object.keys(prev)) if (!roster[k] && D.CLUBS.flat().some(c => c[0] === k)) roster[k] = prev[k];
  if (!args.includes('--dry')) fs.writeFileSync(path.join(__dirname, '../js/roster.js'), render(roster));
}

module.exports = { norm, matcher, squadFromApi, build, buildWikidata, gameName, render };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
