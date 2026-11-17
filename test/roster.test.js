/* Testa o pipeline de elencos reais com uma API falsa e o uso deles pelo motor. */
const assert = require('assert');
const vm = require('vm');
const U = require('../scripts/update-roster.js');
const D = require('../js/data.js');

// 1) correspondência de nomes
const m = U.matcher();
assert.strictEqual(m('Red Bull Bragantino').name, 'Bragantino');
assert.strictEqual(m('Athletico Paranaense').name, 'Athletico-PR');
assert.strictEqual(m('Atletico-MG').name, 'Atlético-MG');
assert.strictEqual(m('Sao Paulo').name, 'São Paulo');
assert.strictEqual(m('Ceará SC').name, 'Ceará');
assert.strictEqual(m('CA Mineiro').name, 'Atlético-MG');
assert.strictEqual(m('CA Paranaense').name, 'Athletico-PR');
assert.strictEqual(m('Clube do Remo').name, 'Remo');
assert.strictEqual(m('REM').name, 'Remo'); // pela sigla
assert.strictEqual(m('Clube Inexistente'), undefined);

// 2) API falsa -> roster -> arquivo gerado -> motor
const fakeSquad = tag => ({ response: [{ players: [
  ...[1, 2].map(i => ({ name: `Goleiro ${tag}${i}`, age: 30, position: 'Goalkeeper' })),
  ...[1, 2, 3, 4, 5, 6, 7].map(i => ({ name: `Zagueiro ${tag}${i}`, age: 27, position: 'Defender' })),
  ...[1, 2, 3, 4, 5, 6].map(i => ({ name: `Meia ${tag}${i}`, age: 24, position: 'Midfielder' })),
  ...[1, 2, 3, 4].map(i => ({ name: `Atacante ${tag}${i}`, age: 21, position: 'Attacker' })),
  { name: 'Técnico X', age: 50, position: 'Coach' }] }] });
const apiNames = { 71: ['Flamengo', 'Red Bull Bragantino'], 72: ['Ceará SC'], 75: [], 76: ['Tombense'] };
const get = async p => {
  let x;
  if ((x = /league=(\d+)/.exec(p))) return { response: apiNames[x[1]].map((n, i) => ({ team: { id: x[1] * 10 + i, name: n } })) };
  const id = Number(/team=(\d+)/.exec(p)[1]);
  return fakeSquad(id);
};
// 1b) Wikidata: consultas falsas
const wdBind = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
const Q = id => 'http://www.wikidata.org/entity/' + id;
const mkPlayers = (club, n, tag) => Array.from({ length: n }, (_, i) => wdBind({
  club: Q(club), p: Q(`P${club}${i}`), pt: `Fulano Beltrano de Tal ${tag}${i}`, dob: '2000-06-15T00:00:00Z', start: '2025-01-01T00:00:00Z',
  posl: ['goalkeeper', 'centre-back', 'attacking midfielder', 'left winger'][i % 4]
}));
const fakeQuery = async q => q.includes('GROUP BY') ? { results: { bindings: [
  wdBind({ club: Q('Q1'), label: 'Clube de Regatas do Flamengo', alts: 'Flamengo|CR Flamengo', iso: 'BR-RJ' }),
  wdBind({ club: Q('Q2'), label: 'Flamengo de Guarulhos', alts: '', iso: 'BR-SP' }),
  wdBind({ club: Q('Q3'), label: 'Atlético Clube Goianiense', alts: '', iso: 'BR-GO' }),
  wdBind({ club: Q('Q4'), label: 'Clube Atlético Mineiro', alts: 'Atlético Mineiro', iso: 'BR-MG' }),
  wdBind({ club: Q('Q5'), label: 'Botafogo', alts: '', iso: 'BR-RJ' })
] } } : { results: { bindings: [
  ...mkPlayers('Q1', 24, 'F'), ...mkPlayers('Q2', 20, 'G'), ...mkPlayers('Q3', 18, 'H'), ...mkPlayers('Q4', 20, 'M'), ...mkPlayers('Q5', 5, 'B'),
  wdBind({ club: Q('Q4'), p: Q('P-nick'), pt: 'Gabriel Barbosa Almeida Silva', nick: 'Gabigol', posl: 'striker', start: '2025-01-01T00:00:00Z' })
].filter(b => q.includes('wd:' + b.club.value.split('/').pop() + ' ') || q.includes('wd:' + b.club.value.split('/').pop() + ' }')) } };
assert.strictEqual(U.gameName('Gabriel Barbosa de Almeida', ''), 'Gabriel Almeida');
assert.strictEqual(U.gameName('Pedro Lima', ''), 'Pedro Lima');
assert.strictEqual(U.gameName('Gabriel Barbosa Almeida', 'Gabigol'), 'Gabigol');

