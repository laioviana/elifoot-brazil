#!/usr/bin/env node
/* Atualiza js/roster.js com elencos reais.
 *
 *   [FOOTBALL_DATA_TOKEN=xxxx] node scripts/update-roster.js [--dry]   (padrão: --source auto)
 *     auto = Wikidata (todas as divisões) + football-data.org (Série A, se houver token grátis)
 *   node scripts/update-roster.js --source wikidata [--dry]
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
  'mineiro': 'Atlético-MG', 'paranaense': 'Athletico-PR', 'clube do remo': 'Remo', 'sao bernardo': 'São Bernardo', 'inter de limeira': 'Inter de Limeira', 'maranhao': 'Maranhão'
};

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(fc|ec|sc|ac|ca|esporte clube|futebol clube)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function matcher() {
  const byNorm = new Map();
  D.CLUBS.forEach((list, div) => list.forEach(c => byNorm.set(norm(c[0]), { name: c[0], div })));
  for (const [k, v] of Object.entries(ALIAS)) byNorm.set(norm(k), byNorm.get(norm(v)) || { name: v });
  const byAbbr = new Map();
  D.CLUBS.forEach((list, div) => list.forEach(c => byAbbr.set(c[1].toLowerCase(), { name: c[0], div })));
  return apiName => byNorm.get(norm(apiName)) || byAbbr.get(String(apiName).trim().toLowerCase());
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
const playersQuery = ids => `SELECT ?club ?p ?pt ?en ?nick ?dob ?posl ?start WHERE {
  VALUES ?club { ${ids.map(i => 'wd:' + i).join(' ')} }
  ?p p:P54 ?st. ?st ps:P54 ?club.
  FILTER NOT EXISTS { ?st pq:P582 ?end }
  FILTER NOT EXISTS { ?p wdt:P570 ?died }
  OPTIONAL { ?st pq:P580 ?start }
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
  if (/back|defen[cs]e|sweeper/.test(l)) return 'D';
  if (/midfield|playmaker/.test(l)) return 'M';
  if (/forward|striker|winger|attack|offence/.test(l)) return 'A';
  return null;
};
const MAX_REAL = 30; // elenco máximo importado por clube
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
    // "justeza": quanto do rótulo é o nome do clube (Amazonas FC > Manaus Futebol Clube para "Amazonas")
    const fit = w => {
      let best = 0;
      for (const t of [w.label, w.label2, ...w.alts]) {
        const tw = norm(t || '').split(' ').filter(Boolean);
        if (tw.length && words.every(x => tw.includes(x))) best = Math.max(best, words.length / tw.length);
      }
      return best;
    };
    let list = wdClubs.filter(w => fit(w) > 0 && (!w.uf || w.uf === c[2]));
    if (!list.length) { // a UF da Wikidata pode estar ausente ou errada: tenta só pelo nome
      list = wdClubs.filter(w => fit(w) > 0);
      if (list.length) log(`  ~ ${c[0]}: nenhum clube em ${c[2]}; tentando por nome em outros estados`);
    }
    out.set(c[0], list.map(w => ({ id: w.id, fit: fit(w) })));
  });
  return out;
}

async function buildWikidata(query, now = new Date(), log = console.log, { recentYears = 4 } = {}) {
  const wdClubs = (await query(CLUBS_QUERY)).results.bindings.map(b => ({
    id: qid(b.club.value), label: b.label && b.label.value, label2: b.label2 && b.label2.value,
    alts: b.alts && b.alts.value ? b.alts.value.split('|') : [], uf: b.iso && b.iso.value.slice(3)
  }));
  const byClub = new Map(); // clube -> Map(jogador -> dados)
  const cand = candidates(wdClubs, log), roster = {}, missing = [];
  const wanted = [...new Set([...cand.values()].flat().map(c => c.id))];
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
    const e = m.get(id) || { label: null, nick: null, dob: null, pos: null, start: null };
    e.label = e.label || (b.pt || b.en || {}).value;
    e.nick = e.nick || (b.nick && b.nick.value);
    e.dob = e.dob || (b.dob && b.dob.value);
    e.pos = e.pos || (b.posl && wdPos(b.posl.value));
    if (b.start && (!e.start || b.start.value > e.start)) e.start = b.start.value;
    m.set(id, e);
  }
  // vínculos sem data de fim e com início antigo quase sempre são ex-jogadores: só vale quem entrou recentemente
  const cutoff = new Date(now.getTime() - recentYears * 365.25 * 864e5).toISOString();
  const size = id => [...(byClub.get(id) || new Map()).values()].filter(e => e.start && e.start >= cutoff).length;
  const ranked = new Map([...cand].map(([name, list]) => [name, list.slice().sort((x, y) => size(y.id) - size(x.id))]));
  // cada clube da Wikidata serve a um só clube do jogo; em conflito vence o rótulo mais justo ao nome
  const banned = new Map([...ranked.keys()].map(k => [k, new Set()]));
  const choice = name => ranked.get(name).find(x => !banned.get(name).has(x.id));
  for (let i = 0; i < 10; i++) {
    const owners = new Map(); let conflict = false;
    for (const name of ranked.keys()) {
      const c = choice(name); if (!c) continue;
      const cur = owners.get(c.id);
      if (!cur) { owners.set(c.id, { name, fit: c.fit }); continue; }
      conflict = true;
      if (c.fit > cur.fit) { banned.get(cur.name).add(c.id); owners.set(c.id, { name, fit: c.fit }); } else banned.get(name).add(c.id);
    }
    if (!conflict) break;
  }
  for (const name of ranked.keys()) {
    const avail = ranked.get(name).filter(x => !banned.get(name).has(x.id));
    const best = avail[0];
    if (!best) { missing.push(name); log(`  ! ${name}: nenhum clube correspondente na Wikidata`); continue; }
    const n = size(best.id);
    if (n < MIN_REAL) { missing.push(name); log(`  ! ${name}: só ${n} jogadores recentes (últimos ${recentYears} anos) na Wikidata (${best.id})`); continue; }
    if (avail[1] && size(avail[1].id) >= n / 2) log(`  ? ${name}: ambíguo entre ${best.id} (${n}) e ${avail[1].id} (${size(avail[1].id)}); usando o primeiro`);
    // a Wikidata raramente encerra vínculos antigos: fica quem entrou mais recentemente (sem data = mais antigo)
    const list2 = [...byClub.get(best.id).values()].filter(e => e.label)
      .map(e => ({ ...e, age: e.dob ? ageOf(e.dob, now) : 25 })).filter(e => e.age <= 40)
      .filter(e => e.start && e.start >= cutoff)
      .sort((a, b) => (b.start || '').localeCompare(a.start || '')).slice(0, MAX_REAL);
    if (n > MAX_REAL) log(`  i ${name}: ${n} vínculos recentes; mantidos os ${list2.length} mais novos`);
    let rr = 0; const fill = ['D', 'M', 'A'];
    const squad = list2.map(e => [gameName(e.label, e.nick), e.pos || fill[rr++ % 3], e.age]);
    roster[name] = squad.sort((a, b) => 'GDMA'.indexOf(a[1]) - 'GDMA'.indexOf(b[1]) || a[0].localeCompare(b[0]));
  }
  return { roster, missing };
}

/* ---------- football-data.org (plano grátis: Série A) ---------- */
const FD_API = 'https://api.football-data.org/v4';
async function buildFootballData(get, now = new Date(), log = console.log) {
  const match = matcher(), roster = {};
  const teams = ((await get('/competitions/BSA/teams')).teams) || [];
  for (const t of teams) {
    const club = [t.shortName, t.name, t.tla].map(x => x && match(x)).find(Boolean);
    if (!club) { log(`  ? football-data: sem correspondência para ${t.name}`); continue; }
    const squad = (t.squad || []).filter(x => x.name && wdPos(x.position))
      .map(x => [gameName(x.name, ''), wdPos(x.position), x.dateOfBirth ? ageOf(x.dateOfBirth, now) : 25]);
    if (squad.length < MIN_REAL) { log(`  ! football-data: ${club.name} veio com ${squad.length} jogadores`); continue; }
    roster[club.name] = squad.sort((a, b) => 'GDMA'.indexOf(a[1]) - 'GDMA'.indexOf(b[1]) || a[0].localeCompare(b[0]));
  }
  return { roster, missing: [] };
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
  const source = opt('--source', 'auto');
  const UA = 'prancheta-8bit-roster/1.0 (open-source game roster updater)';
  const sleep = s => new Promise(ok => setTimeout(ok, s * 1000));
  // GET/POST com novas tentativas em erros temporários
  const http = async (label, url, init) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url, init);
        if (r.ok) return await r.json();
        if (![429, 500, 502, 503, 504].includes(r.status) || attempt >= 4) throw new Error(`${label} ${r.status}`);
        const wait = Number(r.headers.get('retry-after')) || 10 * attempt;
        console.log(`  ${label} ${r.status}; tentando de novo em ${wait}s (${attempt}/4)`);
        await sleep(wait);
      } catch (e) {
        if (e.message.startsWith(label) || attempt >= 4) throw e;
        console.log(`  erro de rede (${e.message}); tentando de novo (${attempt}/4)`);
        await sleep(5 * attempt);
      }
    }
  };
  const wikidata = () => buildWikidata(q => http('Wikidata', SPARQL, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: 'format=json&query=' + encodeURIComponent(q)
  }));
  const footballData = () => buildFootballData(p => http('football-data.org', FD_API + p, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN, 'User-Agent': UA }
  }));
  const apiFootball = () => {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) { console.error('Defina API_FOOTBALL_KEY.'); process.exit(1); }
    return build(async p => {
      const j = await http('API-Football', API + p, { headers: { 'x-apisports-key': key } });
      const errs = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors));
      if (errs && errs.length) throw new Error(`API: ${JSON.stringify(j.errors)}`);
      return j;
    }, Number(opt('--season', new Date().getFullYear())));
  };

  let res, minClubs = 20;
  if (source === 'wikidata') res = await wikidata();
  else if (source === 'apifootball') { res = await apiFootball(); minClubs = 40; }
  else if (source === 'auto') {
    // Wikidata para tudo; football-data.org (se houver token) sobrescreve a Série A com dados mais confiáveis.
    res = await wikidata();
    if (process.env.FOOTBALL_DATA_TOKEN) {
      const fd = await footballData();
      console.log(`football-data.org: ${Object.keys(fd.roster).length} clubes da Série A`);
      Object.assign(res.roster, fd.roster);
      res.missing = res.missing.filter(n => !res.roster[n]);
    } else console.log('FOOTBALL_DATA_TOKEN não definido: Série A virá só da Wikidata.');
  } else { console.error('--source: auto | wikidata | apifootball'); process.exit(1); }

  const { roster, missing } = res;
  console.log(`${Object.keys(roster).length} clubes atualizados; ${missing.length} sem elenco real: ${missing.join(', ') || '-'}`);
  // Segurança: se quase nada veio, não sobrescreve um arquivo bom.
  if (Object.keys(roster).length < minClubs) { console.error('Poucos clubes retornados; abortando sem gravar.'); process.exit(2); }
  // Clubes que a fonte não devolveu agora mantêm o elenco anterior.
  const prev = require('../js/roster.js');
  for (const k of Object.keys(prev)) if (!roster[k] && D.CLUBS.flat().some(c => c[0] === k)) roster[k] = prev[k];
  if (!args.includes('--dry')) fs.writeFileSync(path.join(__dirname, '../js/roster.js'), render(roster));
}

module.exports = { norm, matcher, squadFromApi, build, buildWikidata, buildFootballData, gameName, render };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
