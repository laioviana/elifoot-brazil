/* Teste headless: simula várias temporadas e verifica invariantes do motor. */
const assert = require('assert');
const E = require('../js/engine.js');

let seed = 12345;
E.rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const G = E.newGame();
G.mgr.name = 'Teste';
assert.strictEqual(G.teams.length, 80);
E.takeTeam(G, G.teams.find(t => t.div === 3).id);
const verbose = process.argv.includes('-v');

for (let season = 0; season < 6; season++) {
  let goals = 0, games = 0;
  const cash0 = E.userTeam(G).cash;
  while (!G.seasonOver) {
    if (G.pending) E.takeTeam(G, G.pending.offers[0]);
    while (G.offers.length) E.answerOffer(G, false);
    const ms = E.startRound(G, true);
    assert.strictEqual(ms.length, 40);
    E.playAll(G, ms);
    for (const m of ms) { goals += m.sc[0] + m.sc[1]; games++; assert(m.on[0].length <= 11 && m.on[1].length <= 11); }
    E.finishRound(G, ms);
  }
  const avg = goals / games;
  assert(avg > 2 && avg < 3.4, 'gols por jogo fora do esperado: ' + avg);
  for (let d = 0; d < 4; d++) {
    const tab = E.table(G, d);
    assert.strictEqual(tab.length, 20);
    for (const t of tab) assert.strictEqual(t.st.p, 38);
    assert.strictEqual(tab.reduce((s, t) => s + t.st.gf - t.st.ga, 0), 0);
  }
  const U = E.userTeam(G);
  if (verbose) {
    console.log(`\n== ${G.season} == gols/jogo ${avg.toFixed(2)} | ${U.name} (div ${U.div}) pos ${E.position(G, U.id)} esp ${G.mgr.exp} conf ${G.mgr.conf.toFixed(0)} caixa ${E.money(cash0)} -> ${E.money(U.cash)}`);
    for (let d = 0; d < 4; d++) { const t = E.table(G, d); console.log(` ${E.DIVS[d].name}: 1º ${t[0].name} ${t[0].st.pts}pts (${E.rating(t[0]).toFixed(0)}) ... 20º ${t[19].name} ${t[19].st.pts}pts (${E.rating(t[19]).toFixed(0)}) | artilheiro ${E.scorers(G, d, 1)[0].p.g}`); }
  }
  const sum = E.endSeason(G);
  assert.strictEqual(sum.divs.length, 4);
  for (let d = 0; d < 4; d++) assert.strictEqual(G.teams.filter(t => t.div === d).length, 20);
  for (const t of G.teams) {
    assert(t.players.length >= 18 && t.players.length <= E.MAX_SQUAD, t.name + ' elenco ' + t.players.length);
    assert(t.players.filter(p => p.pos === 'G').length >= 2);
  }
  if (G.pending) G.pending = null;
  JSON.parse(JSON.stringify(G)); // precisa ser serializável
}
if (verbose) console.log('\nmédia de força por divisão:', [0, 1, 2, 3].map(d => (G.teams.filter(t => t.div === d).reduce((s, t) => s + E.rating(t), 0) / 20).toFixed(1)).join(' / '));
console.log('OK — 6 temporadas simuladas');
