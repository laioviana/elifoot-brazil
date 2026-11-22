# Plano: Mostrar posicao do time adversario na tabela (#37)

## Tamanho
small — mexe em 2 arquivos de código (`js/engine.js`, `js/ui.js`), não altera regras/equilíbrio, não muda o formato do save e não remove nada; só acrescenta uma informação na barra do próximo jogo.

## Objetivo
Na barra inferior do hub (onde aparece `CASA × Adversário` / `FORA × Adversário` ao lado do botão **Jogar ▶**), o jogador passa a ver também a posição atual do adversário na classificação da divisão, no mesmo formato já usado no HUD e na tela do clube: `CASA × Flamengo (3º)`.

## Decisões
- Nenhuma pergunta ao dono: o pedido da issue é direto.

## Premissas
- Formato: posição entre parênteses depois do nome, com `º`, igual ao `${E.position(...)}º` já usado em `hud()` e `clubView()`: `CASA × Flamengo (3º)`. Mesmo texto em PT e EN (só número + `º`, como no HUD).
- A posição é a de `E.position(G, id)` (mesma ordenação da aba Tabela). Na rodada 1, antes de qualquer jogo, mostra a posição pela ordem de desempate atual (todos zerados → ordem por `id`), como o HUD já faz para o time do usuário.
- A lógica de "próximo jogo" passa para o motor como `E.nextMatch(G)`, para ser testável em Node (convenção do `CLAUDE.md`); o `nextFix` local de `js/ui.js` é removido (só é usado em `hub()`).
- Sem mudança de CSS: o texto continua dentro de `<span class="nx">`.

## Arquivos a alterar
- `js/engine.js` — novo helper `E.nextMatch(G)` logo após `E.position`.
- `js/ui.js` — `hub()` usa `E.nextMatch` e exibe a posição; remove `nextFix`.
- `test/nextmatch.test.js` (novo) e `package.json` (script `test`).

## Tarefas
1. Em `js/engine.js`, logo após `E.position` (linha ~167), adicionar `E.nextMatch = G => { ... }`: pega `id = G.mgr.team` e `rd = G.fix[G.teams[id].div][G.round]`; se `rd` não existir (temporada acabou) retorna `null`; senão acha o jogo `f` com `f[0] === id || f[1] === id` (retorna `null` se não achar) e retorna `{ home, opp, pos }`, onde `home = f[0] === id`, `opp = G.teams[home ? f[1] : f[0]]` e `pos = E.position(G, opp.id)`. Comentário em português.
2. Em `js/ui.js`, remover `function nextFix(G)` (linhas ~126-129).
3. Em `hub()` (linhas ~139-142), trocar `fx = nextFix(G)` por `m = E.nextMatch(G)` e, quando `m` existir, montar
   `` nx = `<span class="nx">${m.home ? L('CASA', 'HOME') : L('FORA', 'AWAY')} × ${m.opp.name} (${m.pos}º)</span>` ``; sem jogo, `nx` fica vazio (comportamento atual preservado).
4. Criar `test/nextmatch.test.js` e anexar `&& node test/nextmatch.test.js` ao script `test` do `package.json`.

## Plano de testes
`test/nextmatch.test.js` (com `E.rand` semeado, como em `test/sim.test.js`):
- Cria `E.newGame()`, `E.takeTeam(G, <um time da div 3>)`.
- Rodada 1: `E.nextMatch(G)` não é `null`; `opp.id !== G.mgr.team`; `opp.div` igual à divisão do usuário; `home` coincide com o jogo de `G.fix[div][0]` que contém o usuário; `pos === E.table(G, div).findIndex(t => t.id === opp.id) + 1`; `pos` entre 1 e 20.
- Joga algumas rodadas (`E.startRound(G, true)`, `E.playAll`, `E.finishRound`, tratando `G.pending`/`G.offers` como em `sim.test.js`) e repete a checagem de `pos` contra `E.table` — confirma que acompanha a classificação.
- Joga até `G.seasonOver`: `E.nextMatch(G)` retorna `null`.
- Checagem de fonte (estilo `test/credits.test.js`): o trecho de `hub()` em `js/ui.js` contém `E.nextMatch(G)` e `º)` dentro do `span.nx`.

## Critérios de aceitação
- [ ] No hub, a barra do próximo jogo mostra `CASA × <time> (Nº)` / `FORA × <time> (Nº)` (e `HOME`/`AWAY` em inglês), com N igual à posição do adversário na aba Tabela.
- [ ] Depois de cada rodada a posição exibida é atualizada.
- [ ] Com a temporada encerrada, a barra não mostra adversário (como hoje).
- [ ] `npm test` passa.

## Fora do escopo
- Mostrar a posição na aba Jogos/calendário, no jogo ao vivo ou na tela de resultados.
- Mostrar outros dados do adversário (pontos, forma, força).
- Mudanças de CSS/layout.

