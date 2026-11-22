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

`js/roster.js` é gerado por `scripts/update-roster.js`, só com fontes gratuitas:

- **Série A** — [football-data.org](https://www.football-data.org/client/register) (token grátis): elencos atuais.
- **Todas as divisões (opcional)** — `--source transfermarkt` lê os elencos atuais do Transfermarkt (veja o aviso sobre
  termos de uso em `scripts/transfermarkt.js`). O workflow semanal tenta o Transfermarkt primeiro e, se for bloqueado,
  cai para a football-data.org. Os runners do GitHub costumam ser bloqueados; se acontecer, rode localmente.
- **Séries B–D sem Transfermarkt** — nomes gerados. Não há fonte gratuita confiável: a Wikidata não registra datas de início/fim
  de vínculo na maioria dos casos e mistura ex-jogadores. Dá para testar com `--with-wikidata`
  (`--recent-years N` filtra por data de início; `0` desliga o filtro, trazendo ex-jogadores).

```bash
FOOTBALL_DATA_TOKEN=... npm run update-roster -- --dry   # mostra o resultado sem gravar
FOOTBALL_DATA_TOKEN=... npm run update-roster            # grava js/roster.js
```

### Atualizar à mão (Séries A–D, pelo Transfermarkt)

O Transfermarkt bloqueia os runners do GitHub, então o elenco completo (80 clubes) é atualizado no seu computador, quando quiser:

```bash
npm run refresh-roster              # atualiza, testa, mostra o que mudou e pergunta antes de criar a branch/PR
npm run refresh-roster -- --yes     # sem perguntar
npm run refresh-roster -- --no-pr   # envia a branch mas não abre o PR
```

Precisa de `node`, `git` com acesso ao repositório e, para abrir o PR sozinho, o GitHub CLI (`brew install gh && gh auth login`).
O comando exige a árvore de trabalho limpa, atualiza a `main`, busca os elencos (~10 min, 4 s entre as requisições), roda `npm test`,
e só então cria a branch `roster-update-AAAAMMDD-HHMM`. Se algo falhar, nada é enviado e o arquivo volta ao que era.
Se o Transfermarkt falhar e `FOOTBALL_DATA_TOKEN` estiver definido, usa a football-data.org (só Série A).

O workflow `.github/workflows/update-roster.yml` roda toda segunda-feira (e sob demanda em Actions → Update roster → Run
workflow; marque *dry_run* para testar sem abrir PR). Ele busca no Transfermarkt e, se o site bloquear o runner do GitHub,
cai para a football-data.org (só Série A, secret `FOOTBALL_DATA_TOKEN`). Se algo mudou, abre o PR `roster-update` para
revisão. Requisitos únicos: Settings → Actions → General → *Allow GitHub Actions to create and approve pull requests*.
GitHub desativa workflows agendados após 60 dias sem atividade no repositório.
Com a API-Football, se o nome de um clube não casar com `js/data.js`, o script avisa; ajuste o `ALIAS` no topo do script. As divisões
refletem aproximadamente a temporada 2026 (a Série D foi reduzida a 20 clubes).

## Publicação

O workflow `.github/workflows/ci.yml` roda os testes a cada push/PR. O workflow `.github/workflows/release.yml` sobe a
versão, atualiza o `CHANGELOG.md`, cria a tag e publica no GitHub Pages a cada push na `main`
(ative em *Settings → Pages → Source: GitHub Actions*). Detalhes em `docs/versioning.md`.
