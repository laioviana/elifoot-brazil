/* Prancheta 8-Bit — motor do jogo (sem DOM; roda também em Node para testes) */
(function (root) {
  'use strict';
  const D = root.PB_DATA || require('./data.js');
  const ROSTER = root.PB_ROSTER || (typeof require === 'function' ? require('./roster.js') : {});
  const E = { lang: 'pt', rand: Math.random };
  const L = (pt, en) => (E.lang === 'en' ? en : pt);
  const r = () => E.rand();
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = a => a[Math.floor(r() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  E.ROUNDS = 38;
  E.MAX_SUBS = 5;
  E.MAX_SQUAD = 32;
  E.MIN_SQUAD = 14;
  E.DIVS = [
    { name: 'Série A', norm: 76, ticket: 70, cap: 38000, cash: 20e6, loan: 40e6, prize: 30e6, budget: 80e6 },
    { name: 'Série B', norm: 66, ticket: 45, cap: 18000, cash: 5e6, loan: 10e6, prize: 6e6, budget: 15e6 },
    { name: 'Série C', norm: 56, ticket: 30, cap: 9000, cash: 1.2e6, loan: 3e6, prize: 1.5e6, budget: 4e6 },
    { name: 'Série D', norm: 46, ticket: 20, cap: 4500, cash: 4e5, loan: 1e6, prize: 5e5, budget: 1.2e6 }
  ];
  E.FORMATIONS = [[4, 4, 2], [4, 3, 3], [3, 5, 2], [5, 3, 2], [4, 5, 1], [3, 4, 3]];
  const POS_ORDER = { G: 0, D: 1, M: 2, A: 3 };

  /* ---------- jogadores ---------- */
  E.wage = p => Math.round(180 * Math.pow(1.085, p.str) / 100) * 100;
  E.value = p => {
    let v = 2500 * Math.pow(1.12, p.str);
    const a = p.age;
    v *= a <= 21 ? 1.3 : a <= 25 ? 1.15 : a <= 29 ? 1 : a <= 32 ? 0.65 : 0.35;
    if (p.pot > p.str) v *= 1 + (p.pot - p.str) * 0.03;
    return Math.max(1000, Math.round(v / 1000) * 1000);
  };
  E.eff = p => p.str * (0.55 + 0.45 * p.fit / 100);
  E.avail = p => !p.inj && !p.sus;

  function mkName() { return r() < 0.45 ? pick(D.NICK) : pick(D.FIRST) + ' ' + pick(D.LAST); }
  function mkPlayer(G, pos, str, age) {
    str = clamp(Math.round(str), 1, 99);
    return {
      id: G.pid++, n: mkName(), pos, str, age,
      pot: age <= 23 ? clamp(str + ri(1, 12), 1, 99) : str,
      fit: 100, inj: 0, sus: 0, yc: 0, g: 0, sale: 0
    };
  }
  function addPlayer(team, p) {
    for (let i = 0; i < 20 && team.players.some(x => x.n === p.n); i++) p.n = mkName();
    team.players.push(p);
    return p;
  }
  // Elenco real (js/roster.js): nomes, posições e idades reais. A força gira em torno da força do clube; quando o
  // elenco traz valor de mercado (4º campo), ele ordena os jogadores: quem vale o dobro tem ~2 de FOR a mais.
  // O mercado paga menos por goleiros e veteranos do que eles rendem em campo: antes de comparar valores, corrige o
  // log do valor por posição e idade (calibrado com os elencos reais: veteranos e jogadores de cada posição no mesmo
  // nível médio; goleiro titular no nível dos titulares de linha, pois reservas de gol valem muito pouco).
  E.VALUE_ADJ = { pos: { G: 0.6, D: 0.4, M: 0.2, A: 0 }, age: [[30, 0], [33, 0.4], [35, 1.0], [99, 1.9]] };
  const adjLogValue = x => {
    const age = Math.round(x[2]) || 25, a = E.VALUE_ADJ.age.find(([lim]) => age < lim);
    return Math.log(x[3]) + (E.VALUE_ADJ.pos[x[1]] || 0) + (a ? a[1] : 0);
  };
  E.realStrengths = (list, rating) => {
    const valued = list.filter(x => x[3] > 0);
    if (list.length && valued.length >= list.length * 0.6) {
      const lv = valued.map(adjLogValue).sort((a, b) => a - b);
      const med = lv[Math.floor(lv.length / 2)];
      const raw = list.map(x => x[3] > 0
        ? rating + clamp(Math.round(3.2 * (adjLogValue(x) - med)), -10, 9) + ri(-1, 1)
        : rating + ri(-10, -5));
      // mesmo nível médio de antes (média dos 14 melhores ≈ força do clube + 1,6), só muda quem é bom e quem não é
      const top = raw.slice().sort((a, b) => b - a).slice(0, 14);
      const shift = Math.round(rating + 1.6 - top.reduce((a, b) => a + b, 0) / top.length);
      return raw.map(s => s + shift);
    }
    return list.map(x => rating + ri(-7, 5) - ((Math.round(x[2]) || 25) <= 20 ? 3 : 0));
  };
  function realSquad(G, team, rating) {
    const list = (ROSTER[team.name] || []).filter(x => x && x[0] && 'GDMA'.includes(x[1])).slice(0, 26);
    const strs = E.realStrengths(list, rating);
    list.forEach(([n, pos, age0], i) => {
      const age = clamp(Math.round(age0) || 25, 16, 40);
      const p = mkPlayer(G, pos, strs[i], age);
      p.n = n; p.real = 1;
      team.players.push(p);
    });
    return list.length;
  }
  function mkSquad(G, team, rating) {
    if (realSquad(G, team, rating) >= 10) { ensureSquad(G, team, false); return; }
    team.players.length = 0;
    const cnt = { G: 3, D: 7, M: 7, A: 5 };
    for (const pos in cnt) for (let i = 0; i < cnt[pos]; i++) {
      const age = ri(18, 34);
      addPlayer(team, mkPlayer(G, pos, rating + ri(-6, 5) - (age <= 20 ? 3 : 0), age));
    }
  }
  E.byPos = (a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.str - a.str;
  function sortSquad(team) {
    team.players.sort(E.byPos);
  }
  E.rating = team => {
    const s = team.players.map(p => p.str).sort((a, b) => b - a).slice(0, 14);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
  };
  E.wageBill = team => team.players.reduce((s, p) => s + E.wage(p), 0);
  E.findPlayer = (G, pid) => {
    for (const t of G.teams) { const p = t.players.find(x => x.id === pid); if (p) return { p, t }; }
    return null;
  };

  /* ---------- mundo ---------- */
  function mkFixtures(ids) {
    const n = ids.length, a = shuffle(ids.slice()), first = [];
    for (let k = 0; k < n - 1; k++) {
      const rd = [];
      for (let i = 0; i < n / 2; i++) {
        let h = a[i], w = a[n - 1 - i];
        if (i === 0 ? k % 2 : i % 2) [h, w] = [w, h];
        rd.push([h, w]);
      }
      first.push(rd);
      a.splice(1, 0, a.pop());
    }
    return first.concat(first.map(rd => rd.map(([h, w]) => [w, h])));
  }
  function newStats() { return { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }
  function newFin() { return { tick: 0, tv: 0, prize: 0, sold: 0, wage: 0, bought: 0, int: 0, stad: 0 }; }
  function setupSeason(G) {
    G.round = 0; G.seasonOver = false; G.fix = [];
    for (let d = 0; d < 4; d++) G.fix.push(mkFixtures(G.teams.filter(t => t.div === d).map(t => t.id)));
    for (const t of G.teams) { t.st = newStats(); t.form = []; }
    G.fin = newFin();
    if (G.mgr.team >= 0) G.mgr.exp = E.expectedPos(G, G.mgr.team);
  }

  E.newGame = function () {
    const G = {
      v: 1, season: 2026, round: 0, pid: 1, teams: [], fix: [], market: [], news: [], offers: [],
      champs: [], pending: null, seasonOver: false, fin: newFin(),
      mgr: { name: '', team: -1, rep: 20, conf: 60, exp: 10, log: [], titles: 0, games: 0, w: 0, d: 0, l: 0 }
    };
    D.CLUBS.forEach((list, div) => list.forEach(c => {
      const dv = E.DIVS[div];
      const cap = Math.round(dv.cap * (0.75 + r() * 0.5) * (1 + (c[5] - dv.norm) / 20) / 500) * 500;
      const team = {
        id: G.teams.length, name: c[0], abbr: c[1], uf: c[2], c1: c[3], c2: c[4], div,
        cap, fans: Math.round(cap * 0.7), ticket: dv.ticket, loan: 0,
        cash: Math.round(dv.cash * (0.7 + r() * 0.6) / 1000) * 1000,
        players: [], lineup: [], style: 1, fm: pick(E.FORMATIONS), st: newStats(), form: []
      };
      mkSquad(G, team, c[5]);
      sortSquad(team);
      G.teams.push(team);
    }));
    setupSeason(G);
    refreshMarket(G);
    return G;
  };

  E.userTeam = G => G.teams[G.mgr.team];
  E.table = (G, div) => G.teams.filter(t => t.div === div).sort((a, b) =>
    b.st.pts - a.st.pts || b.st.w - a.st.w || (b.st.gf - b.st.ga) - (a.st.gf - a.st.ga) || b.st.gf - a.st.gf || a.id - b.id);
  E.position = (G, tid) => E.table(G, G.teams[tid].div).findIndex(t => t.id === tid) + 1;
  // Próximo jogo do usuário: { home, opp, pos } (pos = posição atual do adversário) ou null se a temporada acabou
  E.nextMatch = G => {
    const id = G.mgr.team, rd = G.fix[G.teams[id].div][G.round];
    if (!rd) return null;
    const f = rd.find(x => x[0] === id || x[1] === id);
    if (!f) return null;
    const home = f[0] === id, opp = G.teams[home ? f[1] : f[0]];
    return { home, opp, pos: E.position(G, opp.id) };
  };
  E.expectedPos = (G, tid) => {
    const t = G.teams[tid];
    return G.teams.filter(x => x.div === t.div).sort((a, b) => E.rating(b) - E.rating(a)).indexOf(t) + 1;
  };
  E.scorers = (G, div, n) => {
    const out = [];
    for (const t of G.teams) if (t.div === div) for (const p of t.players) if (p.g > 0) out.push({ p, t });
    return out.sort((a, b) => b.p.g - a.p.g || a.p.id - b.p.id).slice(0, n || 10);
  };
  E.news = (G, text, kind) => {
    G.news.unshift({ s: G.season, r: G.round, t: text, k: kind || '' });
    if (G.news.length > 80) G.news.length = 80;
  };

  E.takeTeam = function (G, tid) {
    const t = G.teams[tid];
    G.mgr.team = tid; G.mgr.conf = 60; G.pending = null; G.offers = [];
    G.mgr.exp = E.expectedPos(G, tid);
    G.fin = newFin();
    for (const p of t.players) p.sale = 0;
    G.market = G.market.filter(m => m.tid !== tid);
    E.autoLineup(t, t.fm);
    E.news(G, L(`${G.mgr.name} assume o comando do ${t.name}.`, `${G.mgr.name} takes charge of ${t.name}.`), 'job');
  };

  /* ---------- escalação ---------- */
  E.autoLineup = function (team, fm) {
    fm = fm || team.fm;
    const av = team.players.filter(E.avail).sort((a, b) => E.eff(b) - E.eff(a));
    const need = { G: 1, D: fm[0], M: fm[1], A: fm[2] }, chosen = [];
    for (const p of av) if (need[p.pos] > 0) { chosen.push(p); need[p.pos]--; }
    for (const p of av) if (chosen.length < 11 && p.pos !== 'G' && !chosen.includes(p)) chosen.push(p);
    for (const p of av) if (chosen.length < 11 && !chosen.includes(p)) chosen.push(p);
    team.lineup = chosen.map(p => p.id);
    team.fm = fm;
  };
  E.lineupPlayers = team => team.lineup.map(id => team.players.find(p => p.id === id)).filter(Boolean);
  E.formationOf = players => {
    const c = { G: 0, D: 0, M: 0, A: 0 };
    for (const p of players) c[p.pos]++;
    return c;
  };
  E.lineupProblems = function (team) {
    const lp = E.lineupPlayers(team), av = team.players.filter(E.avail), probs = [];
    const c = E.formationOf(lp);
    if (lp.some(p => !E.avail(p))) probs.push(L('Há jogador lesionado ou suspenso na escalação.', 'An injured or suspended player is in the lineup.'));
    const want = Math.min(11, av.length);
    if (lp.length !== want) probs.push(L(`Escale ${want} jogadores (há ${lp.length}).`, `Pick ${want} players (you have ${lp.length}).`));
    if (c.G > 1) probs.push(L('Só um goleiro pode jogar.', 'Only one goalkeeper may play.'));
    if (c.G === 0 && av.some(p => p.pos === 'G')) probs.push(L('Escale um goleiro.', 'Pick a goalkeeper.'));
    return probs;
  };

  /* ---------- partida ---------- */
  const STYLE = [[0.85, 1.12], [1, 1], [1.15, 0.9]];
  const KNORM = 5.0 / 8.6;
  function power(on, style) {
    let a = 0, m = 0, d = 0, g = 0, hasG = false, nd = 0, na = 0;
    for (const p of on) {
      const e = E.eff(p);
      if (p.pos === 'G') { g += e; hasG = true; }
      else if (p.pos === 'D') { d += e; nd++; }
      else if (p.pos === 'M') m += e;
      else { a += e; na++; }
    }
    if (!hasG) g = 12;
    let atk = a + 0.65 * m + 0.1 * d, dfn = d + 0.65 * m + 2 * g;
    if (nd < 3) dfn *= 0.8;
    if (na < 1) atk *= 0.7;
    return { atk: Math.max(1, atk * STYLE[style][0]), dfn: Math.max(1, dfn * STYLE[style][1]) };
  }

  function mkMatch(G, fx, div) {
    const H = G.teams[fx[0]], A = G.teams[fx[1]];
    const on = [E.lineupPlayers(H).filter(E.avail), E.lineupPlayers(A).filter(E.avail)];
    return {
      h: H.id, a: A.id, div, fx, sc: [0, 0], min: 0, ev: [], on, ball: 0, done: false,
      start: on.map(l => new Set(l.map(p => p.id))), used: on.map(l => new Set(l.map(p => p.id))),
      // minutos em campo por jogador (só nesta partida): { from, to }, to = null até o apito final
      span: on.map(l => Object.fromEntries(l.map(p => [p.id, { from: 0, to: null }]))),
      subs: [0, 0], yel: [[], []], reds: [[], []], inj: [[], []], vac: [0, 0],
      user: H.id === G.mgr.team ? 0 : A.id === G.mgr.team ? 1 : -1, autoUser: false, needSub: false, att: 0
    };
  }

  E.startRound = function (G, autoUser) {
    const ms = [];
    for (let d = 0; d < 4; d++) for (const fx of G.fix[d][G.round]) {
      for (const tid of [fx[0], fx[1]]) if (tid !== G.mgr.team || autoUser) E.autoLineup(G.teams[tid]);
      const m = mkMatch(G, fx, d);
      if (autoUser) m.autoUser = true;
      ms.push(m);
    }
    return ms;
  };

  E.bench = (G, m, s) => G.teams[s ? m.a : m.h].players.filter(p => E.avail(p) && !m.used[s].has(p.id));
  function ev(m, type, s, p, extra) { m.ev.push(Object.assign({ min: m.min, type, s, n: p ? p.n : '', pid: p ? p.id : 0 }, extra)); }

  E.sub = function (G, m, s, outId, inId) {
    if (m.subs[s] >= E.MAX_SUBS) return false;
    const pin = E.bench(G, m, s).find(p => p.id === inId);
    if (!pin) return false;
    if (outId) {
      const i = m.on[s].findIndex(p => p.id === outId);
      if (i < 0) return false;
      ev(m, 'sub', s, pin, { out: m.on[s][i].n });
      m.span[s][outId].to = m.min;
      m.on[s][i] = pin;
    } else {
      if (m.vac[s] <= 0) return false;
      m.vac[s]--;
      ev(m, 'sub', s, pin, { out: '' });
      m.on[s].push(pin);
    }
    m.span[s][pin.id] = { from: m.min, to: null };
    m.used[s].add(pin.id); m.subs[s]++;
    return true;
  };
  function leave(m, s, p) { m.on[s].splice(m.on[s].indexOf(p), 1); m.span[s][p.id].to = m.min; }
  E.minutesPlayed = function (m, s, id) {
    const x = m.span[s][id];
    return x ? clamp((x.to ?? 90) - x.from, 0, 90) : 0;
  };
  function aiReplace(G, m, s, pos) {
    const b = E.bench(G, m, s).filter(p => (pos === 'G') === (p.pos === 'G')).sort((x, y) => (y.pos === pos) - (x.pos === pos) || E.eff(y) - E.eff(x));
    if (b.length) E.sub(G, m, s, 0, b[0].id);
  }
  function aiTactical(G, m, s) {
    const outs = m.on[s].filter(p => p.pos !== 'G').sort((x, y) => x.fit - y.fit);
    if (!outs.length) return;
    const out = outs[0];
    const b = E.bench(G, m, s).filter(p => p.pos === out.pos && E.eff(p) >= E.eff(out)).sort((x, y) => E.eff(y) - E.eff(x));
    if (b.length) E.sub(G, m, s, out.id, b[0].id);
  }

  E.step = function (G, m) {
    if (m.done) return;
    m.min++;
    const T = [G.teams[m.h], G.teams[m.a]];
    const P = [power(m.on[0], T[0].style), power(m.on[1], T[1].style)];
    m.ball = clamp(m.ball * 0.75 + (r() - 0.5) * 1.1 + (P[0].atk / (P[0].atk + P[1].atk) - 0.5) * 0.8, -0.9, 0.9);
    for (let s = 0; s < 2; s++) {
      const ai = m.user !== s || m.autoUser, on = m.on[s];
      if (!on.length) continue;
      const lam = clamp(1.08 * Math.pow(P[s].atk / (KNORM * P[1 - s].dfn), 2.2) * (s ? 0.9 : 1.12), 0.08, 6);
      if (r() < lam / 90) {
        let tot = 0;
        const w = on.map(p => { const x = (p.pos === 'A' ? 4 : p.pos === 'M' ? 1.5 : p.pos === 'D' ? 0.4 : 0.01) * E.eff(p); tot += x; return x; });
        let x = r() * tot, i = 0;
        while (i < on.length - 1 && (x -= w[i]) > 0) i++;
        on[i].g++; m.sc[s]++; m.ball = s ? -1 : 1;
        ev(m, 'goal', s, on[i]);
      }
      if (r() < 0.021) {
        const p = pick(on);
        if (p.pos !== 'G' || r() < 0.2) {
          if (m.yel[s].includes(p)) {
            leave(m, s, p); m.reds[s].push({ p, n: 1 }); ev(m, 'red', s, p);
          } else { m.yel[s].push(p); ev(m, 'yel', s, p); }
        }
      }
      if (on.length && r() < 0.0008) {
        const p = pick(on);
        leave(m, s, p); m.reds[s].push({ p, n: 2 }); ev(m, 'red', s, p);
      }
      if (on.length && r() < 0.0012) {
        const p = pick(on);
        leave(m, s, p); m.inj[s].push(p); ev(m, 'inj', s, p);
        if (m.subs[s] < E.MAX_SUBS) {
          m.vac[s]++;
          if (ai) aiReplace(G, m, s, p.pos); else { m.needSub = true; m.injP = p; }
        }
      }
      if (ai && m.subs[s] < 3 && (m.min === 62 || m.min === 72 || m.min === 82)) aiTactical(G, m, s);
    }
    if (m.min >= 90) m.done = true;
  };

  E.attendance = function (G, home) {
    const dv = E.DIVS[home.div];
    const price = clamp(Math.pow(dv.ticket / Math.max(1, home.ticket), 1.5), 0, 1.6);
    const form = home.st.p ? 0.7 + 0.6 * home.st.pts / (3 * home.st.p) : 1;
    return Math.round(Math.min(home.cap, home.fans * price * form * (0.9 + r() * 0.2)));
  };
  E.tv = team => {
    const dv = E.DIVS[team.div];
    return Math.round(0.85 * 22 * 180 * Math.pow(1.085, dv.norm) * clamp(team.fans / (dv.cap * 0.7), 0.7, 1.3) / 1000) * 1000;
  };
  E.prizeFor = (div, pos) => Math.round(E.DIVS[div].prize * (21 - pos) / 20 / 1000) * 1000;

  E.finishRound = function (G, ms) {
    const ut = G.mgr.team, U = G.teams[ut], out = { user: null, att: 0, income: 0 };
    for (const t of G.teams) for (const p of t.players) { if (p.inj) p.inj--; if (p.sus) p.sus--; }
    for (const m of ms) {
      const T = [G.teams[m.h], G.teams[m.a]];
      m.fx[2] = m.sc[0]; m.fx[3] = m.sc[1];
      m.att = E.attendance(G, T[0]);
      for (let s = 0; s < 2; s++) {
        const t = T[s], st = t.st, gf = m.sc[s], ga = m.sc[1 - s], mine = t.id === ut;
        st.p++; st.gf += gf; st.ga += ga;
        const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
        if (res === 'W') { st.w++; st.pts += 3; t.fans = Math.round(t.fans * 1.004); }
        else if (res === 'D') { st.d++; st.pts++; }
        else { st.l++; t.fans = Math.round(t.fans * 0.998); }
        t.form.push(res); if (t.form.length > 5) t.form.shift();
        // desgaste proporcional aos minutos jogados: 11 a cada 90' (+3 se tiver mais de 30 anos)
        for (const p of t.players) if (m.used[s].has(p.id))
          p.fit = Math.max(20, p.fit - Math.round((11 + (p.age > 30 ? 3 : 0)) * E.minutesPlayed(m, s, p.id) / 90));
        for (const p of m.yel[s]) {
          if (m.reds[s].some(x => x.p === p)) continue;
          if (++p.yc >= 3) {
            p.yc = 0; p.sus = 1;
            if (mine) E.news(G, L(`${p.n} levou o 3º amarelo e está suspenso.`, `${p.n} got a 3rd yellow and is suspended.`), 'bad');
          }
        }
        for (const x of m.reds[s]) {
          x.p.sus = x.n;
          if (mine) E.news(G, L(`${x.p.n} foi expulso: ${x.n} jogo(s) de suspensão.`, `${x.p.n} was sent off: ${x.n} match ban.`), 'bad');
        }
        for (const p of m.inj[s]) {
          p.inj = r() < 0.12 ? ri(6, 12) : ri(1, 5);
          if (mine) E.news(G, L(`${p.n} se lesionou: fora por ${p.inj} rodada(s).`, `${p.n} is injured: out for ${p.inj} round(s).`), 'bad');
        }
        if (mine) {
          out.user = m; out.res = res;
          G.mgr.games++; G.mgr[res.toLowerCase()]++;
          G.mgr.conf += res === 'W' ? 3 : res === 'D' ? -0.5 : -3;
        }
      }
      if (m.h === ut) {
        out.att = m.att; out.income = m.att * U.ticket;
        U.cash += out.income; G.fin.tick += out.income;
      }
    }
    for (const t of G.teams) for (const p of t.players) p.fit = Math.min(100, p.fit + 9);

    // finanças do usuário
    const tv = E.tv(U), wages = E.wageBill(U), interest = Math.round(U.loan * 0.01);
    U.cash += tv - wages - interest;
    G.fin.tv += tv; G.fin.wage += wages; G.fin.int += interest;

    G.round++;
    // diretoria
    const pos = E.position(G, ut);
    if (G.round >= 6) { if (pos <= G.mgr.exp - 3) G.mgr.conf += 1; else if (pos >= G.mgr.exp + 4) G.mgr.conf -= 1.5; }
    if (U.cash < 0) {
      G.mgr.conf -= 3;
      E.news(G, L('A diretoria está preocupada: o caixa está negativo!', 'The board is worried: the club is in the red!'), 'bad');
    }
    G.mgr.conf = clamp(G.mgr.conf, 0, 100);

    marketRound(G);
    if (G.round >= E.ROUNDS) G.seasonOver = true;
    else if (G.mgr.conf <= 8 && U.st.p >= 10 && G.round < 36) fire(G);
    return out;
  };

  function fire(G) {
    const U = E.userTeam(G);
    G.mgr.log.push({ s: G.season, team: U.name, div: U.div, pos: E.position(G, U.id), note: 'fired' });
    G.mgr.rep = clamp(G.mgr.rep - 8, 0, 100);
    const rank = worldRank(G), i = rank.indexOf(U);
    let cands = rank.slice(i + 2, i + 14);
    if (cands.length < 3) cands = rank.filter(t => t !== U).slice(-6);
    G.pending = { type: 'fired', from: U.name, offers: shuffle(cands.slice()).slice(0, 3).map(t => t.id) };
    E.news(G, L(`${G.mgr.name} foi demitido do ${U.name}!`, `${G.mgr.name} was sacked by ${U.name}!`), 'bad');
  }
  function worldRank(G) { return G.teams.slice().sort((a, b) => a.div - b.div || E.rating(b) - E.rating(a)); }

  /* ---------- mercado ---------- */
  function regen(G, team, pos, level) {
    return addPlayer(team, mkPlayer(G, pos, level, ri(17, 20)));
  }
  function ensureSquad(G, team, isUser) {
    const min = isUser ? { G: 2, D: 5, M: 5, A: 3 } : { G: 2, D: 6, M: 6, A: 4 };
    const total = isUser ? 18 : 20;
    const level = () => 0.5 * E.rating(team) + 0.5 * E.DIVS[team.div].norm - ri(4, 12);
    const c = E.formationOf(team.players);
    for (const pos in min) while (c[pos] < min[pos]) { regen(G, team, pos, level()); c[pos]++; }
    while (team.players.length < total) regen(G, team, pick(['D', 'M', 'A']), level());
    if (!isUser) while (team.players.length > 28) {
      const c2 = E.formationOf(team.players);
      const w = team.players.filter(p => c2[p.pos] > min[p.pos] + 1).sort((a, b) => a.str - b.str)[0];
      if (!w) break;
      team.players.splice(team.players.indexOf(w), 1);
    }
    sortSquad(team);
  }
  function transfer(G, p, from, to, price) {
    from.players.splice(from.players.indexOf(p), 1);
    from.lineup = from.lineup.filter(id => id !== p.id);
    p.sale = 0; p.listed = 0;
    to.players.push(p); sortSquad(to);
    G.market = G.market.filter(m => m.pid !== p.id);
    G.offers = G.offers.filter(o => o.pid !== p.id);
    const ut = G.mgr.team;
    if (from.id === ut) { from.cash += price; G.fin.sold += price; ensureSquad(G, to, false); }
    if (to.id === ut) { to.cash -= price; G.fin.bought += price; ensureSquad(G, from, false); }
  }
  // Clube da IA que compra um destaque vendido no fim da temporada: pode pagar (orçamento da divisão) e tem nível
  // para ele, sem ser tão forte que ele vire reserva. Sorteia entre os 5 mais fortes que se encaixam; quem compra abre vaga dispensando o pior excedente.
  function starBuyer(G, p, from, price) {
    const c = G.teams.filter(t => t !== from && t.id !== G.mgr.team && E.DIVS[t.div].budget >= price &&
      E.rating(t) >= p.str - 10 && E.rating(t) <= p.str + 3).sort((a, b) => E.rating(b) - E.rating(a));
    return c.length ? pick(c.slice(0, 5)) : null;
  }
  function refreshMarket(G) {
    G.market = G.market.filter(m => (m.star || r() > 0.2) && E.findPlayer(G, m.pid) && E.findPlayer(G, m.pid).t.id === m.tid);
    const ai = G.teams.filter(t => t.id !== G.mgr.team);
    let guard = 0;
    while (G.market.length < 40 && guard++ < 400) {
      const t = pick(ai);
      if (t.players.length < 19) continue;
      const p = pick(t.players);
      if (G.market.some(m => m.pid === p.id)) continue;
      G.market.push({ pid: p.id, tid: t.id, price: Math.round(E.value(p) * (0.95 + r() * 0.55) / 1000) * 1000 });
    }
  }
  function buyers(G, p, price) {
    return G.teams.filter(t => t.id !== G.mgr.team && E.DIVS[t.div].budget >= price && E.rating(t) <= p.str + 8 && E.rating(t) >= p.str - 14);
  }
  function marketRound(G) {
    const U = E.userTeam(G);
    for (const p of U.players.slice()) {
      if (!p.sale || U.players.length <= E.MIN_SQUAD) continue;
      const ratio = p.sale / E.value(p);
      const prob = ratio <= 0.9 ? 0.6 : ratio <= 1.1 ? 0.35 : ratio <= 1.4 ? 0.12 : ratio <= 1.8 ? 0.03 : 0;
      if (r() >= prob) continue;
      const b = buyers(G, p, p.sale);
      if (!b.length) continue;
      const to = pick(b), price = p.sale;
      transfer(G, p, U, to, price);
      E.news(G, L(`${p.n} vendido ao ${to.name} por ${E.money(price)}.`, `${p.n} sold to ${to.name} for ${E.money(price)}.`), 'money');
    }
    if (r() < 0.07 && U.players.length > E.MIN_SQUAD) {
      const top = U.players.filter(p => !p.sale && !G.offers.some(o => o.pid === p.id)).sort((a, b) => b.str - a.str).slice(0, 8);
      if (top.length) {
        const p = pick(top), price = Math.round(E.value(p) * (1.1 + r() * 0.5) / 1000) * 1000, b = buyers(G, p, price);
        if (b.length) G.offers.push({ pid: p.id, tid: pick(b).id, price });
      }
    }
    refreshMarket(G);
  }
  E.money = v => {
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e6) return s + 'R$ ' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',') + 'M';
    if (a >= 1e3) return s + 'R$ ' + Math.round(a / 1e3) + 'k';
    return s + 'R$ ' + Math.round(a);
  };

  E.buy = function (G, pid) {
    const m = G.market.find(x => x.pid === pid), U = E.userTeam(G), f = E.findPlayer(G, pid);
    if (!m || !f) return L('Jogador indisponível.', 'Player unavailable.');
    if (U.players.length >= E.MAX_SQUAD) return L('Elenco cheio.', 'Squad is full.');
    if (U.cash < m.price) return L('Dinheiro insuficiente.', 'Not enough cash.');
    transfer(G, f.p, f.t, U, m.price);
    E.news(G, L(`${f.p.n} contratado do ${f.t.name} por ${E.money(m.price)}.`, `${f.p.n} signed from ${f.t.name} for ${E.money(m.price)}.`), 'money');
    return '';
  };
  E.bid = function (G, pid, amount) {
    const f = E.findPlayer(G, pid), U = E.userTeam(G);
    if (!f || f.t === U) return L('Jogador indisponível.', 'Player unavailable.');
    if (U.players.length >= E.MAX_SQUAD) return L('Elenco cheio.', 'Squad is full.');
    if (U.cash < amount) return L('Dinheiro insuficiente.', 'Not enough cash.');
    if (f.t.players.length <= 16) return L('O clube não pode perder mais jogadores.', 'That club cannot lose more players.');
    const key = f.t.players.slice().sort((a, b) => b.str - a.str).indexOf(f.p) < 11;
    if (amount < E.value(f.p) * (key ? 1.7 : 1.3)) return L(`O ${f.t.name} recusou a proposta.`, `${f.t.name} rejected the bid.`);
    transfer(G, f.p, f.t, U, amount);
    E.news(G, L(`${f.p.n} contratado do ${f.t.name} por ${E.money(amount)}.`, `${f.p.n} signed from ${f.t.name} for ${E.money(amount)}.`), 'money');
    return '';
  };
  E.answerOffer = function (G, accept) {
    const o = G.offers.shift();
    if (!o || !accept) return;
    const f = E.findPlayer(G, o.pid), U = E.userTeam(G);
    if (!f || f.t !== U) return;
    transfer(G, f.p, U, G.teams[o.tid], o.price);
    E.news(G, L(`${f.p.n} vendido ao ${G.teams[o.tid].name} por ${E.money(o.price)}.`, `${f.p.n} sold to ${G.teams[o.tid].name} for ${E.money(o.price)}.`), 'money');
  };
  E.release = function (G, pid) {
    const U = E.userTeam(G), p = U.players.find(x => x.id === pid);
    if (!p || U.players.length <= E.MIN_SQUAD) return false;
    U.players.splice(U.players.indexOf(p), 1);
    U.lineup = U.lineup.filter(id => id !== pid);
    G.offers = G.offers.filter(o => o.pid !== pid);
    return true;
  };

  /* ---------- finanças ---------- */
  E.seatCost = team => 25 * E.DIVS[team.div].ticket;
  E.expand = function (G, seats) {
    const U = E.userTeam(G), cost = seats * E.seatCost(U);
    if (U.cash < cost) return false;
    U.cash -= cost; U.cap += seats; G.fin.stad += cost;
    return true;
  };
  E.loanStep = team => E.DIVS[team.div].loan / 10;
  E.borrow = function (G) {
    const U = E.userTeam(G), step = E.loanStep(U);
    if (U.loan + step > E.DIVS[U.div].loan) return false;
    U.loan += step; U.cash += step; return true;
  };
  E.repay = function (G) {
    const U = E.userTeam(G), amt = Math.min(U.loan, E.loanStep(U));
    if (!amt || U.cash < amt) return false;
    U.loan -= amt; U.cash -= amt; return true;
  };

  /* ---------- fim de temporada ---------- */
  E.endSeason = function (G) {
    const ut = G.mgr.team, U = G.teams[ut], sum = { season: G.season, divs: [], retired: [] };
    const tabs = [0, 1, 2, 3].map(d => E.table(G, d));
    const pos = tabs[U.div].indexOf(U) + 1, oldDiv = U.div;
    sum.pos = pos; sum.div = oldDiv;
    sum.prize = E.prizeFor(oldDiv, pos);
    U.cash += sum.prize; G.fin.prize += sum.prize;
    sum.fin = Object.assign({}, G.fin);

    for (let d = 0; d < 4; d++) {
      const sc = E.scorers(G, d, 1)[0];
      sum.divs.push({
        champ: tabs[d][0].id, up: d > 0 ? tabs[d].slice(0, 4).map(t => t.id) : [],
        down: d < 3 ? tabs[d].slice(-4).map(t => t.id) : [],
        scorer: sc ? { n: sc.p.n, g: sc.p.g, team: sc.t.abbr } : null
      });
      tabs[d][0].fans = Math.round(tabs[d][0].fans * 1.1);
    }
    G.champs.unshift({ s: G.season, c: sum.divs.map(x => G.teams[x.champ].name) });
    for (let d = 0; d < 4; d++) {
      for (const id of sum.divs[d].up) { const t = G.teams[id]; t.div = d - 1; t.fans = Math.round(t.fans * 1.2); if (id !== ut) t.ticket = E.DIVS[t.div].ticket; }
      for (const id of sum.divs[d].down) { const t = G.teams[id]; t.div = d + 1; t.fans = Math.round(t.fans * 0.85); if (id !== ut) t.ticket = E.DIVS[t.div].ticket; }
    }
    sum.champion = pos === 1; sum.promoted = U.div < oldDiv; sum.relegated = U.div > oldDiv;
    const diff = G.mgr.exp - pos;
    G.mgr.rep = clamp(G.mgr.rep + clamp(diff, -8, 8) * 0.8 + (sum.promoted ? 8 : 0) + (sum.champion ? 6 : 0) - (sum.relegated ? 10 : 0), 0, 100);
    G.mgr.conf = clamp(G.mgr.conf + diff * 2 + (sum.promoted ? 20 : 0) - (sum.relegated ? 15 : 0), 30, 90);
    if (sum.champion) G.mgr.titles++;
    G.mgr.log.push({ s: G.season, team: U.name, div: oldDiv, pos, note: sum.champion ? 'champ' : sum.promoted ? 'up' : sum.relegated ? 'down' : '' });

    // evolução, aposentadorias e reposição
    const moved = new Set(), listed = [];
    for (const t of G.teams) {
      const mine = t.id === ut, norm = E.DIVS[t.div].norm;
      for (const p of t.players.slice()) {
        if (moved.has(p.id)) continue; // já envelheceu no clube que o vendeu
        p.age++;
        if (p.age <= 23) { if (p.pot > p.str) p.str += ri(0, Math.min(4, p.pot - p.str)); }
        else if (p.age <= 29) p.str += ri(-1, 1);
        else if (p.age <= 32) p.str -= ri(0, 2);
        else p.str -= ri(1, 4);
        p.str = clamp(p.str, 1, 99);
        p.fit = 100; p.inj = 0; p.sus = 0; p.yc = 0; p.g = 0;
        if (p.age >= 38 || (p.age >= 34 && r() < (p.age - 32) * 0.2)) {
          t.players.splice(t.players.indexOf(p), 1);
          t.lineup = t.lineup.filter(id => id !== p.id);
          regen(G, t, p.pos, 0.5 * E.rating(t) + 0.5 * norm - ri(4, 12));
          if (mine) sum.retired.push(p.n);
        }
      }
      if (!mine) {
        // IA: vende destaques fora do padrão (a outro clube da IA ou pelo mercado) e reforça os pontos fracos
        const byStr = t.players.slice().sort((a, b) => b.str - a.str);
        for (const p of byStr.slice(0, 2)) if (p.str > norm + 7 && !moved.has(p.id)) {
          if (p.listed) { // passou uma temporada no mercado sem comprador: sai para o exterior
            t.players.splice(t.players.indexOf(p), 1);
            t.lineup = t.lineup.filter(id => id !== p.id);
            addPlayer(t, mkPlayer(G, p.pos, norm + ri(-2, 5), ri(22, 29)));
            if (t.div === U.div || p.real) E.news(G, L(`${p.n} deixou o ${t.name} e foi jogar no exterior.`, `${p.n} left ${t.name} to play abroad.`), 'money');
            continue;
          }
          const price = Math.round(E.value(p) * (0.95 + r() * 0.3) / 1000) * 1000;
          const to = starBuyer(G, p, t, price);
          if (to) {
            moved.add(p.id);
            transfer(G, p, t, to, price);
            ensureSquad(G, to, false);
            addPlayer(t, mkPlayer(G, p.pos, norm + ri(-2, 5), ri(22, 29)));
            if (t.div === U.div || to.div === U.div || p.real)
              E.news(G, L(`${p.n} trocou o ${t.name} pelo ${to.name} por ${E.money(price)}.`, `${p.n} moved from ${t.name} to ${to.name} for ${E.money(price)}.`), 'money');
          } else listed.push({ p, t, price });
        }
        for (const p of byStr.slice(-2)) if (p.str < norm - 4) {
          t.players.splice(t.players.indexOf(p), 1);
          addPlayer(t, mkPlayer(G, p.pos, norm + ri(-3, 5), ri(21, 29)));
        }
        t.fm = r() < 0.3 ? pick(E.FORMATIONS) : t.fm;
      }
      ensureSquad(G, t, mine);
    }
    G.market = []; G.offers = [];
    G.season++;
    setupSeason(G);
    refreshMarket(G);
    // destaques sem comprador na IA: ficam no clube, à venda no mercado a temporada inteira; sem comprador, vão ao exterior
    for (const { p, t, price } of listed) {
      if (!t.players.includes(p) || t.id === G.mgr.team) continue;
      G.market = G.market.filter(m => m.pid !== p.id);
      G.market.unshift({ pid: p.id, tid: t.id, price, star: 1 });
      p.listed = 1;
      E.news(G, L(`${p.n} (${t.name}) está à venda por ${E.money(price)}.`, `${p.n} (${t.name}) is up for sale at ${E.money(price)}.`), 'money');
    }
    E.autoLineup(U, U.fm);

    // propostas de emprego
    if (G.mgr.rep >= 25 && diff >= 0 && r() < 0.85) {
      const rank = worldRank(G), i = rank.indexOf(U), win = Math.max(2, Math.round(G.mgr.rep / 5));
      const cands = rank.slice(Math.max(0, i - win), i);
      if (cands.length) G.pending = { type: 'offers', offers: shuffle(cands).slice(0, 2).map(t => t.id) };
    }
    E.news(G, L(`Começa a temporada ${G.season}!`, `Season ${G.season} kicks off!`), 'job');
    return sum;
  };

  /* ---------- utilidades para teste / resultado rápido ---------- */
  E.playAll = function (G, ms) { for (const m of ms) while (!m.done) E.step(G, m); };
  E.autoRound = function (G) {
    const ms = E.startRound(G, true);
    E.playAll(G, ms);
    return E.finishRound(G, ms);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  root.PB = E;
})(typeof window !== 'undefined' ? window : globalThis);
