/* Prancheta 8-Bit — elencos reais (gerado por scripts/update-roster.js; não edite à mão)
   Formato: { "Clube": [[nome, posição G|D|M|A, idade], ...] }. Vazio = jogadores gerados. */
(function (root) {
  'use strict';
  const ROSTER = {};
  if (typeof module !== 'undefined' && module.exports) module.exports = ROSTER;
  root.PB_ROSTER = ROSTER;
})(typeof window !== 'undefined' ? window : globalThis);
