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

// "PRESS START" aparece uma única vez, acima do menu.
assert.strictEqual(titulo.split('▼ PRESS START ▼').length - 1, 1, 'PRESS START uma única vez');
assert(titulo.indexOf('▼ PRESS START ▼') < titulo.indexOf('<div class="menu">'), 'PRESS START acima do menu');

// Rodapé no fim da página: último filho de .title, depois da descrição.
assert(titulo.indexOf('<footer class="credit"') > titulo.lastIndexOf('<p'), 'crédito depois da descrição');
assert(/<\/footer>\s*<\/div>`;/.test(titulo), 'só o </div> de .title depois do rodapé');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
const regra = sel => {
  const ini = css.indexOf('\n' + sel + ' {');
  assert(ini >= 0, 'regra ' + sel);
  return css.slice(ini, css.indexOf('}', ini));
};
assert(regra('.credit').includes('margin-top: auto'), '.credit empurrado para o fim');
const t = regra('.title');
assert(t.includes('display: flex') && t.includes('flex-direction: column') && /min-height:[^;]*100vh/.test(t), '.title coluna com altura mínima');
assert(/padding-bottom/.test(regra('#app:has(> .title)')), 'padding-bottom reduzido na tela de título');

console.log('credits.test.js ok');
