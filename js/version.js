/* Prancheta 8-Bit — versão do jogo (atualizada só por scripts/bump-version.js) */
(function (root) {
  'use strict';
  const VERSION = '1.0.0';
  root.PB_VERSION = VERSION;
  if (typeof module !== 'undefined' && module.exports) module.exports = VERSION;
})(typeof window !== 'undefined' ? window : globalThis);
