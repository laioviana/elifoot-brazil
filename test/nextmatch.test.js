'use strict';
// Próximo jogo do usuário: adversário e a posição dele na tabela.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');

let seed = 777;
E.rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const G = E.newGame();
G.mgr.name = 'Teste';
E.takeTeam(G, G.teams.find(t => t.div === 3).id);
const div = E.userTeam(G).div;

function confere() {
  const m = E.nextMatch(G);
  assert(m, 'há próximo jogo');
  assert.notStrictEqual(m.opp.id, G.mgr.team);
  assert.strictEqual(m.opp.div, div);
  assert.strictEqual(m.pos, E.table(G, div).findIndex(t => t.id === m.opp.id) + 1);
  assert(m.pos >= 1 && m.pos <= 20);
  return m;
}

const m0 = confere();
const f0 = G.fix[div][0].find(f => f[0] === G.mgr.team || f[1] === G.mgr.team);
assert.strictEqual(m0.home, f0[0] === G.mgr.team);

function jogaRodada() {
  if (G.pending) E.takeTeam(G, G.pending.offers[0]);
  while (G.offers.length) E.answerOffer(G, false);
  const ms = E.startRound(G, true);
  E.playAll(G, ms);
  E.finishRound(G, ms);
}
for (let i = 0; i < 5; i++) { jogaRodada(); confere(); }
while (!G.seasonOver) jogaRodada();
assert.strictEqual(E.nextMatch(G), null);

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
const ini = src.indexOf('function hub()');
assert(ini >= 0, 'hub() deve existir');
const hub = src.slice(ini, ini + 1200);
assert(hub.includes('E.nextMatch(G)'), 'hub usa E.nextMatch');
assert(/<span class="nx">[^`]*\(\$\{m\.pos\}º\)/.test(hub), 'posição dentro do span.nx');

console.log('nextmatch.test.js ok');
