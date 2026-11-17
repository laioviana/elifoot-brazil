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
(async () => {
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
