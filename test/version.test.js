'use strict';
// Versão do jogo: fonte única, tela de título e script de bump.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const V = require('../js/version.js');
assert(/^\d+\.\d+\.\d+$/.test(V), 'versão SemVer');
assert.strictEqual(V, require('../package.json').version, 'package.json igual a js/version.js');
assert.strictEqual(require('../js/engine.js').VERSION, V, 'E.VERSION');

const html = read('index.html');
assert(html.indexOf('js/version.js') >= 0 && html.indexOf('js/version.js') < html.indexOf('js/engine.js'), 'version.js antes do engine.js');

const ui = read('js/ui.js');
const titulo = ui.slice(ui.indexOf('function title()'), ui.indexOf('function drawTitle()'));
assert(titulo.includes('class="version"') && titulo.includes('${E.VERSION}'), 'linha de versão no título');
assert(titulo.indexOf('class="version"') > titulo.indexOf('class="credit"'), 'versão depois do crédito');

const { bump, releaseChangelog, setVersion } = require('../scripts/bump-version.js');
assert.strictEqual(bump('1.0.0', 'patch'), '1.0.1');
assert.strictEqual(bump('1.0.9', 'patch'), '1.0.10');
assert.strictEqual(bump('1.2.3', 'minor'), '1.3.0');
assert.strictEqual(bump('1.2.3', 'major'), '2.0.0');
assert.throws(() => bump('1.0', 'patch'));
assert.throws(() => bump('1.0.0', 'huge'));

const cl = '# Changelog\n\n## Unreleased\n- Algo novo.\n\n## 1.0.0 — 2026-11-22\n- Antes.\n';
const out = releaseChangelog(cl, '1.0.1', '2026-11-22', 'FALLBACK');
assert(/## Unreleased\n\n## 1\.0\.1 — 2026-11-22\n- Algo novo\.\n\n## 1\.0\.0 — 2026-11-22\n- Antes\.\n$/.test(out), out);
assert(!out.includes('FALLBACK'), 'fallback não usado');
const vazio = '# C\n\n## Unreleased\n\n## 1.0.0 — 2026-11-22\n- Antes.\n';
assert(releaseChangelog(vazio, '1.0.1', '2026-11-22', 'Meu commit').includes('## 1.0.1 — 2026-11-22\n- Meu commit\n'));
assert(releaseChangelog(vazio, '1.0.1', '2026-11-22', '').includes('- Maintenance.'));
assert(releaseChangelog(vazio, '1.0.1', '2026-11-22', 'x').endsWith('## 1.0.0 — 2026-11-22\n- Antes.\n'), 'seções antigas intactas');
assert.throws(() => releaseChangelog('# C\n', '1.0.1', '2026-11-22', 'x'));

assert.strictEqual(JSON.parse(setVersion(read('package.json'), 'package.json', '9.8.7')).version, '9.8.7');
assert(setVersion(read('js/version.js'), 'js/version.js', '9.8.7').includes("const VERSION = '9.8.7';"));
assert.throws(() => setVersion('{}', 'package.json', '1.0.1'));
assert.throws(() => setVersion('x', 'js/version.js', '1.0.1'));

assert(read('CHANGELOG.md').includes('## Unreleased'));
assert.doesNotThrow(() => releaseChangelog(read('CHANGELOG.md'), '1.0.1', '2026-11-22', 'x'));

console.log('version.test.js ok');