// 1c) football-data.org
const fdGet = async () => ({ teams: [
  { name: 'CR Flamengo', shortName: 'Flamengo', tla: 'FLA', squad: [
    ...Array.from({ length: 24 }, (_, i) => ({ name: `Jogador ${i}`, position: ['Goalkeeper', 'Defence', 'Midfield', 'Offence'][i % 4], dateOfBirth: '1999-03-01' })),
    { name: 'Sem Posição', position: null, dateOfBirth: '1990-01-01' }] },
  { name: 'Red Bull Bragantino', shortName: 'RB Bragantino', tla: 'RBB', squad: [] },
  { name: 'Time Desconhecido', shortName: 'XYZ', tla: 'XYZ', squad: [] }
] });

(async () => {
  const fd = await U.buildFootballData(fdGet, new Date('2026-06-15'), () => {});
  assert.deepStrictEqual(Object.keys(fd.roster), ['Flamengo']);       // Bragantino: elenco vazio; desconhecido ignorado
  assert.strictEqual(fd.roster.Flamengo.length, 24);                  // sem posição descartado
  assert.deepStrictEqual(fd.roster.Flamengo.map(p => p[1]).filter((x, i, a) => a.indexOf(x) === i), ['G', 'D', 'M', 'A']);
  const wd = await U.buildWikidata(fakeQuery, new Date('2026-06-15'), () => {});
  assert.deepStrictEqual(Object.keys(wd.roster).sort(), ['Atlético-GO', 'Atlético-MG', 'Flamengo']);
  assert.strictEqual(wd.roster.Flamengo.length, 24);  // escolheu o clube maior, não o homônimo de SP
  assert(wd.roster.Flamengo.every(p => p[2] === 26 && 'GDMA'.includes(p[1])));
  assert(wd.roster['Atlético-MG'].some(p => p[0] === 'Gabigol' && p[1] === 'A'));
  assert(wd.missing.includes('Botafogo'));            // 5 jogadores < 11

  // elenco com vínculos antigos: mantém só os 30 mais recentes e ninguém acima de 40 anos
  const stale = (club, n) => Array.from({ length: n }, (_, i) => wdBind({
    club: Q(club), p: Q(`S${i}`), pt: `Jogador ${i}`, dob: i === 0 ? '1970-01-01T00:00:00Z' : '2000-01-01T00:00:00Z',
    posl: 'centre-back', start: `${2000 + (i % 25)}-01-01T00:00:00Z`
  }));
  const staleQ = async q => q.includes('GROUP BY')
    ? { results: { bindings: [wdBind({ club: Q('Q9'), label: 'Esporte Clube Bahia', alts: '', iso: 'BR-BA' })] } }
    : { results: { bindings: stale('Q9', 100) } };
  const st = await U.buildWikidata(staleQ, new Date('2026-06-15'), () => {}, { recentYears: 30 });
  assert.strictEqual(st.roster.Bahia.length, 30);
  const st4 = await U.buildWikidata(staleQ, new Date('2026-06-15'), () => {}); // padrão: 4 anos
  assert(!st4.roster.Bahia && st4.missing.includes('Bahia'));  // vínculos de 2000-2024 são considerados velhos
  assert(!st.roster.Bahia.some(p => p[2] > 40));

  // um clube da Wikidata não pode servir a dois clubes do jogo (Amazonas x Manaus)
  const dupQ = async q => q.includes('GROUP BY')
    ? { results: { bindings: [wdBind({ club: Q('Q7'), label: 'Amazonas Futebol Clube', alts: 'Manaus', iso: 'BR-AM' })] } }
    : { results: { bindings: stale('Q7', 20) } };
  const dup = await U.buildWikidata(dupQ, new Date('2026-06-15'), () => {}, { recentYears: 30 });
  assert(dup.roster.Amazonas && !dup.roster.Manaus && dup.missing.includes('Manaus'));
  const { roster, missing } = await U.build(get, 2026, () => {});
  assert.deepStrictEqual(Object.keys(roster).sort(), ['Bragantino', 'Ceará', 'Flamengo', 'Tombense']);
  assert.strictEqual(missing.length, 80 - 4);
  assert.strictEqual(roster.Flamengo.length, 19); // treinador descartado
  const src = U.render(roster);
  const sandbox = { module: undefined }; sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  assert.strictEqual(JSON.stringify(sandbox.PB_ROSTER.Flamengo), JSON.stringify(roster.Flamengo));

  // 3) o motor usa nomes reais onde existem e gera o resto
  const ROSTER = require('../js/roster.js');
  Object.assign(ROSTER, roster);
  const E = require('../js/engine.js');
  const G = E.newGame();
  const fla = G.teams.find(t => t.name === 'Flamengo');
  assert(fla.players.filter(p => p.real).length === 19);
  assert(fla.players.some(p => p.n === 'Goleiro 7101' || p.n.startsWith('Goleiro')));
  const palm = G.teams.find(t => t.name === 'Palmeiras');
  assert(palm.players.length >= 20 && !palm.players.some(p => p.real));
  console.log('roster ok');
})().catch(e => { console.error(e); process.exit(1); });
