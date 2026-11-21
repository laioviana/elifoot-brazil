/* Prancheta 8-Bit — interface */
(function () {
  'use strict';
  const E = window.PB;
  const $ = s => document.querySelector(s);
  const app = $('#app'), modalEl = $('#modal');
  const KEY = 'prancheta8bit.save';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } }
  };
  E.lang = store.get('pb.lang') || ((navigator.language || 'pt').slice(0, 2) === 'pt' ? 'pt' : 'en');
  const L = (pt, en) => (E.lang === 'en' ? en : pt);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => Math.round(v).toLocaleString(E.lang === 'en' ? 'en-US' : 'pt-BR');
  const money = E.money;

  const S = {
    G: null, screen: 'title', tab: 'squad', div: 0, club: null, tview: 'table', mpos: '', afford: false, rd: 0,
    mode: 'career', offers: [], name: '', mute: store.get('pb.mute') === '1',
    ms: null, divMs: null, live: null, timer: null, speed: 0, paused: false, why: '', selOut: 0, flash: 0, flashTxt: '',
    out: null, sum: null, feed: []
  };

  /* ---------- som ---------- */
  let ac;
  function tone(f, d, t0, type, v) {
    if (S.mute) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (t0 || 0);
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(v || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
    } catch (e) { /* áudio indisponível */ }
  }
  const sfx = {
    click: () => tone(660, 0.05),
    goal: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.14, i * 0.1)),
    conc: () => [392, 330, 262].forEach((f, i) => tone(f, 0.2, i * 0.15)),
    blip: () => tone(880, 0.04, 0, 'square', 0.025),
    whistle: () => { tone(2100, 0.12, 0, 'square', 0.03); tone(2100, 0.3, 0.18, 'square', 0.03); },
    coin: () => { tone(988, 0.08); tone(1319, 0.25, 0.08); },
    bad: () => tone(140, 0.3, 0, 'sawtooth')
  };

  /* ---------- helpers de HTML ---------- */
  const shirt = (t, size) => `<svg class="shirt" width="${size || 24}" height="${size || 24}" viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="${t.c1}" d="M0 1h2v-1h1v1h2v-1h1v1h2v3h-2v4h-4v-4h-2z"/><rect x="3" y="1" width="2" height="7" fill="${t.c2}"/></svg>`;
  const posTag = p => `<span class="pos ${p.pos}">${p.pos}</span>`;
  const fitBar = v => `<span class="bar ${v < 55 ? 'low' : v < 78 ? 'mid' : ''}"><i style="width:${v}%"></i></span>`;
  const btn = (label, a, data, cls, dis) => `<button class="${cls || ''}" data-a="${a}" ${data || ''} ${dis ? 'disabled' : ''}>${label}</button>`;
  const DIVN = d => E.DIVS[d].name;
  const status = p => (p.inj ? `<span class="red">${L('LES', 'INJ')} ${p.inj}</span> ` : '') + (p.sus ? `<span class="org">SUS ${p.sus}</span> ` : '') +
    (p.yc ? `<span class="yel">${'▮'.repeat(p.yc)}</span> ` : '') + (p.sale ? '<span class="grn">$</span>' : '');
  function toast(msg) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }
  function modal(html) { modalEl.innerHTML = html ? `<div class="box">${html}</div>` : ''; }
  function save() { if (S.G) { S.G.lang = E.lang; store.set(KEY, JSON.stringify(S.G)); } }

  /* ---------- telas ---------- */
  function render() {
    const fn = { title, newgame, hub, results, season }[S.screen];
    if (fn) { app.innerHTML = fn(); window.scrollTo(0, 0); }
    if (S.screen === 'title') drawTitle();
    if (S.screen === 'hub') checkPending();
  }
  function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }

  function title() {
    return `<div class="title">
      <div class="logo">PRANCHETA</div>
      <div class="logo2">8-BIT · BRASIL A-D</div>
      <canvas id="tcv" width="64" height="36"></canvas>
      <div class="menu">
        ${store.get(KEY) ? btn(L('Continuar', 'Continue'), 'cont', '', 'g big') : ''}
        ${btn(L('Novo jogo', 'New game'), 'new', '', 'y big')}
        <div class="row">${btn(E.lang === 'pt' ? 'PT &gt; EN' : 'EN &gt; PT', 'lang')}${btn(L('Som: ', 'Sound: ') + (S.mute ? 'OFF' : 'ON'), 'mute')}</div>
      </div>
      <p class="dim small">${L('Comande um clube da Série D até o topo do futebol brasileiro.', 'Take a Série D club to the top of Brazilian football.')}</p>
      <p class="dim small blink">▼ PRESS START ▼</p>
    </div>`;
  }
  function drawTitle() {
    const cv = $('#tcv'); if (!cv) return;
    const c = cv.getContext('2d');
    for (let x = 0; x < 64; x += 8) { c.fillStyle = (x / 8) % 2 ? '#008751' : '#00963f'; c.fillRect(x, 0, 8, 36); }
    c.fillStyle = '#fff1e8';
    c.fillRect(31, 0, 1, 36); c.fillRect(0, 0, 64, 1); c.fillRect(0, 35, 64, 1);
    [[27, 13], [26, 14], [25, 16], [25, 19], [26, 21], [27, 22], [35, 13], [36, 14], [37, 16], [37, 19], [36, 21], [35, 22]].forEach(([x, y]) => c.fillRect(x, y, 1, 2));
    c.fillRect(28, 12, 7, 1); c.fillRect(28, 23, 7, 1);
    const ball = ['.###.', '#W#W#', '#WWW#', '#W#W#', '.###.'];
    ball.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { c.fillStyle = ch === '#' ? '#000' : '#fff'; c.fillRect(29 + x, 15 + y, 1, 1); } }));
    [['#ffec27', 12, 10], ['#ffec27', 18, 24], ['#29adff', 46, 9], ['#29adff', 50, 25]].forEach(([col, x, y]) => {
      c.fillStyle = '#ffccaa'; c.fillRect(x + 1, y, 2, 2); c.fillStyle = col; c.fillRect(x, y + 2, 4, 3); c.fillStyle = '#000'; c.fillRect(x, y + 5, 1, 2); c.fillRect(x + 3, y + 5, 1, 2);
    });
  }

  function teamCard(t) {
    return `<div class="card" data-a="pickteam" data-id="${t.id}"><div class="row">${shirt(t, 32)}<div><b>${t.name}</b><br><span class="dim">${t.uf} · ${DIVN(t.div)}</span></div></div>
      <div class="kv small" style="margin-top:6px"><span>${L('Força', 'Strength')}</span><span class="yel">${Math.round(E.rating(t))}</span>
      <span>${L('Estádio', 'Stadium')}</span><span>${num(t.cap)}</span><span>${L('Caixa', 'Cash')}</span><span class="grn">${money(t.cash)}</span></div></div>`;
  }
  function newgame() {
    const G = S.G;
    const list = S.mode === 'career' ? S.offers.map(id => G.teams[id]) : G.teams.filter(t => t.div === S.div);
    return `<div class="box"><h2>${L('NOVO JOGO', 'NEW GAME')}</h2>
      <h3>${L('SEU NOME, PROFESSOR', 'YOUR NAME, COACH')}</h3>
      <input type="text" id="mname" maxlength="18" value="${esc(S.name)}" placeholder="${L('Técnico', 'Manager')}">
      <h3>${L('MODO', 'MODE')}</h3>
      <div class="row">${btn(L('Carreira', 'Career'), 'mode', 'data-m="career"', S.mode === 'career' ? 'on' : '')}${btn(L('Livre', 'Free pick'), 'mode', 'data-m="free"', S.mode === 'free' ? 'on' : '')}</div>
      <p class="dim small">${S.mode === 'career' ? L('Você recebeu propostas de quatro clubes da Série D. Escolha um e suba na carreira.', 'Four Série D clubs want you. Pick one and climb the ladder.') : L('Escolha qualquer clube das quatro divisões.', 'Pick any club from the four divisions.')}</p>
      ${S.mode === 'free' ? `<div class="row" style="margin-bottom:10px">${[0, 1, 2, 3].map(d => btn(DIVN(d), 'ndiv', `data-d="${d}"`, S.div === d ? 'on sm' : 'sm')).join('')}</div>` : ''}
      <div class="cards">${list.map(teamCard).join('')}</div>
      <div class="row" style="margin-top:12px">${btn(L('Voltar', 'Back'), 'totitle')}</div></div>`;
  }

  /* ---------- hub ---------- */
  function nextFix(G) {
    const id = G.mgr.team, rd = G.fix[G.teams[id].div][G.round];
    return rd ? rd.find(f => f[0] === id || f[1] === id) : null;
  }
  function hud() {
    const G = S.G, U = E.userTeam(G);
    return `<div class="box hud">${shirt(U, 36)}<div class="grow"><div class="name">${U.name}</div>
      <div>${DIVN(U.div)} · ${E.position(G, U.id)}º · ${G.season} · ${L('Rod', 'Rd')} ${Math.min(G.round + 1, E.ROUNDS)}/${E.ROUNDS}</div></div>
      <div class="r"><div class="cash ${U.cash < 0 ? 'red' : 'grn'}">${money(U.cash)}</div><div class="dim small">${esc(G.mgr.name)}</div></div></div>`;
  }
  const TABS = [['squad', 'Elenco', 'Squad'], ['table', 'Tabela', 'Table'], ['fix', 'Jogos', 'Fixtures'], ['market', 'Mercado', 'Market'],
    ['fin', 'Finanças', 'Finance'], ['news', 'Notícias', 'News'], ['mgr', 'Técnico', 'Manager']];
  function hub() {
    const G = S.G, U = E.userTeam(G), fx = nextFix(G);
    const body = { squad: tabSquad, table: tabTable, fix: tabFix, market: tabMarket, fin: tabFin, news: tabNews, mgr: tabMgr }[S.tab]();
    let nx = '';
    if (fx) { const home = fx[0] === U.id, o = G.teams[home ? fx[1] : fx[0]]; nx = `<span class="nx">${home ? L('CASA', 'HOME') : L('FORA', 'AWAY')} × ${o.name}</span>`; }
    return hud() + `<nav>${TABS.map(t => btn(L(t[1], t[2]), 'tab', `data-t="${t[0]}"`, S.tab === t[0] ? 'on' : '')).join('')}</nav>${body}
      <div class="playbar">${nx}${btn(L('Jogar ▶', 'Play ▶'), 'play', '', 'g big')}</div>`;
  }

  function tabSquad() {
    const G = S.G, U = E.userTeam(G), lp = E.lineupPlayers(U), c = E.formationOf(lp), probs = E.lineupProblems(U);
    const rows = U.players.map(p => {
      const sel = U.lineup.includes(p.id);
      return `<tr class="click ${sel ? 'sel' : ''} ${E.avail(p) ? '' : 'out'}" data-a="tog" data-id="${p.id}"><td>${sel ? '★' : '·'}</td><td>${posTag(p)}</td><td class="n">${p.n}</td>
        <td>${p.age}</td><td class="yel">${p.str}</td><td>${fitBar(p.fit)}</td><td>${p.g || ''}</td><td>${status(p)}</td><td>${btn('i', 'pinfo', `data-id="${p.id}"`, 'sm b')}</td></tr>`;
    }).join('');
    return `<div class="box"><div class="row sp"><h2>${L('ESCALAÇÃO', 'LINEUP')} ${c.D}-${c.M}-${c.A} <span class="${lp.length === 11 ? 'grn' : 'red'}">(${lp.length}/11)</span></h2>
      <span>${L('Força', 'Str')} <b class="yel">${lp.length ? Math.round(lp.reduce((s, p) => s + E.eff(p), 0) / lp.length) : 0}</b></span></div>
      ${probs.map(p => `<div class="red">! ${p}</div>`).join('')}
      <h3>${L('ESCALAR AUTOMÁTICO', 'AUTO PICK')}</h3>
      <div class="row">${E.FORMATIONS.map((f, i) => btn(f.join('-'), 'auto', `data-i="${i}"`, 'sm ' + (U.fm && U.fm.join('-') === f.join('-') ? 'on' : ''))).join('')}</div>
      <h3>${L('POSTURA', 'STYLE')}</h3>
      <div class="row">${styleBtns(U)}</div></div>
      <div class="box scroll"><p class="dim small" style="margin:0 0 6px">${L('Toque no jogador para escalar ou tirar do time.', 'Tap a player to add or remove from the lineup.')}</p>
      <table><tr><th></th><th>POS</th><th>${L('NOME', 'NAME')}</th><th>${L('ID', 'AGE')}</th><th>${L('FOR', 'STR')}</th><th>${L('FÍS', 'FIT')}</th><th>${L('GOLS', 'GLS')}</th><th></th><th></th></tr>${rows}</table></div>`;
  }
  const styleBtns = U => [L('Defensiva', 'Defensive'), L('Equilibrada', 'Balanced'), L('Ofensiva', 'Attacking')]
    .map((s, i) => btn(s, 'style', `data-i="${i}"`, 'sm ' + (U.style === i ? 'on' : ''))).join('');

  function tabTable() {
    const G = S.G;
    if (S.club !== null) return clubView(G.teams[S.club]);
    const d = S.div, tab = E.table(G, d);
    const head = `<div class="row" style="margin-bottom:8px">${[0, 1, 2, 3].map(x => btn(DIVN(x), 'div', `data-d="${x}"`, 'sm ' + (d === x ? 'on' : ''))).join('')}
      ${btn(S.tview === 'table' ? L('Artilheiros', 'Scorers') : L('Classificação', 'Standings'), 'tview', '', 'sm b')}</div>`;
    if (S.tview === 'scorers') {
      const sc = E.scorers(G, d, 15);
      return `<div class="box">${head}<h2>${L('ARTILHARIA', 'TOP SCORERS')} · ${DIVN(d)}</h2><table><tr><th>#</th><th>${L('JOGADOR', 'PLAYER')}</th><th>${L('CLUBE', 'CLUB')}</th><th>${L('GOLS', 'GOALS')}</th></tr>
        ${sc.map((x, i) => `<tr class="${x.t.id === G.mgr.team ? 'me' : ''}"><td>${i + 1}</td><td>${x.p.n}</td><td>${x.t.name}</td><td class="yel">${x.p.g}</td></tr>`).join('') || `<tr><td colspan="4" class="dim">${L('Ninguém marcou ainda.', 'No goals yet.')}</td></tr>`}</table></div>`;
    }
    const rows = tab.map((t, i) => {
      const zone = (d > 0 && i < 4) || (d === 0 && i === 0) ? 'up' : d < 3 && i > 15 ? 'dn' : '';
      return `<tr class="click ${zone} ${t.id === G.mgr.team ? 'me' : ''}" data-a="club" data-id="${t.id}"><td>${i + 1}</td><td><span class="row" style="gap:6px;flex-wrap:nowrap">${shirt(t, 14)} ${t.name}</span></td>
        <td class="yel">${t.st.pts}</td><td>${t.st.p}</td><td>${t.st.w}</td><td class="hide-s">${t.st.d}</td><td class="hide-s">${t.st.l}</td><td class="hide-s">${t.st.gf}</td><td class="hide-s">${t.st.ga}</td><td>${t.st.gf - t.st.ga}</td>
        <td class="form hide-s">${t.form.map(f => `<span class="${f}">${f === 'W' ? 'V' : f === 'D' ? 'E' : 'D'}</span>`).join('')}</td></tr>`;
    }).join('');
    return `<div class="box scroll">${head}<h2>${DIVN(d)} · ${G.season}</h2>
      <table><tr><th>#</th><th>${L('CLUBE', 'CLUB')}</th><th>PTS</th><th>J</th><th>V</th><th class="hide-s">E</th><th class="hide-s">D</th><th class="hide-s">GP</th><th class="hide-s">GC</th><th>SG</th><th class="hide-s"></th></tr>${rows}</table>
      <p class="dim small"><span class="grn">▌</span>${d === 0 ? L('campeão', 'champion') : L('acesso', 'promotion')} ${d < 3 ? `<span class="red">▌</span>${L('rebaixamento', 'relegation')}` : ''} · ${L('toque num clube para ver o elenco', 'tap a club to see its squad')}</p></div>`;
  }
  function clubView(t) {
    const G = S.G, mine = t.id === G.mgr.team;
    return `<div class="box"><div class="row sp"><div class="row">${shirt(t, 40)}<div><h2 style="margin:0">${t.name}</h2><span class="dim">${t.uf} · ${DIVN(t.div)} · ${E.position(G, t.id)}º</span></div></div>${btn(L('Voltar', 'Back'), 'club', 'data-id=""')}</div>
      <div class="kv" style="margin-top:8px"><span>${L('Força do time', 'Team strength')}</span><span class="yel">${Math.round(E.rating(t))}</span><span>${L('Estádio', 'Stadium')}</span><span>${num(t.cap)}</span></div></div>
      <div class="box scroll">${mine ? '' : `<p class="dim small" style="margin:0 0 6px">${L('Toque num jogador para fazer uma proposta.', 'Tap a player to make a bid.')}</p>`}
      <table><tr><th>POS</th><th>${L('NOME', 'NAME')}</th><th>${L('ID', 'AGE')}</th><th>${L('FOR', 'STR')}</th><th>${L('GOLS', 'GLS')}</th><th>${L('VALOR', 'VALUE')}</th></tr>
      ${t.players.map(p => `<tr class="click" data-a="pinfo" data-id="${p.id}"><td>${posTag(p)}</td><td class="n">${p.n}</td><td>${p.age}</td><td class="yel">${p.str}</td><td>${p.g || ''}</td><td>${money(E.value(p))}</td></tr>`).join('')}</table></div>`;
  }

  function tabFix() {
    const G = S.G, U = E.userTeam(G), fixes = G.fix[U.div];
    const rd = Math.max(0, Math.min(E.ROUNDS - 1, S.rd));
    const cal = fixes.map((r, i) => {
      const f = r.find(x => x[0] === U.id || x[1] === U.id), home = f[0] === U.id, o = G.teams[home ? f[1] : f[0]];
      let res = '', cls = '';
      if (f[2] !== undefined) { const my = home ? f[2] : f[3], op = home ? f[3] : f[2]; res = `${my} × ${op}`; cls = my > op ? 'grn' : my < op ? 'red' : ''; }
      return `<tr class="${i === G.round ? 'me' : ''}"><td>${i + 1}</td><td>${home ? L('C', 'H') : L('F', 'A')}</td><td>${o.name}</td><td class="${cls}">${res}</td></tr>`;
    }).join('');
    return `<div class="box"><div class="row sp"><h2>${L('RODADA', 'ROUND')} ${rd + 1} · ${DIVN(U.div)}</h2><div class="row">${btn('◀', 'rd', 'data-d="-1"', 'sm')}${btn('▶', 'rd', 'data-d="1"', 'sm')}</div></div>
      <div class="others">${fixes[rd].map(f => `<div class="${f[0] === U.id || f[1] === U.id ? 'mine' : ''}"><span>${G.teams[f[0]].abbr}</span><span class="yel">${f[2] !== undefined ? f[2] + ' × ' + f[3] : '×'}</span><span>${G.teams[f[1]].abbr}</span></div>`).join('')}</div></div>
      <div class="box scroll"><h2>${L('CALENDÁRIO', 'CALENDAR')}</h2><table><tr><th>${L('ROD', 'RD')}</th><th></th><th>${L('ADVERSÁRIO', 'OPPONENT')}</th><th>${L('PLACAR', 'SCORE')}</th></tr>${cal}</table></div>`;
  }

  function tabMarket() {
    const G = S.G, U = E.userTeam(G);
    let list = G.market.map(m => ({ m, f: E.findPlayer(G, m.pid) })).filter(x => x.f);
    if (S.mpos) list = list.filter(x => x.f.p.pos === S.mpos);
    if (S.afford) list = list.filter(x => x.m.price <= U.cash);
    list.sort((a, b) => b.f.p.str - a.f.p.str);
    return `<div class="box scroll"><h2>${L('MERCADO DE TRANSFERÊNCIAS', 'TRANSFER MARKET')}</h2>
      <div class="row" style="margin-bottom:8px">${['', 'G', 'D', 'M', 'A'].map(p => btn(p || L('Todos', 'All'), 'mpos', `data-p="${p}"`, 'sm ' + (S.mpos === p ? 'on' : ''))).join('')}
      ${btn(L('Cabe no caixa', 'Affordable'), 'afford', '', 'sm ' + (S.afford ? 'on' : ''))}</div>
      <table><tr><th>POS</th><th>${L('NOME', 'NAME')}</th><th>${L('ID', 'AGE')}</th><th>${L('FOR', 'STR')}</th><th class="hide-s">${L('CLUBE', 'CLUB')}</th><th>${L('PREÇO', 'PRICE')}</th><th></th></tr>
      ${list.map(({ m, f }) => `<tr><td>${posTag(f.p)}</td><td class="n">${m.star ? '<span class="yel" title="' + L('Destaque à venda', 'Star for sale') + '">★</span> ' : ''}${f.p.n}</td><td>${f.p.age}</td><td class="yel">${f.p.str}</td><td class="hide-s">${f.t.abbr}</td><td class="${m.price <= U.cash ? 'grn' : 'red'}">${money(m.price)}</td>
        <td>${btn(L('Comprar', 'Buy'), 'buy', `data-id="${m.pid}"`, 'sm g', m.price > U.cash)}</td></tr>`).join('') || `<tr><td colspan="7" class="dim">${L('Nenhum jogador.', 'No players.')}</td></tr>`}</table>
      <p class="dim small">${L('Você também pode fazer propostas por qualquer jogador: abra um clube na Tabela.', 'You can also bid for any player: open a club from the Table.')} · ${L('Elenco', 'Squad')}: ${U.players.length}/${E.MAX_SQUAD}</p></div>`;
  }

  function tabFin() {
    const G = S.G, U = E.userTeam(G), f = G.fin, dv = E.DIVS[U.div], step = E.loanStep(U), seat = E.seatCost(U);
    const bal = f.tick + f.tv + f.prize + f.sold - f.wage - f.bought - f.int - f.stad;
    const line = (a, b, cls) => `<span>${a}</span><span class="r ${cls || ''}">${b}</span>`;
    return `<div class="box"><h2>${L('FINANÇAS', 'FINANCE')} · ${G.season}</h2><div class="kv">
      ${line(L('Caixa', 'Cash'), money(U.cash), U.cash < 0 ? 'red' : 'grn')}
      ${line(L('Bilheteria', 'Gate receipts'), '+' + money(f.tick))}${line(L('TV e patrocínio', 'TV & sponsors'), '+' + money(f.tv))}
      ${line(L('Venda de jogadores', 'Player sales'), '+' + money(f.sold))}${line(L('Premiação', 'Prize money'), '+' + money(f.prize))}
      ${line(L('Salários', 'Wages'), '-' + money(f.wage), 'org')}${line(L('Compra de jogadores', 'Player purchases'), '-' + money(f.bought), 'org')}
      ${line(L('Juros', 'Interest'), '-' + money(f.int), 'org')}${line(L('Obras no estádio', 'Stadium works'), '-' + money(f.stad), 'org')}
      ${line(L('Saldo da temporada', 'Season balance'), money(bal), bal < 0 ? 'red' : 'grn')}</div>
      <h3>${L('POR RODADA', 'PER ROUND')}</h3><div class="kv">${line(L('Folha salarial', 'Wage bill'), money(E.wageBill(U)), 'org')}${line(L('TV e patrocínio', 'TV & sponsors'), money(E.tv(U)), 'grn')}</div></div>
      <div class="box"><h2>${L('ESTÁDIO', 'STADIUM')}</h2><div class="kv">${line(L('Capacidade', 'Capacity'), num(U.cap))}${line(L('Torcida', 'Fan base'), num(U.fans))}
      ${line(L('Público estimado', 'Expected crowd'), '~' + num(Math.round(E.attendance(G, U) / 100) * 100))}</div>
      <h3>${L('INGRESSO', 'TICKET PRICE')} (${L('padrão', 'standard')} R$ ${dv.ticket})</h3>
      <div class="row">${btn('-5', 'ticket', 'data-d="-5"', 'sm')}<b class="yel">R$ ${U.ticket}</b>${btn('+5', 'ticket', 'data-d="5"', 'sm')}</div>
      <h3>${L('AMPLIAR', 'EXPAND')}</h3>
      <div class="row">${btn(`+1.000 (${money(1000 * seat)})`, 'expand', 'data-n="1000"', 'sm', U.cash < 1000 * seat)}${btn(`+5.000 (${money(5000 * seat)})`, 'expand', 'data-n="5000"', 'sm', U.cash < 5000 * seat)}</div></div>
      <div class="box"><h2>${L('BANCO', 'BANK')}</h2><div class="kv">${line(L('Dívida', 'Debt'), money(U.loan), U.loan ? 'org' : '')}${line(L('Limite', 'Limit'), money(dv.loan))}${line(L('Juros por rodada', 'Interest per round'), '1%')}</div>
      <div class="row" style="margin-top:8px">${btn(L('Pegar ', 'Borrow ') + money(step), 'borrow', '', 'sm y', U.loan + step > dv.loan)}${btn(L('Pagar ', 'Repay ') + money(Math.min(step, U.loan || step)), 'repay', '', 'sm g', !U.loan || U.cash < Math.min(step, U.loan))}</div></div>`;
  }

  function tabNews() {
    const G = S.G;
    return `<div class="box"><h2>${L('NOTÍCIAS', 'NEWS')}</h2><ul class="news">${G.news.map(n => `<li class="${n.k === 'bad' ? 'org' : n.k === 'money' ? 'grn' : n.k === 'job' ? 'yel' : ''}"><span class="dim">${n.s} R${n.r}</span> ${esc(n.t)}</li>`).join('') || `<li class="dim">${L('Nada por enquanto.', 'Nothing yet.')}</li>`}</ul></div>`;
  }

  function tabMgr() {
    const G = S.G, m = G.mgr;
    const note = n => ({ champ: L('CAMPEÃO', 'CHAMPION'), up: L('ACESSO', 'PROMOTED'), down: L('REBAIXADO', 'RELEGATED'), fired: L('DEMITIDO', 'SACKED') }[n] || '');
    return `<div class="box"><h2>${esc(m.name)}</h2><div class="kv">
      <span>${L('Confiança da diretoria', 'Board confidence')}</span><span class="bar wide ${m.conf < 25 ? 'low' : m.conf < 50 ? 'mid' : ''}"><i style="width:${m.conf}%"></i></span>
      <span>${L('Reputação', 'Reputation')}</span><span class="bar wide"><i style="width:${m.rep}%"></i></span>
      <span>${L('Meta da diretoria', 'Board target')}</span><span>${m.exp}º</span>
      <span>${L('Jogos (V-E-D)', 'Games (W-D-L)')}</span><span>${m.games} (${m.w}-${m.d}-${m.l})</span><span>${L('Títulos', 'Titles')}</span><span class="yel">${m.titles}</span></div>
      <h3>${L('CARREIRA', 'CAREER')}</h3><table>${m.log.slice().reverse().map(x => `<tr><td>${x.s}</td><td>${x.team}</td><td>${DIVN(x.div)}</td><td>${x.pos}º</td><td class="yel">${note(x.note)}</td></tr>`).join('') || `<tr><td class="dim">${L('Primeira temporada.', 'First season.')}</td></tr>`}</table></div>
      <div class="box scroll"><h2>${L('CAMPEÕES', 'CHAMPIONS')}</h2><table><tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th></tr>${G.champs.map(c => `<tr><td>${c.s}</td>${c.c.map(n => `<td>${n}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="5" class="dim">—</td></tr>`}</table></div>
      <div class="box row">${btn(E.lang === 'pt' ? 'PT &gt; EN' : 'EN &gt; PT', 'lang')}${btn(L('Som: ', 'Sound: ') + (S.mute ? 'OFF' : 'ON'), 'mute')}${btn(L('Salvar e sair', 'Save & quit'), 'totitle', '', 'rd')}</div>`;
  }

  /* ---------- modais ---------- */
  function playerModal(pid) {
    const G = S.G, f = E.findPlayer(G, pid); if (!f) return;
    const p = f.p, mine = f.t.id === G.mgr.team, v = E.value(p), mk = G.market.find(m => m.pid === pid);
    let act;
    if (mine) {
      act = `<h3>${L('COLOCAR À VENDA', 'LIST FOR SALE')}${p.sale ? ` · <span class="grn">${money(p.sale)}</span>` : ''}</h3>
        <div class="row">${[0.8, 1, 1.3, 1.6].map(k => btn(money(Math.round(v * k / 1000) * 1000), 'sale', `data-id="${pid}" data-v="${Math.round(v * k / 1000) * 1000}"`, 'sm g')).join('')}
        ${p.sale ? btn(L('Retirar', 'Unlist'), 'sale', `data-id="${pid}" data-v="0"`, 'sm') : ''}</div>
        <p class="dim small">${L('Quanto menor o preço, mais rápido aparece comprador.', 'The lower the price, the faster a buyer shows up.')}</p>
        <div class="row">${btn(L('Dispensar', 'Release'), 'release', `data-id="${pid}"`, 'sm rd')}</div>`;
    } else {
      act = (mk ? `<h3>${L('NO MERCADO', 'ON THE MARKET')}</h3><div class="row">${btn(L('Comprar por ', 'Buy for ') + money(mk.price), 'buy', `data-id="${pid}"`, 'sm g')}</div>` : '') +
        `<h3>${L('FAZER PROPOSTA', 'MAKE A BID')}</h3><div class="row">${[1, 1.3, 1.7, 2.1].map(k => btn(money(Math.round(v * k / 1000) * 1000), 'bid', `data-id="${pid}" data-v="${Math.round(v * k / 1000) * 1000}"`, 'sm y')).join('')}</div>`;
    }
    modal(`<div class="row sp"><h2>${posTag(p)} ${p.n}</h2>${shirt(f.t, 28)}</div><div class="kv">
      <span>${L('Clube', 'Club')}</span><span>${f.t.name}</span><span>${L('Idade', 'Age')}</span><span>${p.age}</span><span>${L('Força', 'Strength')}</span><span class="yel">${p.str}</span>
      <span>${L('Físico', 'Fitness')}</span><span>${fitBar(p.fit)} ${p.fit}%</span><span>${L('Gols', 'Goals')}</span><span>${p.g}</span>
      <span>${L('Valor', 'Value')}</span><span class="grn">${money(v)}</span><span>${L('Salário/rodada', 'Wage/round')}</span><span class="org">${money(E.wage(p))}</span>
      <span>${L('Situação', 'Status')}</span><span>${status(p) || 'OK'}</span></div>${act}
      <div class="row" style="margin-top:12px">${btn(L('Fechar', 'Close'), 'close')}</div>`);
  }
  function checkPending() {
    const G = S.G;
    if (G.pending) {
      const fired = G.pending.type === 'fired';
      modal(`<h2 class="${fired ? 'red' : ''}">${fired ? L('VOCÊ FOI DEMITIDO!', 'YOU ARE SACKED!') : L('PROPOSTAS DE EMPREGO', 'JOB OFFERS')}</h2>
        <p>${fired ? L(`A diretoria do ${G.pending.from} perdeu a paciência. Estes clubes querem você:`, `The ${G.pending.from} board ran out of patience. These clubs want you:`) : L('Seu trabalho chamou atenção. Quer mudar de clube?', 'Your work got noticed. Fancy a move?')}</p>
        <div class="cards">${G.pending.offers.map(id => teamCard(G.teams[id]).replace('data-a="pickteam"', 'data-a="job"')).join('')}</div>
        ${fired ? '' : `<div class="row" style="margin-top:12px">${btn(L('Ficar no clube', 'Stay put'), 'job', 'data-id=""', 'g')}</div>`}`);
    } else if (G.offers.length) {
      const o = G.offers[0], f = E.findPlayer(G, o.pid);
      if (!f || f.t.id !== G.mgr.team) { G.offers.shift(); return checkPending(); }
      modal(`<h2>${L('PROPOSTA RECEBIDA', 'INCOMING BID')}</h2><p>${L(`O ${G.teams[o.tid].name} oferece`, `${G.teams[o.tid].name} offer`)} <b class="grn">${money(o.price)}</b> ${L('por', 'for')} ${posTag(f.p)} <b>${f.p.n}</b>
        (${L('força', 'str')} ${f.p.str}, ${f.p.age} ${L('anos', 'y/o')}, ${L('valor', 'value')} ${money(E.value(f.p))}).</p>
        <div class="row">${btn(L('Vender', 'Sell'), 'offer', 'data-y="1"', 'g')}${btn(L('Recusar', 'Reject'), 'offer', 'data-y=""', 'rd')}</div>`);
    }
  }

  /* ---------- partida ao vivo ---------- */
  const SPEEDS = [420, 170, 45];
  function startMatch() {
    const G = S.G, U = E.userTeam(G);
    S.ms = E.startRound(G, false);
    S.divMs = S.ms.filter(m => m.div === U.div);
    S.live = S.ms.find(m => m.user >= 0);
    E.playAll(G, S.ms.filter(m => m.div !== U.div));
    S.divMs.forEach(m => { m._seen = 0; m._hot = -9; });
    S.feed = []; S.paused = false; S.why = ''; S.selOut = 0; S.flash = 0;
    S.screen = 'match';
    const m = S.live, H = G.teams[m.h], A = G.teams[m.a];
    app.innerHTML = `<div class="box"><div class="score"><div class="t h">${H.name} ${shirt(H, 28)}</div><div class="g" id="sc">0 × 0</div><div class="t">${shirt(A, 28)} ${A.name}</div></div>
      <div class="clock" id="clk"></div>
      <div class="pitchwrap"><canvas id="pitch" width="96" height="56"></canvas><div id="gf"></div></div>
      <div class="row" id="ctl" style="justify-content:center;margin-top:10px"></div></div>
      <div id="subs"></div>
      <div class="box"><h3 style="margin-top:0">${DIVN(U.div)} · ${L('RODADA', 'ROUND')} ${G.round + 1}</h3><div class="others" id="oth"></div></div>
      <div class="box"><div class="feed" id="feed"></div></div>`;
    window.scrollTo(0, 0);
    sfx.whistle();
    updateMatch();
    schedule();
  }
  function schedule() { clearTimeout(S.timer); S.timer = setTimeout(tick, SPEEDS[S.speed]); }
  function pause(why) { S.paused = true; S.why = why; S.selOut = 0; clearTimeout(S.timer); updateMatch(); }
  function tick() {
    if (S.screen !== 'match' || S.paused) return;
    const G = S.G, m = S.live;
    for (const x of S.divMs) E.step(G, x);
    collect(true);
    updateMatch();
    if (m.done) { sfx.whistle(); return; }
    if (m.needSub) { m.needSub = false; if (E.bench(G, m, m.user).length) return pause('inj'); m.vac[m.user] = 0; }
    if (m.min === 45) { sfx.whistle(); return pause('half'); }
    schedule();
  }
  function collect(sound) {
    const G = S.G;
    for (const m of S.divMs) {
      for (; m._seen < m.ev.length; m._seen++) {
        const e = m.ev[m._seen], t = G.teams[e.s ? m.a : m.h], isLive = m === S.live, mineSide = isLive && e.s === m.user;
        const sc = `${G.teams[m.h].abbr} ${m.sc[0]}×${m.sc[1]} ${G.teams[m.a].abbr}`;
        if (e.type === 'goal') {
          m._hot = e.min;
          S.feed.unshift({ c: mineSide ? 'mineg' : 'goal', t: `${e.min}' ⚽ ${L('GOL', 'GOAL')}! ${e.n} (${t.abbr}) · ${sc}` });
          if (isLive) { S.flash = 5; S.flashTxt = mineSide ? L('GOOOL!', 'GOAL!') : L('GOL DELES', 'THEY SCORE'); if (sound) (mineSide ? sfx.goal : sfx.conc)(); }
          else if (sound) sfx.blip();
        } else if (isLive) {
          const txt = { yel: L('Cartão amarelo', 'Yellow card'), red: L('EXPULSO', 'SENT OFF'), inj: L('Lesão', 'Injury'), sub: L('Entra', 'On:') }[e.type];
          S.feed.unshift({ c: e.type === 'sub' ? '' : 'bad', t: `${e.min}' ${e.type === 'yel' ? '▮' : e.type === 'red' ? '■' : e.type === 'inj' ? '✚' : '⇄'} ${txt}: ${e.n} (${t.abbr})${e.out ? ' ⇠ ' + e.out : ''}` });
          if (sound && e.type === 'red') sfx.bad();
        }
      }
    }
    if (S.feed.length > 60) S.feed.length = 60;
  }
  function updateMatch() {
    const G = S.G, m = S.live;
    $('#sc').textContent = `${m.sc[0]} × ${m.sc[1]}`;
    $('#clk').textContent = m.done ? L('FIM DE JOGO', 'FULL TIME') : S.paused && S.why === 'half' ? L('INTERVALO', 'HALF TIME') : `${m.min}' · ${m.min <= 45 ? L('1º TEMPO', '1ST HALF') : L('2º TEMPO', '2ND HALF')}`;
    $('#oth').innerHTML = S.divMs.map(x => `<div class="${x.min - x._hot < 4 ? 'hot' : ''} ${x === m ? 'mine' : ''}"><span>${G.teams[x.h].abbr}</span><span>${x.sc[0]} × ${x.sc[1]}</span><span>${G.teams[x.a].abbr}</span></div>`).join('');
    $('#feed').innerHTML = S.feed.map(f => `<div class="${f.c}">${f.t}</div>`).join('') || `<div class="dim">${L('Bola rolando...', 'Kick-off...')}</div>`;
    $('#gf').innerHTML = S.flash > 0 ? `<div class="goalflash">${S.flashTxt}</div>` : '';
    if (S.flash > 0) S.flash--;
    const ck = [m.done, S.paused, S.speed, E.lang].join();
    if ($('#ctl').dataset.k !== ck) { $('#ctl').dataset.k = ck; $('#ctl').innerHTML = m.done ? btn(L('Continuar ▶', 'Continue ▶'), 'endmatch', '', 'g big')
      : S.paused ? '' : ['1×', '2×', '4×'].map((s, i) => btn(s, 'speed', `data-i="${i}"`, 'sm ' + (S.speed === i ? 'on' : ''))).join('') +
        btn(L('Pausa / Trocas', 'Pause / Subs'), 'pause', '', 'sm y') + btn(L('Resultado rápido', 'Quick result'), 'quick', '', 'sm b'); }
    const sp = S.paused && !m.done ? subsPanel() : '';
    if (sp || $('#subs').innerHTML) $('#subs').innerHTML = sp;
    drawPitch();
  }
  function subsPanel() {
    const G = S.G, m = S.live, s = m.user, U = E.userTeam(G), left = E.MAX_SUBS - m.subs[s], vac = m.vac[s];
    const row = (p, a) => `<tr class="click ${S.selOut === p.id ? 'sel' : ''}" data-a="${a}" data-id="${p.id}"><td>${posTag(p)}</td><td class="n">${p.n}</td><td class="yel">${p.str}</td><td>${fitBar(p.fit)}</td></tr>`;
    const title = S.why === 'half' ? L('INTERVALO', 'HALF TIME') : S.why === 'inj' ? L('JOGADOR LESIONADO!', 'PLAYER INJURED!') : L('JOGO PAUSADO', 'PAUSED');
    const hint = !left ? L('Sem substituições restantes.', 'No substitutions left.') : vac ? L('Escolha no banco quem entra na vaga do lesionado.', 'Pick a bench player to replace the injured one.')
      : S.selOut ? L('Agora toque em quem entra.', 'Now tap who comes on.') : L('Toque em quem sai e depois em quem entra.', 'Tap who goes off, then who comes on.');
    return `<div class="box"><div class="row sp"><h2>${title}</h2><span>${L('Trocas', 'Subs')}: <b class="yel">${left}</b></span></div>
      <div class="row" style="margin-bottom:8px">${styleBtns(U)}</div><p class="dim small" style="margin:0 0 6px">${hint}</p>
      <div class="subs"><div><h3>${L('EM CAMPO', 'ON THE PITCH')} (${m.on[s].length})</h3><table>${m.on[s].slice().sort(E.byPos).map(p => row(p, 'sout')).join('')}</table></div>
      <div><h3>${L('BANCO', 'BENCH')}</h3><table>${E.bench(G, m, s).map(p => row(p, 'sin')).join('') || `<tr><td class="dim">—</td></tr>`}</table></div></div>
      <div class="row" style="margin-top:10px;justify-content:center">${btn(L('Voltar ao jogo ▶', 'Resume ▶'), 'resume', '', 'g big')}</div></div>`;
  }
  function drawPitch() {
    const cv = $('#pitch'); if (!cv) return;
    const c = cv.getContext('2d'), G = S.G, m = S.live;
    for (let x = 0; x < 96; x += 12) { c.fillStyle = (x / 12) % 2 ? '#008751' : '#00963f'; c.fillRect(x, 0, 12, 56); }
    c.fillStyle = '#fff1e8';
    c.fillRect(2, 2, 92, 1); c.fillRect(2, 53, 92, 1); c.fillRect(2, 2, 1, 52); c.fillRect(93, 2, 1, 52); c.fillRect(47, 2, 1, 52);
    c.fillRect(2, 16, 12, 1); c.fillRect(2, 39, 12, 1); c.fillRect(13, 16, 1, 24); c.fillRect(82, 16, 12, 1); c.fillRect(82, 39, 12, 1); c.fillRect(82, 16, 1, 24);
    c.fillRect(42, 21, 11, 1); c.fillRect(42, 34, 11, 1); c.fillRect(41, 22, 1, 12); c.fillRect(53, 22, 1, 12);
    c.fillRect(0, 23, 2, 10); c.fillRect(94, 23, 2, 10);
    const bx = 47 + m.ball * 42, by = 27 + Math.sin(m.min * 1.7) * 14;
    const X = { G: 6, D: 22, M: 40, A: 58 };
    for (let s = 0; s < 2; s++) {
      const t = G.teams[s ? m.a : m.h], cnt = E.formationOf(m.on[s]), idx = { G: 0, D: 0, M: 0, A: 0 };
      m.on[s].forEach((p, k) => {
        let x = X[p.pos] + (p.pos === 'G' ? 0 : (s ? -m.ball : m.ball) * 12 + 6);
        if (s) x = 95 - x;
        let y = 6 + 44 * (idx[p.pos]++ + 0.5) / cnt[p.pos] + ((m.min * 7 + k * 5) % 3) - 1;
        if (p.pos !== 'G') { x += Math.sign(bx - x) * Math.min(4, Math.abs(bx - x) / 6); y += Math.sign(by - y) * Math.min(3, Math.abs(by - y) / 6); }
        x = Math.round(x); y = Math.round(y);
        c.fillStyle = '#000'; c.fillRect(x - 2, y - 2, 4, 5);
        c.fillStyle = t.c1; c.fillRect(x - 1, y - 1, 2, 3);
        c.fillStyle = t.c2; c.fillRect(x - 1, y, 2, 1);
      });
    }
    c.fillStyle = '#000'; c.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 4, 4);
    c.fillStyle = '#fff'; c.fillRect(Math.round(bx), Math.round(by), 2, 2);
  }

  /* ---------- pós-jogo ---------- */
  function results() {
    const G = S.G, o = S.out, m = o.user, U = E.userTeam(G), H = G.teams[m.h], A = G.teams[m.a];
    const cls = o.res === 'W' ? 'grn' : o.res === 'L' ? 'red' : 'yel';
    const goals = m.ev.filter(e => e.type === 'goal').map(e => `${e.min}' ${e.n} (${G.teams[e.s ? m.a : m.h].abbr})`).join(' · ');
    const divs = [U.div].concat([0, 1, 2, 3].filter(d => d !== U.div)).map(d => `<h3>${DIVN(d)}</h3><div class="others">${S.ms.filter(x => x.div === d).map(x =>
      `<div class="${x === m ? 'mine' : ''}"><span>${G.teams[x.h].abbr}</span><span class="yel">${x.sc[0]} × ${x.sc[1]}</span><span>${G.teams[x.a].abbr}</span></div>`).join('')}</div>`).join('');
    return hud() + `<div class="box c"><h2 class="${cls}">${o.res === 'W' ? L('VITÓRIA!', 'VICTORY!') : o.res === 'L' ? L('DERROTA', 'DEFEAT') : L('EMPATE', 'DRAW')}</h2>
      <div class="score"><div class="t h">${H.name} ${shirt(H, 28)}</div><div class="g">${m.sc[0]} × ${m.sc[1]}</div><div class="t">${shirt(A, 28)} ${A.name}</div></div>
      <p class="small">${goals}</p><p>${L('Público', 'Attendance')}: ${num(m.att)}${o.income ? ` · ${L('Renda', 'Gate')}: <span class="grn">${money(o.income)}</span>` : ''}</p>
      ${btn(L('Continuar ▶', 'Continue ▶'), 'afterres', '', 'g big')}</div>
      <div class="box"><h2>${L('RESULTADOS DA RODADA', 'ROUND RESULTS')}</h2>${divs}</div>`;
  }
  function season() {
    const G = S.G, s = S.sum, U = E.userTeam(G);
    const head = s.champion ? L('CAMPEÃO!!!', 'CHAMPIONS!!!') : s.promoted ? L('ACESSO GARANTIDO!', 'PROMOTED!') : s.relegated ? L('REBAIXADO...', 'RELEGATED...') : L('FIM DA TEMPORADA', 'SEASON OVER');
    const names = ids => ids.map(id => G.teams[id].name).join(', ');
    return `<div class="box c"><h2 class="${s.relegated ? 'red' : 'yel'} ${s.champion ? 'blink' : ''}">${head}</h2>
      <div class="row" style="justify-content:center">${shirt(U, 48)}</div>
      <p>${U.name}: ${s.pos}º ${L('na', 'in')} ${DIVN(s.div)} ${s.season}</p><p>${L('Premiação', 'Prize money')}: <span class="grn">${money(s.prize)}</span></p>
      ${s.retired.length ? `<p class="org">${L('Aposentaram-se', 'Retired')}: ${s.retired.join(', ')}</p>` : ''}
      ${btn(L('Nova temporada ▶', 'Next season ▶'), 'hub', '', 'g big')}</div>
      ${s.divs.map((d, i) => `<div class="box"><h2>${DIVN(i)}</h2><div class="kv"><span>${L('Campeão', 'Champion')}</span><span class="yel">${G.teams[d.champ].name}</span>
        ${d.scorer ? `<span>${L('Artilheiro', 'Top scorer')}</span><span>${d.scorer.n} (${d.scorer.team}) · ${d.scorer.g}</span>` : ''}</div>
        ${d.up.length ? `<p class="grn small">▲ ${names(d.up)}</p>` : ''}${d.down.length ? `<p class="red small">▼ ${names(d.down)}</p>` : ''}</div>`).join('')}`;
  }

  /* ---------- ações ---------- */
  const A = {
    lang() { E.lang = E.lang === 'pt' ? 'en' : 'pt'; store.set('pb.lang', E.lang); rerender(); },
    mute() { S.mute = !S.mute; store.set('pb.mute', S.mute ? '1' : '0'); rerender(); },
    new() {
      if (store.get(KEY) && !confirm(L('Começar um novo jogo apaga o jogo salvo. Continuar?', 'Starting a new game erases your save. Go on?'))) return;
      S.G = E.newGame();
      S.offers = S.G.teams.filter(t => t.div === 3).sort(() => Math.random() - 0.5).slice(0, 4).map(t => t.id);
      S.mode = 'career'; S.div = 0; S.screen = 'newgame'; render();
    },
    cont() {
      try { S.G = JSON.parse(store.get(KEY)); E.lang = S.G.lang || E.lang; } catch (e) { S.G = null; }
      if (!S.G || S.G.mgr.team < 0) return toast(L('Jogo salvo inválido.', 'Invalid save.'));
      S.tab = 'squad'; S.club = null; S.div = E.userTeam(S.G).div; S.rd = S.G.round; S.screen = 'hub'; render();
    },
    totitle() { save(); clearTimeout(S.timer); S.screen = 'title'; modal(''); render(); },
    mode(d) { keepName(); S.mode = d.m; if (d.m === 'free') S.div = 0; render(); },
    ndiv(d) { keepName(); S.div = +d.d; render(); },
    pickteam(d) {
      keepName();
      const G = S.G;
      G.mgr.name = S.name.trim() || L('Professor', 'Coach');
      G.mgr.rep = S.mode === 'career' ? 20 : 35;
      E.takeTeam(G, +d.id);
      S.tab = 'squad'; S.club = null; S.div = E.userTeam(G).div; S.rd = 0; S.screen = 'hub';
      save(); sfx.coin(); render();
    },
    tab(d) { S.tab = d.t; S.club = null; if (d.t === 'table') S.div = E.userTeam(S.G).div; if (d.t === 'fix') S.rd = Math.min(S.G.round, E.ROUNDS - 1); render(); },
    tog(d) {
      const U = E.userTeam(S.G), id = +d.id, p = U.players.find(x => x.id === id), i = U.lineup.indexOf(id);
      if (i >= 0) U.lineup.splice(i, 1);
      else if (!E.avail(p)) return toast(L('Jogador indisponível.', 'Player unavailable.'));
      else if (U.lineup.length >= 11) return toast(L('Já há 11 escalados: tire um antes.', 'Already 11 picked: remove one first.'));
      else U.lineup.push(id);
      rerender();
    },
    auto(d) { E.autoLineup(E.userTeam(S.G), E.FORMATIONS[+d.i]); rerender(); },
    style(d) { E.userTeam(S.G).style = +d.i; if (S.screen === 'match') updateMatch(); else rerender(); },
    pinfo(d) { playerModal(+d.id); },
    close() { modal(''); },
    sale(d) { const f = E.findPlayer(S.G, +d.id); if (f) f.p.sale = +d.v; save(); modal(''); rerender(); toast(+d.v ? L('Jogador colocado à venda.', 'Player listed for sale.') : L('Retirado da lista.', 'Unlisted.')); },
    release(d) {
      if (!confirm(L('Dispensar o jogador sem receber nada?', 'Release this player for free?'))) return;
      if (!E.release(S.G, +d.id)) return toast(L('Elenco mínimo atingido.', 'Minimum squad size reached.'));
      save(); modal(''); rerender();
    },
    buy(d) { const err = E.buy(S.G, +d.id); modal(''); if (err) { sfx.bad(); toast(err); } else { sfx.coin(); toast(L('Contratado!', 'Signed!')); save(); } rerender(); },
    bid(d) { const err = E.bid(S.G, +d.id, +d.v); if (err) { sfx.bad(); toast(err); } else { sfx.coin(); modal(''); toast(L('Proposta aceita!', 'Bid accepted!')); save(); rerender(); } },
    offer(d) { E.answerOffer(S.G, !!d.y); if (d.y) sfx.coin(); modal(''); save(); rerender(); },
    job(d) {
      const G = S.G;
      if (d.id !== '') { E.takeTeam(G, +d.id); S.div = E.userTeam(G).div; S.tab = 'squad'; sfx.coin(); } else G.pending = null;
      modal(''); save(); render();
    },
    div(d) { S.div = +d.d; rerender(); },
    tview() { S.tview = S.tview === 'table' ? 'scorers' : 'table'; rerender(); },
    club(d) { S.club = d.id === '' ? null : +d.id; S.tab = 'table'; render(); },
    rd(d) { S.rd = Math.max(0, Math.min(E.ROUNDS - 1, S.rd + +d.d)); rerender(); },
    mpos(d) { S.mpos = d.p; rerender(); },
    afford() { S.afford = !S.afford; rerender(); },
    ticket(d) { const U = E.userTeam(S.G); U.ticket = Math.max(5, Math.min(500, U.ticket + +d.d)); rerender(); },
    expand(d) { if (E.expand(S.G, +d.n)) { sfx.coin(); save(); } rerender(); },
    borrow() { if (E.borrow(S.G)) sfx.coin(); save(); rerender(); },
    repay() { if (E.repay(S.G)) sfx.coin(); save(); rerender(); },
    play() {
      const G = S.G, probs = E.lineupProblems(E.userTeam(G));
      if (G.pending || G.offers.length) return checkPending();
      if (probs.length) { S.tab = 'squad'; S.club = null; render(); sfx.bad(); return toast(probs[0]); }
      startMatch();
    },
    speed(d) { S.speed = +d.i; updateMatch(); schedule(); },
    pause() { pause('user'); },
    resume() {
      const m = S.live;
      if (m.vac[m.user] > 0) m.vac[m.user] = 0;
      S.paused = false; S.selOut = 0; updateMatch(); schedule();
    },
    sout(d) { S.selOut = S.selOut === +d.id ? 0 : +d.id; updateMatch(); },
    sin(d) {
      const m = S.live, s = m.user, vac = m.vac[s] > 0;
      if (!vac && !S.selOut) return toast(L('Escolha primeiro quem sai.', 'Pick who goes off first.'));
      if (!E.sub(S.G, m, s, vac ? 0 : S.selOut, +d.id)) return toast(L('Substituição não permitida.', 'Substitution not allowed.'));
      S.selOut = 0; collect(false); sfx.click(); updateMatch();
    },
    quick() {
      clearTimeout(S.timer);
      S.live.autoUser = true; S.live.needSub = false;
      E.playAll(S.G, S.divMs); collect(false); S.flash = 0; updateMatch(); sfx.whistle();
    },
    endmatch() {
      const G = S.G;
      S.out = E.finishRound(G, S.ms);
      const U = E.userTeam(G);
      U.lineup = U.lineup.filter(id => { const p = U.players.find(x => x.id === id); return p && E.avail(p); });
      save(); S.screen = 'results'; render();
    },
    afterres() {
      const G = S.G;
      if (G.seasonOver) { S.sum = E.endSeason(G); save(); S.screen = 'season'; if (S.sum.champion || S.sum.promoted) sfx.goal(); }
      else { S.screen = 'hub'; S.rd = G.round; }
      render();
    },
    hub() { S.screen = 'hub'; S.tab = 'squad'; S.club = null; S.div = E.userTeam(S.G).div; S.rd = 0; render(); }
  };
  function keepName() { const i = $('#mname'); if (i) S.name = i.value; }

  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (!fn) return;
    if (el.tagName === 'BUTTON') sfx.click();
    fn(el.dataset, el);
  });
  window.PB_UI = { S, A };
  render();
})();
