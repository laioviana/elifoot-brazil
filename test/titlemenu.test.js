'use strict';
// Garante o alinhamento dos botões do menu da tela de título (#42).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');

const i = css.indexOf('\n.menu .row {');
assert(i >= 0, 'regra .menu .row deve existir');
const regra = css.slice(i, css.indexOf('}', i));
assert(regra.includes('justify-content: center'), '.menu .row centraliza os botões');

const b = css.indexOf('\n.menu button {');
assert(b >= 0 && css.slice(b, css.indexOf('}', b)).includes('min-width: 240px'), 'botões do menu mantêm a mesma largura');

const ini = src.indexOf('function title()');
const fim = src.indexOf('function drawTitle()');
assert(ini >= 0 && fim > ini, 'title() e drawTitle() devem existir');
const t = src.slice(ini, fim);
const m = t.indexOf('<div class="menu">');
const r = t.indexOf('<div class="row">');
assert(m >= 0 && r > m, 'a .row fica dentro do .menu');
assert(t.slice(r).includes("'lang'") && t.slice(r).includes("'mute'"), 'botões lang e mute na .row');

console.log('titlemenu.test.js ok');
