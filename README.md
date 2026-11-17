# Prancheta 8-Bit ⚽

Jogo de técnico de futebol para navegador, em estilo 8-bit, com as **Séries A, B, C e D do Brasil**.
Um jogo original inspirado nos managers clássicos dos anos 90: escale o time, acompanhe a rodada
minuto a minuto, negocie jogadores, cuide do caixa e leve um clube da Série D ao título nacional.

*(English: an original 8-bit style football-manager web game covering Brazil's four national divisions. The UI has a PT/EN toggle.)*

## Como jogar

Sem build e sem dependências. Abra `index.html` no navegador, ou:

```bash
npm start        # http://localhost:8080
npm test         # simula 6 temporadas e valida o motor
```

## Mecânicas

- **80 clubes** em 4 divisões de 20, turno e returno (38 rodadas), 4 sobem e 4 descem.
- **Modo carreira** (propostas de clubes da Série D) ou **modo livre** (qualquer clube).
- **Elenco**: goleiros, defensores, meias e atacantes com força, idade, físico, potencial, valor e salário.
  A formação é definida pelos jogadores escalados; há escalação automática e postura (defensiva/equilibrada/ofensiva).
- **Partida ao vivo**: todos os jogos da divisão correm juntos, com gols, cartões, expulsões, lesões,
  intervalo, até 5 substituições, velocidade 1×/2×/4× e resultado rápido.
- **Desgaste e disciplina**: físico cai a cada jogo, 3 amarelos suspendem, vermelho suspende, lesões afastam.
- **Mercado**: compra na lista de transferências, propostas por qualquer jogador, venda com preço
  definido por você e propostas recebidas de outros clubes.
- **Finanças**: bilheteria (preço do ingresso × torcida × fase), TV/patrocínio, salários, premiação,
  ampliação do estádio e empréstimo bancário com juros.
- **Diretoria**: confiança sobe e desce com os resultados; técnico pode ser demitido e recebe
  propostas de emprego conforme a reputação.
- **Fim de temporada**: acesso/rebaixamento, artilheiros, evolução e aposentadoria de jogadores, revelações da base.
- Jogo salvo automaticamente no `localStorage`; sons chiptune via WebAudio.

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `js/data.js` | clubes (nome, cores, força) e listas de nomes |
| `js/engine.js` | motor do jogo, sem DOM (roda em Node) |
| `js/ui.js` | telas, partida ao vivo, áudio |
| `css/style.css` | visual 8-bit |
| `test/sim.test.js` | simulação headless de várias temporadas |

Os clubes são reais. Os jogadores usam **elencos reais** (nome, posição e idade) de `js/roster.js` quando o clube
consta lá; a força de cada jogador continua derivada da força do clube. Clubes sem elenco real, vagas que faltam
e as revelações da base usam nomes fictícios gerados.

### Elencos reais

`js/roster.js` é gerado por `scripts/update-roster.js`. A fonte padrão é a **Wikidata** (grátis, sem chave):

```bash
npm run update-roster                 # Wikidata
npm run update-roster -- --dry        # só mostra o resultado, sem gravar
API_FOOTBALL_KEY=... npm run update-roster -- --source apifootball --season 2026   # alternativa paga
```

A Wikidata é mantida por voluntários: a cobertura é boa na Série A/B e irregular na C/D, e transferências podem
demorar a aparecer. Clubes com menos de 16 jogadores ficam com nomes gerados, e um clube que some de uma
atualização mantém o elenco anterior. O workflow `.github/workflows/update-roster.yml` roda toda segunda-feira
e abre um PR se algo mudou (Settings → Actions → General → permitir que o Actions crie PRs).
Com a API-Football, se o nome de um clube não casar com `js/data.js`, o script avisa; ajuste o `ALIAS` no topo do script. As divisões
refletem aproximadamente a temporada 2026 (a Série D foi reduzida a 20 clubes).

## Publicação

O workflow em `.github/workflows/ci.yml` roda os testes e publica no GitHub Pages a cada push na `main`
(ative em *Settings → Pages → Source: GitHub Actions*).
