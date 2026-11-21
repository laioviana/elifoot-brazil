/* Teste do desgaste físico proporcional aos minutos jogados (issue #5). */
const assert = require('assert');
const E = require('../js/engine.js');

let seed = 777;
E.rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const G = E.newGame();
G.mgr.name = 'Teste';
E.takeTeam(G, G.teams.find(t => t.div === 3).id);
const ms = E.startRound(G, true);
const m = ms.find(x => x.user >= 0), s = m.user;
const T = E.userTeam(G);

// sem simular (lesões/cartões aleatórios tornariam o teste instável): relógio ajustado à mão
const starters = m.on[s].filter(p => p.pos !== 'G');
const [full, vet, offAt45, sentOff] = starters;
vet.age = 33;
const bench = E.bench(G, m, s);
const [subIn, unused] = bench;
for (const p of T.players) p.fit = 50;

m.min = 30;
const i = m.on[s].indexOf(sentOff);
m.on[s].splice(i, 1); m.span[s][sentOff.id].to = m.min; // mesmo efeito de uma expulsão em E.step
m.min = 45;
assert(E.sub(G, m, s, offAt45.id, subIn.id));
for (const x of ms) { x.min = 90; x.done = true; }

assert.strictEqual(E.minutesPlayed(m, s, full.id), 90);
assert.strictEqual(E.minutesPlayed(m, s, offAt45.id), 45);
assert.strictEqual(E.minutesPlayed(m, s, subIn.id), 45);
assert.strictEqual(E.minutesPlayed(m, s, sentOff.id), 30);
assert.strictEqual(E.minutesPlayed(m, s, unused.id), 0);

E.finishRound(G, ms);
// custo aplicado e depois +9 de recuperação
assert.strictEqual(full.fit, 50 - 11 + 9, 'titular 90 min');
assert.strictEqual(vet.fit, 50 - 14 + 9, 'titular >30 anos 90 min');
assert.strictEqual(offAt45.fit, 50 - 6 + 9, 'substituído aos 45');
assert.strictEqual(subIn.fit, 50 - 6 + 9, 'entrou aos 45');
assert.strictEqual(sentOff.fit, 50 - 4 + 9, 'saiu aos 30');
assert.strictEqual(unused.fit, 50 + 9, 'não jogou');

// entrada aos 60: 30 minutos -> round(11 * 30 / 90) = 4
const ms2 = E.startRound(G, true);
const m2 = ms2.find(x => x.user >= 0);
const out2 = m2.on[s].find(p => p.pos !== 'G'), in2 = E.bench(G, m2, s)[0];
out2.age = in2.age = 25;
for (const p of T.players) p.fit = 60;
m2.min = 60;
assert(E.sub(G, m2, s, out2.id, in2.id));
for (const x of ms2) { x.min = 90; x.done = true; }
E.finishRound(G, ms2);
assert.strictEqual(in2.fit, 60 - 4 + 9, 'entrou aos 60');
assert.strictEqual(out2.fit, 60 - 7 + 9, 'saiu aos 60');
assert.strictEqual(E.minutesPlayed(m2, s, in2.id), 30);

console.log('fatigue.test.js ok');
