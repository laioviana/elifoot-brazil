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

// Plano B para páginas que listam os clubes sem o atributo title (ex.: divisões menores): usa o texto do link.
function parseClubsByText(html) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const id = /\/(?:startseite|spielplan|kader)\/verein\/(\d+)/.exec(m[1]);
    const text = decode(m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
    if (id && text && text.length > 1 && !out.has(id[1])) out.set(id[1], text);
  }
  return [...out].map(([id, name]) => ({ id, name }));
}

// Valor de mercado do Transfermarkt ("€1.50m", "€800k", "€1,2 mio.", "1.500 Th. €", "-") -> euros (0 se ausente)
function parseValue(s) {
  s = decode(String(s || '').replace(/<[^>]*>/g, ' ')).toLowerCase().replace(/\s+/g, ' ');
  const m = /(\d+(?:[.,]\d+)*)\s*(bn|mrd\.?|m|mio\.?|k|th\.?|tsd\.?)?/.exec(s);
  if (!m) return 0;
  let num = m[1];
  // "1.500" (milhar europeu) vs "1.50" (decimal): 3 dígitos após o último separador = milhar
  if (/^\d{1,3}([.,]\d{3})+$/.test(num) && !m[2]) num = num.replace(/[.,]/g, '');
  else num = num.replace(/[.,](?=\d{3}(?:[.,]|$))/g, '').replace(',', '.');
  const mult = { bn: 1e9, mrd: 1e9, m: 1e6, mio: 1e6, k: 1e3, th: 1e3, tsd: 1e3 }[(m[2] || '').replace('.', '')] || 1;
  const v = Math.round(parseFloat(num) * mult);
  return isFinite(v) && v > 0 ? v : 0;
}

