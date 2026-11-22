'use strict';
// Garante que o crédito do autor aparece na tela de título.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
const ini = src.indexOf('function title()');
const fim = src.indexOf('function drawTitle()');
assert(ini >= 0 && fim > ini, 'title() e drawTitle() devem existir');
const titulo = src.slice(ini, fim);

assert(titulo.includes('class="credit"'), 'rodapé de crédito dentro de title()');
assert(titulo.includes('href="https://x.com/laioviana"'), 'link para o autor');
const a = titulo.match(/<a [^>]*href="https:\/\/x\.com\/laioviana"[^>]*>/);
assert(a, 'tag <a> do autor');
assert(a[0].includes('target="_blank"'), 'abre em nova aba');
assert(a[0].includes('rel="noopener noreferrer"'), 'rel seguro');
assert(!a[0].includes('data-a'), 'sem data-a para o handler global ignorar');
assert(/L\('Escalado, treinado e apitado por', 'Picked, coached and refereed by'\)/.test(titulo), 'texto bilíngue');

console.log('credits.test.js ok');
