/* Teste da ordenação por posição (G, D, M, A) e força decrescente. */
const assert = require('assert');
const E = require('../js/engine.js');

const list = [
  { id: 1, pos: 'A', str: 70 }, { id: 2, pos: 'G', str: 60 }, { id: 3, pos: 'M', str: 55 },
  { id: 4, pos: 'D', str: 80 }, { id: 5, pos: 'M', str: 75 }, { id: 6, pos: 'D', str: 65 },
  { id: 7, pos: 'A', str: 85 }, { id: 8, pos: 'G', str: 62 }
];
const sorted = list.slice().sort(E.byPos);
assert.deepStrictEqual(sorted.map(p => p.id), [8, 2, 4, 6, 5, 3, 7, 1]);
console.log('order.test.js ok');