// Página do elenco (visão detalhada "plus/1") -> [{ name, position, age, value }]
function parseSquad(html) {
  const players = [];
  for (const m of html.matchAll(/<tr class="(?:odd|even)"[^>]*>([\s\S]*?)(?=<tr class="(?:odd|even)"|<\/tbody>)/g)) {
    const row = m[1];
    const name = /<td class="hauptlink"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/.exec(row);
    const pos = /<table class="inline-table">[\s\S]*?<\/tr>\s*<tr>\s*<td>([^<]+)<\/td>/.exec(row);
    const age = /\d{1,2}\/\d{1,2}\/\d{4}\s*\((\d{1,2})\)/.exec(row);
    const mv = /<td class="rechts hauptlink[^"]*"[^>]*>([\s\S]*?)<\/td>/.exec(row);
    if (name && pos) players.push({ name: decode(name[1]), position: decode(pos[1]), age: age ? +age[1] : null, value: mv ? parseValue(mv[1]) : 0 });
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
// Divisão do jogo (0=A ... 3=D) de cada código de competição do Transfermarkt.
const DIV_OF = { BRA1: 0, BRA2: 1, BRA3: 2, BRA4: 3 };
const uf2 = n => { const m = /\s*\(([A-Z]{2})\)\s*$/.exec(n); return m ? m[1] : null; };

/* Associa clubes do Transfermarkt a clubes do jogo.
 * tmClubs: [{ id, name, div }]  info: [{ name, uf, div }]  exact(name) -> { name } | undefined (nome/alias/sigla)
 * Regras: UF "(RJ)" no nome tem de bater; a divisão tem de estar a no máximo 1 de distância; nome exato vale
 * mais que "contém as palavras"; empate = ambíguo -> não associa (melhor sem elenco que com o elenco errado). */
function resolveClubs(tmClubs, info, { exact, norm, log = () => {} }) {
  const words = n => norm(n).split(' ').filter(Boolean);
  const claims = new Map(); // nome do jogo -> [{ tm, key }]
  for (const tm of tmClubs) {
    const uf = uf2(tm.name), nm = tm.name.replace(/\s*\([A-Z]{2}\)\s*$/, '');
    const ex = exact(nm), tw = new Set(words(nm));
    const cands = [];
    for (const g of info) {
      if (uf && uf !== g.uf) continue;
      const dd = tm.div == null || g.div == null ? 0 : Math.abs(tm.div - g.div);
      if (dd > 1) continue;
      const gw = words(g.name.replace(/-[A-Z]{2}$/, ''));
      const score = ex && ex.name === g.name ? 3 : (gw.length && gw.every(x => tw.has(x)) ? 1 : 0);
      if (score) cands.push({ g, key: score * 10 - dd * 3 + (uf ? 5 : 0) });
    }
    cands.sort((x, y) => y.key - x.key);
    if (!cands.length) { tm.unmatched = true; continue; }
    if (cands[1] && cands[1].key === cands[0].key) { log(`  ~ ${tm.name}: ambíguo entre ${cands[0].g.name} e ${cands[1].g.name}; ignorado`); continue; }
    (claims.get(cands[0].g.name) || claims.set(cands[0].g.name, []).get(cands[0].g.name)).push({ tm, key: cands[0].key });
  }
  const out = new Map();
  for (const [name, list] of claims) {
    list.sort((x, y) => y.key - x.key);
    if (list[1] && list[1].key === list[0].key) { log(`  ~ ${name}: ${list.map(x => x.tm.name).join(' e ')} disputam o mesmo clube; ignorado`); continue; }
    if (list[1]) log(`  = ${name}: usando "${list[0].tm.name}", ignorando "${list.slice(1).map(x => x.tm.name).join('", "')}"`);
    out.set(name, list[0].tm);
  }
  return out;
}

async function buildTransfermarkt(get, deps, { season = null, leagues = LEAGUES, delayMs = 4000, log = console.log } = {}) {
  // sem `season`, o Transfermarkt usa a temporada atual dele (a numeração dos clubes brasileiros não é o ano civil)
  const { matcher, wdPos, gameName, norm, MIN_REAL, MAX_REAL } = deps;
  const info = deps.clubInfo ? deps.clubInfo() : deps.allClubs().map(name => ({ name, uf: null, div: null }));
  const roster = {};
  const robots = parseRobots(await get('/robots.txt').catch(() => ''));
  const fetchPage = async path => {
    if (!allowed(robots, path)) throw new Error(`robots.txt do Transfermarkt não permite ${path}; abortando`);
    await sleep(delayMs);
    const html = await get(path);
    // corpo vazio com status 200 é como o site barra robôs (ex.: runners do GitHub): para na primeira vez
    if (typeof html === 'string' && !html.trim()) throw Object.assign(new Error(`resposta vazia em ${path} (provável bloqueio de robôs)`), { status: 403 });
    return html;
  };
  let debugged = false, fails = 0;
  const titleOf = html => { const t = /<title>([^<]*)<\/title>/i.exec(html); return t ? decode(t[1]).replace(/\s*\|\s*Transfermarkt.*/, '') : '?'; };
  // Séries A/B são competições de "liga" no Transfermarkt; C/D são do tipo "copa" (pokalwettbewerb), cujos clubes
  // ficam na página de participantes. Tenta a de liga e, se não achar clubes, a de participantes.
  const clubPages = code => [
    `/-/startseite/wettbewerb/${code}/plus/${season ? `?saison_id=${season}` : ''}`,
    `/-/teilnehmer/pokalwettbewerb/${code}${season ? `/saison_id/${season}` : ''}`
  ];

  // 1) clubes de cada competição
  const tmClubs = [];
  for (const code of leagues) {
    let clubs = [];
    const pages = clubPages(code);
    for (let i = 0; i < pages.length && !clubs.length; i++) {
      let html;
      try { html = await fetchPage(pages[i]); }
      catch (e) {
        if (e.status === 403 || e.status === 429 || (i === 0 && /robots/.test(e.message))) throw e; // bloqueio: para tudo
        log(`  ! ${code} (${pages[i]}): ${e.message}`); continue;
      }
      clubs = parseClubs(html);
      if (!clubs.length) clubs = parseClubsByText(html);
      log(`  ${code}: ${titleOf(html)}${i ? ' [página de participantes]' : ''} -> ${clubs.length} clubes`);
      if (!clubs.length && i === pages.length - 1) {
        const n = re => (html.match(re) || []).length;
        const file = deps.saveDebug ? deps.saveDebug(`liga-${code}.html`, html) : null;
        log(`  ! ${code}: nenhum clube encontrado. ${html.length} bytes; links /verein/: ${n(/\/verein\/\d+/g)}; ` +
          `startseite/verein: ${n(/startseite\/verein\/\d+/g)}; title=: ${n(/\btitle="/g)}; class="items": ${n(/class="items"/g)}` + (file ? `\n    HTML salvo em ${file}` : ''));
      }
    }
    for (const c of clubs) if (!tmClubs.some(x => x.id === c.id)) tmClubs.push({ ...c, code, div: DIV_OF[code] ?? null });
  }

  // 2) quais clubes do Transfermarkt são quais clubes do jogo
  const assigned = resolveClubs(tmClubs, info, { exact: matcher(), norm, log });
  // ids fixados à mão (scripts/transfermarkt-ids.json) valem mais que a associação por nome e servem também
  // para clubes que não aparecem nas listas das divisões A-D do Transfermarkt
  for (const [name, id] of Object.entries(deps.idOverrides || {})) {
    if (!info.some(g => g.name === name)) { log(`  ! transfermarkt-ids.json: clube desconhecido "${name}"`); continue; }
    for (const [k, v] of assigned) if (String(v.id) === String(id) && k !== name) assigned.delete(k);
    assigned.set(name, { id: String(id), name: `id ${id}` });
  }
  const unmatched = tmClubs.filter(c => c.unmatched);
  const important = unmatched.filter(c => c.div != null && c.div <= 2);
  if (important.length) log(`  ? sem correspondência no jogo (divisões A-C): ${important.map(c => c.name).join('; ')}`);
  if (unmatched.length > important.length) log(`  (${unmatched.length - important.length} clubes da Série D não fazem parte do jogo)`);

  // 3) elencos
  for (const [name, c] of assigned) {
    let squad, html;
    try { html = await fetchPage(`/-/kader/verein/${c.id}/${season ? `saison_id/${season}/` : ''}plus/1`); squad = parseSquad(html); }
    catch (e) { if (e.status === 403 || e.status === 429 || /robots/.test(e.message)) throw e; log(`  ! ${name}: ${e.message}`); continue; }
    const dropped = squad.filter(p => !wdPos(p.position));
    if (dropped.length) log(`  i ${name}: ${dropped.length} jogadores sem posição reconhecida (${[...new Set(dropped.map(p => p.position || '(vazio)'))].join(', ')})`);
    const rows = squad.filter(p => wdPos(p.position)).map(p => [gameName(p.name, ''), wdPos(p.position), p.age || 25, p.value || 0]).slice(0, MAX_REAL);
    if (rows.length < MIN_REAL) {
      log(`  ! ${name} (${c.name}): só ${rows.length} jogadores lidos`);
      if (!debugged && html && rows.length === 0) {
        debugged = true;
        const file = deps.saveDebug ? deps.saveDebug(`${c.id}.html`, html) : null;
        log(`    diagnóstico da página /kader/verein/${c.id}:\n    ${describe(html)}` + (file ? `\n    HTML completo salvo em ${file}` : ''));
      }
      if (rows.length === 0 && ++fails >= 3) throw new Error('o parser não achou jogadores em 3 clubes seguidos; abortando para não sobrecarregar o site');
      continue;
    }
    fails = 0;
    roster[name] = rows.sort((a, b) => 'GDMA'.indexOf(a[1]) - 'GDMA'.indexOf(b[1]) || a[0].localeCompare(b[0]));
    log(`  ${name} <- ${c.name}: ${rows.length} jogadores (${titleOf(html)})`);
  }
  return { roster, missing: deps.allClubs().filter(n => !roster[n]) };
}

module.exports = { parseValue, resolveClubs, parseClubsByText, describe, buildTransfermarkt, parseClubs, parseSquad, parseRobots, allowed };
