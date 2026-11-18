/* Fonte Transfermarkt para scripts/update-roster.js.
 *
 * AVISO: o Transfermarkt não tem API pública e seus termos de uso proíbem acesso automatizado. Este módulo
 * é opcional, de uso por sua conta e risco. Para ser o menos intrusivo possível ele: se identifica com um
 * User-Agent honesto, respeita o robots.txt, espera entre as requisições e PARA se for bloqueado (403/429)
 * — não tenta contornar bloqueios. O HTML é interpretado por regex; se o site mudar o layout, o parser
 * precisa de ajuste (os testes usam um HTML de exemplo escrito de memória, não uma cópia da página real).
 */
'use strict';

const BASE = 'https://www.transfermarkt.com';
// código da competição no Transfermarkt; a Série D pode não existir lá (então simplesmente não retorna clubes)
const LEAGUES = ['BRA1', 'BRA2', 'BRA3', 'BRA4'];

const decode = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();

// robots.txt: regras do "User-agent: *"; suporta prefixo, '*' e '$'.
function parseRobots(txt) {
  const rules = []; let applies = false, seenAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...v] = line.split(':'); const key = k.trim().toLowerCase(), val = v.join(':').trim();
    if (key === 'user-agent') { if (seenAgent && rules.length && !applies) { /* novo grupo */ } applies = val === '*'; seenAgent = true; }
    else if (applies && (key === 'disallow' || key === 'allow') && val) rules.push({ allow: key === 'allow', val });
  }
  return rules;
}
function allowed(rules, path) {
  const re = v => new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  let best = null;
  for (const r of rules) if (re(r.val).test(path) && (!best || r.val.length > best.val.length || (r.val.length === best.val.length && r.allow))) best = r;
  return !best || best.allow;
}

// Página da liga -> [{ id, name }]
function parseClubs(html) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*>/g)) {
    const id = /\/startseite\/verein\/(\d+)/.exec(m[0]), title = /\btitle="([^"]+)"/.exec(m[0]);
    if (id && title && !out.has(id[1])) out.set(id[1], decode(title[1]));
  }
  return [...out].map(([id, name]) => ({ id, name }));
}

// Página do elenco (visão detalhada "plus/1") -> [{ name, position, age }]
function parseSquad(html) {
  const players = [];
  for (const m of html.matchAll(/<tr class="(?:odd|even)"[^>]*>([\s\S]*?)(?=<tr class="(?:odd|even)"|<\/tbody>)/g)) {
    const row = m[1];
    const name = /<td class="hauptlink"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/.exec(row);
    const pos = /<table class="inline-table">[\s\S]*?<\/tr>\s*<tr>\s*<td>([^<]+)<\/td>/.exec(row);
    const age = /\d{1,2}\/\d{1,2}\/\d{4}\s*\((\d{1,2})\)/.exec(row);
    if (name && pos) players.push({ name: decode(name[1]), position: decode(pos[1]), age: age ? +age[1] : null });
  }
  return players;
}

// Resumo do que veio na página, para diagnosticar quando o parser não encontra jogadores.
function describe(html) {
  const c = re => (html.match(re) || []).length;
  const row = /<tr class="(?:odd|even)"[^>]*>[\s\S]{0,1200}/.exec(html);
  const title = /<title>([^<]*)<\/title>/i.exec(html);
  return [`${html.length} bytes; título: ${title ? decode(title[1]).slice(0, 80) : '(sem título)'}`,
    `class="items": ${c(/class="items"/g)}; linhas odd/even: ${c(/<tr class="(?:odd|even)"/g)}; hauptlink: ${c(/class="hauptlink/g)}; ` +
    `inline-table: ${c(/inline-table/g)}; "profil/spieler": ${c(/profil\/spieler/g)}; consentimento/captcha: ${c(/consent|captcha|cf-chl|challenge/gi)}`,
    row ? 'primeira linha: ' + row[0].replace(/\s+/g, ' ').slice(0, 900) : 'nenhuma linha odd/even encontrada'].join('\n    ');
}
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

// `get(path)` devolve o HTML (ou lança Error com .status). `deps` traz as funções do update-roster.
async function buildTransfermarkt(get, deps, { season = new Date().getFullYear(), delayMs = 4000, log = console.log } = {}) {
  const { matcher, wdPos, gameName, norm, MIN_REAL, MAX_REAL } = deps;
  const exact = matcher(), roster = {};
  // nome exato/alias; senão, clube do jogo cujas palavras estão todas no nome do Transfermarkt (só se for único)
  const match = name => {
    const hit = exact(name); if (hit) return hit;
    const words = new Set(norm(name).split(' '));
    const found = deps.allClubs().filter(c => {
      const w = norm(c.replace(/-[A-Z]{2}$/, '')).split(' ').filter(Boolean);
      return w.length && w.every(x => words.has(x));
    });
    const longest = Math.max(0, ...found.map(c => norm(c).split(' ').length));
    const top = found.filter(c => norm(c).split(' ').length === longest);
    return top.length === 1 ? { name: top[0] } : undefined;
  };
  const robots = parseRobots(await get('/robots.txt').catch(() => ''));
  const fetchPage = async path => {
    if (!allowed(robots, path)) throw new Error(`robots.txt do Transfermarkt não permite ${path}; abortando`);
    await sleep(delayMs);
    return get(path);
  };
  let debugged = false, fails = 0;
  for (const code of LEAGUES) {
    let clubs = [];
    try { clubs = parseClubs(await fetchPage(`/-/startseite/wettbewerb/${code}/plus/?saison_id=${season}`)); }
    catch (e) { if (e.status === 403 || e.status === 429 || /robots/.test(e.message)) throw e; log(`  ! liga ${code}: ${e.message}`); continue; }
    log(`  ${code}: ${clubs.length} clubes`);
    for (const c of clubs) {
      const club = match(c.name);
      if (!club) { log(`  ? sem correspondência: ${c.name} (${code})`); continue; }
      if (roster[club.name]) continue;
      let squad, html;
      try { html = await fetchPage(`/-/kader/verein/${c.id}/saison_id/${season}/plus/1`); squad = parseSquad(html); }
      catch (e) { if (e.status === 403 || e.status === 429 || /robots/.test(e.message)) throw e; log(`  ! ${club.name}: ${e.message}`); continue; }
      const rows = squad.filter(p => wdPos(p.position)).map(p => [gameName(p.name, ''), wdPos(p.position), p.age || 25]).slice(0, MAX_REAL);
      if (rows.length < MIN_REAL) {
        log(`  ! ${club.name}: só ${rows.length} jogadores lidos (layout mudou?)`);
        if (!debugged && html) {
          debugged = true;
          const file = deps.saveDebug ? deps.saveDebug(`${c.id}.html`, html) : null;
          log(`    diagnóstico da página /kader/verein/${c.id}:\n    ${describe(html)}` + (file ? `\n    HTML completo salvo em ${file}` : ''));
        }
        if (++fails >= 3) throw new Error('o parser não achou jogadores em 3 clubes seguidos; abortando para não sobrecarregar o site');
        continue;
      }
      fails = 0;
      roster[club.name] = rows.sort((a, b) => 'GDMA'.indexOf(a[1]) - 'GDMA'.indexOf(b[1]) || a[0].localeCompare(b[0]));
      log(`  ${club.name}: ${rows.length} jogadores`);
    }
  }
  return { roster, missing: deps.allClubs().filter(n => !roster[n]) };
}

module.exports = { describe, buildTransfermarkt, parseClubs, parseSquad, parseRobots, allowed };
